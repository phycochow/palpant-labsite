from flask import Flask, render_template, jsonify, request
import os
import json
import numpy as np
import pandas as pd
import gc
import logging
import csv
import tempfile
import shutil
import traceback
import threading
import time
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader

# clustering test
import clustering_test

# Set up dedicated uploads directory
import os
import tempfile

# Set temp directory to our custom uploads folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
tempfile.tempdir = UPLOAD_FOLDER
# Create the directory if it doesn't exist
os.makedirs(tempfile.tempdir, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# Initialize Flask app
app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# Set maximum file size (5MB)
app.config['MAX_CONTENT_LENGTH'] = 5000 * 1024  # 5MB in bytes
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ----- Centralized dataset paths -----
DATA_DIR = os.path.join(app.static_folder, 'datasets')
DATASET_PATHS = {
    'target_param_filepath': os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv'),
    'feature_categories_filepath': os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv'),
    'causal_feature_categories_filepath': os.path.join(DATA_DIR, '0_CausalFeatureCategories_04Mar25.csv'),
    'enrich_filepath': os.path.join(DATA_DIR, '1_PermutatedImportancesTRUE_02May25.csv'),
    'cleaned_database_filepath': os.path.join(DATA_DIR, '0_CleanedDatabase_25Feb25.csv'),
    'binary_filepath': os.path.join(DATA_DIR, '1_BinaryFeatures_25Feb25.csv'),
    'odds_filepath': os.path.join(DATA_DIR, '1_PositiveOddsEnrichments_03May25.csv')
}

# Make paths available to other modules
import config
config.DATASET_PATHS = DATASET_PATHS

# Import from local modules - after setting paths in config
from data_manager import (
    load_lookup_tables,
    load_viewer_data,
    load_enrichment_data,
    get_search_table,
    clear_memory_cache,
    get_binary_df,
    get_cleaned_df,
    get_target_feature_dict,
    get_categories_dict,
    get_causal_categories_dict,
    get_candidates
)

from utils import (
    NpEncoder, 
    getUserProtocolFeatures, 
    getUserData, 
    process_maturity_indicators
)

# Load lookup tables at startup
FeatureCategories_dict, TargetParameters_dict, CausalFeatureCategories_dict = load_lookup_tables(
    DATASET_PATHS['feature_categories_filepath'], 
    DATASET_PATHS['target_param_filepath'],
    DATASET_PATHS['causal_feature_categories_filepath']
)

# Cache for benchmark results to avoid reprocessing
_benchmark_results_cache = {}

# Function to clean up temporary files and directories
def cleanup_temp_files():
    """
    Clean up temporary files and directories periodically
    This is a safety net in case any temp files aren't immediately deleted
    """
    while True:
        try:
            current_time = time.time()
            # Wait 20 minutes between cleanups
            time.sleep(1200)  # 20 minutes in seconds
            
            app.logger.info("Running scheduled temp file cleanup")
            
            # 1. Clean up uploads directory
            if os.path.exists(app.config['UPLOAD_FOLDER']):
                for filename in os.listdir(app.config['UPLOAD_FOLDER']):
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    if os.path.isfile(file_path):
                        # If file is older than 20 minutes
                        if current_time - os.path.getmtime(file_path) > 1200:
                            try:
                                os.remove(file_path)
                                app.logger.info(f"Deleted old upload: {filename}")
                            except Exception as e:
                                app.logger.error(f"Error deleting {filename}: {e}")
            
            # 2. Clean up temporary benchmark directories
            # Check system temp directory
            system_temp = tempfile.gettempdir()
            if os.path.exists(system_temp):
                for dirname in os.listdir(system_temp):
                    if dirname.startswith('benchmark_'):
                        dir_path = os.path.join(system_temp, dirname)
                        if os.path.isdir(dir_path):
                            # If directory is older than 20 minutes
                            if current_time - os.path.getmtime(dir_path) > 1200:
                                try:
                                    shutil.rmtree(dir_path)
                                    app.logger.info(f"Deleted old temp directory: {dirname}")
                                except Exception as e:
                                    app.logger.error(f"Error deleting directory {dirname}: {e}")
            
            # 3. Also check for temp directories in /tmp if it exists and is different
            if os.path.exists('/tmp') and '/tmp' != system_temp:
                for dirname in os.listdir('/tmp'):
                    if dirname.startswith('benchmark_'):
                        dir_path = os.path.join('/tmp', dirname)
                        if os.path.isdir(dir_path):
                            # If directory is older than 20 minutes
                            if current_time - os.path.getmtime(dir_path) > 1200:
                                try:
                                    shutil.rmtree(dir_path)
                                    app.logger.info(f"Deleted old temp directory from /tmp: {dirname}")
                                except Exception as e:
                                    app.logger.error(f"Error deleting directory from /tmp {dirname}: {e}")
            
            app.logger.info("Finished scheduled temp file cleanup")
                            
        except Exception as e:
            app.logger.error(f"Error in cleanup thread: {e}")

# Start the cleanup thread as a daemon
cleanup_thread = threading.Thread(target=cleanup_temp_files, daemon=True)
cleanup_thread.start()

# Error handler for file too large
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'status': 'error',
        'message': 'File too large. Maximum allowed size is 5MB per file, with a total request size limit of 5MB.'
    }), 413

# ----- API Routes -----
@app.route('/api/enrichment_data', methods=['GET'])
def get_enrichment_data():
    """
    Serve the enrichment records, optionally filtered by ?parameter=...
    """
    # Lazy load the enrichment data
    enrichment_data, enrichment_columns = load_enrichment_data(DATASET_PATHS['enrich_filepath'])
    
    if not enrichment_data:
        return jsonify({'error': 'Enrichment data not available'}), 404

    selected_label = request.args.get('parameter')
    if selected_label:
        filtered = [r for r in enrichment_data if r.get('Target Label') == selected_label]
    else:
        filtered = enrichment_data

    return jsonify({
        'data': filtered,
        'columns': enrichment_columns
    })

@app.route('/api/viewer')
def api_viewer():
    """
    Serve the entire cleaned database as JSON
    """
    # Lazy load the viewer data
    viewer_data, viewer_columns = load_viewer_data(DATASET_PATHS['cleaned_database_filepath'])
    
    if not viewer_data:
        return jsonify({'error': 'Viewer data not available'}), 404

    return jsonify({
        'data': viewer_data,
        'columns': viewer_columns
    })

@app.route('/api/get_ProtocolFeatures', methods=['POST'])
def get_ProtocolFeatures():
    key = request.form.get('selected_key','')
    return jsonify(values=FeatureCategories_dict.get(key, []))

@app.route('/api/get_TargetParameters', methods=['POST'])
def get_TargetParameters():
    key = request.form.get('selected_key','')
    return jsonify(values=TargetParameters_dict.get(key, []))

@app.route('/api/get_CausalFeatures', methods=['POST'])
def get_CausalFeatures():
    key = request.form.get('selected_key','')
    return jsonify(values=CausalFeatureCategories_dict.get(key, []))

@app.route('/api/submit_features', methods=['POST'])
def submit_features():
    # Get form fields
    parameter = request.form.get('parameter', '')
    features = request.form.getlist('selected_features[]')
    explicit_mode = request.form.get('mode', '')  # Get explicitly selected mode from UI
    
    # Determine search mode based on combination of selections and explicit mode
    if explicit_mode:
        # Use the mode explicitly selected by the user
        mode = explicit_mode
    else:
        # Fall back to determining mode from parameters for compatibility
        has_parameter = bool(parameter)
        has_features = bool(features)
        
        if not has_parameter and has_features:
            mode = 'normal'
        elif has_parameter and not has_features:
            mode = 'enrichment'
        elif has_parameter and has_features:
            mode = 'combined'
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid search criteria. Please select a mode and appropriate parameters.'
            })
    
    # Validate requirements for each mode
    if mode == 'normal' and not features:
        return jsonify({
            'status': 'error',
            'message': 'Normal mode requires at least one feature to be selected.'
        })
    
    if mode == 'enrichment' and not parameter:
        return jsonify({
            'status': 'error',
            'message': 'Enrichment mode requires a target topic to be selected.'
        })
    
    if mode == 'combined' and (not parameter or not features):
        return jsonify({
            'status': 'error',
            'message': 'Combined mode requires both a target topic and at least one feature.'
        })
    
    # Pull in the toggle_states[] values (strings "true"/"false")
    raw_states = request.form.getlist('toggle_states[]')
    # Convert them to real Python bools
    toggle_states = [s.lower() == 'true' for s in raw_states]
    
    try:
        # Get the search results table
        result_table = get_search_table(
            FeaturesOfInterest=features,
            binary_filepath=DATASET_PATHS['binary_filepath'],
            cleaned_database_filepath=DATASET_PATHS['cleaned_database_filepath'],
            odds_filepath=DATASET_PATHS['odds_filepath'],
            feature_categories_filepath=DATASET_PATHS['feature_categories_filepath'],
            LabelOfInterest=parameter, 
            CategoriesOfInterest=toggle_states,
            SearchMode=mode
        )
        
        # Check if result table is empty
        if result_table.empty:
            error_msg = 'No results found. '
            if mode == 'normal':
                error_msg += 'None of the protocols include all selected features. Try with fewer features.'
            elif mode == 'enrichment':
                error_msg += 'No protocols match the target topic. Try a different topic.'
            else:
                error_msg += 'No protocols match both the target topic and selected features. Try fewer constraints.'
                
            return jsonify({
                'status': 'error',
                'message': error_msg
            })
        
        # Fill NaN values with None for proper JSON serialization
        result_table = result_table.replace({np.nan: None})
        
        # Convert the result to records - handle NaN values gracefully
        result_data = json.loads(json.dumps(result_table.to_dict(orient='records'), cls=NpEncoder))
        result_columns = result_table.columns.tolist()
        
        # Create response with custom encoder
        response = {
            'status': 'success',
            'data': {
                'parameter': parameter,
                'selected_features': features,
                'mode': mode
            },
            'toggle_states': toggle_states,
            'search_results': {
                'data': result_data,
                'columns': result_columns
            }
        }
        
        # Use the custom encoder to convert to JSON
        return app.response_class(
            response=json.dumps(response, cls=NpEncoder),
            status=200,
            mimetype='application/json'
        )
    except Exception as e:
        app.logger.error(f"Error in submit_features: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Error processing request: {str(e)}'
        })

@app.route('/api/filter_features', methods=['POST'])
def filter_features():
    features = request.form.getlist('filter_features[]')
    return jsonify({
        'status': 'success',
        'data': {'filtered_features': features}
    })

# Updated submit_benchmark route for app.py

@app.route('/api/submit_benchmark', methods=['POST'])
def submit_benchmark():
    """
    Handle the benchmark form submission, processing files in memory where possible
    and deleting temporary files immediately after use.
    
    Now supports selecting a protocol directly from the database.
    """
    # Create temporary directory for file processing
    # Since PyPDF2 requires files on disk, we still need this
    temp_dir = None
    
    try:
        # Check file sizes before processing (if they exist)
        for key, file in request.files.items():
            if file and file.filename:
                # Check file size
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)  # Reset file pointer
                
                # Individual file size limit (450KB)
                individual_limit = 450 * 1024
                if file_size > individual_limit:
                    return jsonify({
                        'status': 'error',
                        'message': f'File {file.filename} is too large. Maximum allowed size per file is 450KB.'
                    }), 413
        
        # Access files uploaded in the request
        protocol_file = request.files.get('protocol_file')
        experimental_file = request.files.get('experimental_file')
        
        # Access selected own protocol ID (database selection)
        selected_own_protocol_id = request.form.get('selected_own_protocol_id')
        
        # Convert to None if not provided or empty
        if not selected_own_protocol_id or selected_own_protocol_id.strip() == '':
            selected_own_protocol_id = None
        
        # Print debug information
        app.logger.info(f"Selected own protocol ID: {selected_own_protocol_id}")
        
        # Access the purpose selection (single value)
        selected_purpose = request.form.get('selected_purpose')
        
        # Access protocol IDs (as a list)
        selected_protocol_ids = request.form.getlist('selected_protocol_ids[]')
        
        # Access reference pairs data (JSON string that needs to be parsed)
        reference_pairs_json = request.form.get('reference_pairs')
        reference_pairs = []
        if reference_pairs_json:
            try:
                reference_pairs = json.loads(reference_pairs_json)
            except json.JSONDecodeError:
                return jsonify({'status': 'error', 'message': 'Invalid reference pairs data'})
        
        # Validate required inputs
        if not protocol_file and not selected_own_protocol_id:
            return jsonify({'status': 'error', 'message': 'Either a protocol file or a protocol selection from the database is required'})
        
        if not selected_purpose:
            return jsonify({'status': 'error', 'message': 'Protocol purpose selection is required'})
        
        # Validate experimental file only if protocol file is used (and not database selection)
        if not selected_own_protocol_id and protocol_file and not experimental_file:
            return jsonify({'status': 'error', 'message': 'Experimental data file is required when using your own protocol'})
        
        # Create temporary directory only now that we've validated inputs
        temp_dir = tempfile.mkdtemp(prefix="benchmark_")
        app.logger.info(f"Created temporary directory: {temp_dir}")
        
        # Process main files - if using protocol from database, skip protocol file processing
        protocol_data = None
        if protocol_file:
            protocol_filename = secure_filename(protocol_file.filename)
            protocol_path = os.path.join(temp_dir, protocol_filename)
            protocol_file.save(protocol_path)
            protocol_data = {
                'path': protocol_path,
                'name': protocol_filename
            }
        
        # Process experimental file only if using own protocol (not database selection)
        experimental_data = None
        if experimental_file:
            experimental_filename = secure_filename(experimental_file.filename)
            experimental_path = os.path.join(temp_dir, experimental_filename)
            experimental_file.save(experimental_path)
            experimental_data = {
                'path': experimental_path,
                'name': experimental_filename
            }
        
        # Process reference pair files if any
        reference_data = []
        for i in range(len(reference_pairs)):
            ref_protocol = request.files.get(f'ref_protocol_{i}')
            ref_data = request.files.get(f'ref_data_{i}')
            if ref_protocol and ref_data:
                ref_protocol_filename = secure_filename(ref_protocol.filename)
                ref_data_filename = secure_filename(ref_data.filename)
                
                ref_protocol_path = os.path.join(temp_dir, f"ref_protocol_{i}_{ref_protocol_filename}")
                ref_data_path = os.path.join(temp_dir, f"ref_data_{i}_{ref_data_filename}")
                
                ref_protocol.save(ref_protocol_path)
                ref_data.save(ref_data_path)
                
                reference_data.append({
                    'protocol_path': ref_protocol_path,
                    'protocol_name': ref_protocol_filename,
                    'data_path': ref_data_path,
                    'data_name': ref_data_filename
                })
        
        # Process the data and generate results
        try:
            results = process_benchmark_data(
                protocol_data=protocol_data,
                experimental_data=experimental_data,
                selected_purpose=selected_purpose,
                selected_protocol_ids=selected_protocol_ids,
                reference_data=reference_data,
                selected_own_protocol_id=selected_own_protocol_id  # Will be None if not provided
            )
            return jsonify(results)
        except Exception as e:
            app.logger.error(f"Error processing benchmark: {str(e)}")
            app.logger.error(traceback.format_exc())
            return jsonify({
                'status': 'error',
                'message': f'Error processing benchmark: {str(e)}'
            })
        
    except Exception as e:
        app.logger.error(f"Error in submit_benchmark: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': f'Error processing request: {str(e)}'
        })
        
    finally:
        # Always clean up temporary files immediately
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                app.logger.info(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as e:
                app.logger.error(f"Error cleaning up temporary directory {temp_dir}: {e}")

# Updated process_benchmark_data function for app.py
def process_benchmark_data(protocol_data, experimental_data, selected_purpose, 
                         selected_protocol_ids, reference_data, selected_own_protocol_id=None):
    """
    Process the benchmark data and return results.
    
    Args:
        protocol_data: Dictionary with protocol file path and name, or None if protocol ID selected
        experimental_data: Dictionary with experimental file path and name, or None if protocol ID selected
        selected_purpose: The selected protocol purpose
        selected_protocol_ids: List of database protocol IDs to compare against
        reference_data: List of dictionaries with reference protocol and data info
        selected_own_protocol_id: Optional protocol ID selected from database for the main protocol
        
    Returns:
        Dictionary with benchmark results formatted for visualization
    """
    # Get all feature candidates
    c_candidates = get_candidates()
    target_feature_dict = get_target_feature_dict(DATASET_PATHS['odds_filepath'])
    
    # Load binary features dataframe and cleaned dataframe
    binary_df = get_binary_df(DATASET_PATHS['binary_filepath'])
    cleaned_df = get_cleaned_df(DATASET_PATHS['cleaned_database_filepath'])
    
    # Define indicators list (used for both protocol upload and database selection)
    indicators = ['Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)', 
                 'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
                 'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)', 
                 'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)', 
                 'Conduction Velocity from Calcium Imaging (cm/s)', 
                 'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)', 
                 'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
                 'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)', 
                 'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TNNI1)']
    
    # Handle protocol and data from database selection or PDF upload
    if selected_own_protocol_id:
        try:
            # Use logic for protocol ID selection for main protocol
            index_for_binary = int(selected_own_protocol_id) - 1
            index_for_cleaned = int(selected_own_protocol_id)
            
            # Get features from binary dataframe for this protocol
            filtered_b_row = binary_df.loc[index_for_binary, c_candidates]
            main_features = [col for col, val in filtered_b_row.items() if val]
            
            # Get experimental data from cleaned dataframe
            filtered_c_row = cleaned_df.loc[index_for_cleaned, indicators]
            main_data = {'ProtocolName': f'Protocol {selected_own_protocol_id}'}
            
            for indicator in indicators:
                if indicator in filtered_c_row and not pd.isna(filtered_c_row[indicator]) and str(filtered_c_row[indicator]) != "nan":
                    if indicator == 'T-tubule Structure (Found)':
                        main_data[indicator] = '1'
                    else:
                        main_data[indicator] = str(filtered_c_row[indicator])
                else:
                    main_data[indicator] = ""
            
            # Process the selected protocol data
            main_protocol_name, main_results_by_indicator = process_maturity_indicators(main_data, main_features, target_feature_dict)
            
        except Exception as e:
            app.logger.error(f"Error processing protocol ID {selected_own_protocol_id}: {str(e)}")
            app.logger.error(traceback.format_exc())
            raise Exception(f"Failed to load protocol ID {selected_own_protocol_id}: {str(e)}")
            
    else:
        # Process User's experimental data - only if not using database selection
        if not experimental_data:
            raise Exception("Experimental data is required when uploading your own protocol")
            
        main_data = getUserData(experimental_data['path'])
        
        # Process User's protocol from uploaded file
        if protocol_data:
            # User uploaded a protocol file
            main_features = getUserProtocolFeatures(protocol_data['path'], c_candidates)
        else:
            raise Exception("Protocol data is required. Either upload a protocol file or select one from the database.")

        # Process main protocol data
        main_protocol_name, main_results_by_indicator = process_maturity_indicators(main_data, main_features, target_feature_dict)
    
    # Create the main results structure
    results = {
        'status': 'success',
        'protocol_name': main_protocol_name,
        'selected_purpose': selected_purpose,
        'results': main_results_by_indicator,
        'reference_results': [],
        'db_protocol_results': []
    }

    # Process purpose-based reference data
    PurposeData = {'ProtocolName': f'Key Characteristics of {selected_purpose}'}
    # Add empty values for all indicators
    for indicator in indicators:
        PurposeData[indicator] = ''
        
    # Get features associated with selected purpose
    if selected_purpose in target_feature_dict:
        PurposeFeatures = target_feature_dict[selected_purpose]
    else:
        PurposeFeatures = []  # Default to empty list if purpose not found
        
    PurposeProtocolName, PurposeQResultsByIndicator = process_maturity_indicators(PurposeData, PurposeFeatures, target_feature_dict)

    # Add purpose reference to results
    results['reference_results'].append({
        'name': PurposeProtocolName,
        'results': PurposeQResultsByIndicator
    })

    # Process user-uploaded reference pairs
    for ref_data in reference_data:
        ProtocolPath, DataPath = ref_data['protocol_path'], ref_data['data_path']
        RefData = getUserData(DataPath)
        RefFeatures = getUserProtocolFeatures(ProtocolPath, c_candidates)

        RefProtocolName, RefQResultsByIndicator = process_maturity_indicators(RefData, RefFeatures, target_feature_dict)
        
        results['reference_results'].append({
            'name': RefProtocolName,
            'results': RefQResultsByIndicator
        })
    
    # Process database protocol comparisons
    for protocol_id in selected_protocol_ids:  # Use the original list, not filtered
        # Adjust indices as needed (binary df is 0-indexed, cleaned might be 1-indexed)
        try:
            index_for_binary = int(protocol_id) - 1
            index_for_cleaned = int(protocol_id)
            
            # Get features from binary dataframe
            filtered_b_row = binary_df.loc[index_for_binary, c_candidates]
            IDRefFeatures = [col for col, val in filtered_b_row.items() if val]
            
            # Get experimental data from cleaned dataframe
            filtered_c_row = cleaned_df.loc[index_for_cleaned, indicators]
            
            # Add a suffix if this protocol is the same as the main protocol
            protocol_name_suffix = ""
            if protocol_id == selected_own_protocol_id:
                protocol_name_suffix = " (Reference)"
                
            IDRefData = {'ProtocolName': f'Protocol {protocol_id}{protocol_name_suffix}'}
            
            for indicator in indicators:
                if indicator in filtered_c_row and not pd.isna(filtered_c_row[indicator]) and str(filtered_c_row[indicator]) != "nan":
                    if indicator == 'T-tubule Structure (Found)':
                        IDRefData[indicator] = '1'
                    else:
                        IDRefData[indicator] = str(filtered_c_row[indicator])
                else:
                    IDRefData[indicator] = ""

            IDRefProtocolName, IDRefQResultsByIndicator = process_maturity_indicators(IDRefData, IDRefFeatures, target_feature_dict)
            
            results['db_protocol_results'].append({
                'id': protocol_id,
                'name': IDRefProtocolName,
                'results': IDRefQResultsByIndicator
            })
        except Exception as e:
            app.logger.error(f"Error processing protocol ID {protocol_id}: {str(e)}")
    
    return results

# ----- Web Routes -----
@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html',
        FeatureCategories=FeatureCategories_dict.keys(),
        CausalFeatureCategories=CausalFeatureCategories_dict.keys(),
        TargetParameters=TargetParameters_dict.keys()
    )

@app.route('/dash')
def dash():
    return render_template('dashboard.html')

@app.route('/test')
def test():
    return render_template('testcase.html',
        FeatureCategories=FeatureCategories_dict.keys(),
        TargetParameters=TargetParameters_dict.keys()
    )

# Register a function to clear memory cache on application shutdown
@app.teardown_appcontext
def teardown_app(exception=None):
    global _benchmark_results_cache
    _benchmark_results_cache.clear()
    clear_memory_cache()


# -- Clustering test ---
# Add these imports to the top of your existing app.py
import clustering_test

# Add these routes to your existing app.py

@app.route('/clustering-test')
def clustering_signup():
    """Main questionnaire page"""
    questions = clustering_test.load_questions_from_csv()
    if not questions:
        return "Error: Could not load questions from CSV file", 500
    
    return render_template('clustering_signup.html', questions=questions)

@app.route('/clustering-test/submit', methods=['POST'])
def clustering_submit():
    """Handle questionnaire submission"""
    try:
        name = request.form.get('name', '').strip()
        if not name:
            return jsonify({'status': 'error', 'message': 'Name is required'}), 400
        
        # Get answers (convert to integers)
        answers = []
        questions = clustering_test.load_questions_from_csv()
        
        for i in range(len(questions)):
            answer_key = f'question_{i}'
            answer = request.form.get(answer_key)
            if answer is not None:
                answers.append(int(answer))
            else:
                return jsonify({'status': 'error', 'message': f'Please answer all questions'}), 400
        
        # Save response and get user ID
        user_id = clustering_test.save_user_response(name, answers)
        
        return jsonify({
            'status': 'success',
            'user_id': user_id,
            'message': 'Response saved successfully'
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error saving response: {str(e)}'}), 500

@app.route('/clustering-test/results/<user_id>')
def clustering_results(user_id):
    """Results page with countdown and matches"""
    # Verify user exists
    data = clustering_test.load_responses_json()
    if user_id not in data['responses']:
        return "User not found", 404
    
    user_name = data['responses'][user_id]['name']
    return render_template('clustering_results.html', user_id=user_id, user_name=user_name)

@app.route('/clustering-test/activateresults1131')
def secret_activation():
    """Secret URL to view and toggle results activation"""
    # Check if this is a toggle request (POST) or just viewing (GET)
    if request.method == 'GET':
        # Just show current state with toggle buttons
        current_state = clustering_test.get_current_activation_state()
        
        if current_state['activated']:
            button_text = "🔴 DEACTIVATE Results"
            button_color = "#dc3545"
            status_color = "#28a745"
            status_icon = "✅"
            status_text = "ACTIVE"
        else:
            button_text = "🟢 ACTIVATE Results" 
            button_color = "#28a745"
            status_color = "#6c757d"
            status_icon = "⏸️"
            status_text = "INACTIVE"
            
        return f"""
        <html>
        <head>
            <title>Results Control Panel</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: Arial, sans-serif; padding: 30px; text-align: center; background: #f8f9fa; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .status {{ color: {status_color}; font-size: 1.5em; margin-bottom: 20px; }}
                .stats {{ background: #f1f3f4; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .toggle-btn {{ background: {button_color}; color: white; border: none; padding: 15px 30px; font-size: 1.1em; border-radius: 8px; cursor: pointer; margin: 10px; }}
                .clear-btn {{ background: #dc3545; color: white; border: none; padding: 12px 25px; font-size: 1em; border-radius: 8px; cursor: pointer; margin: 10px; }}
                .toggle-btn:hover, .clear-btn:hover {{ opacity: 0.9; transform: translateY(-1px); }}
                .admin-links {{ margin-top: 30px; }}
                .admin-links a {{ color: #007bff; text-decoration: none; margin: 0 15px; }}
                .admin-links a:hover {{ text-decoration: underline; }}
                .info {{ color: #6c757d; font-size: 0.9em; margin-top: 20px; }}
                .warning {{ color: #856404; background: #fff3cd; padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid #ffeaa7; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🎛️ Results Control Panel</h2>
                <div class="status">{status_icon} System Status: {status_text}</div>
                
                <div class="stats">
                    <strong>📊 Current Statistics</strong><br>
                    Total Participants: <strong>{current_state['user_count']}</strong><br>
                    Matches Calculated: <strong>{'Yes' if current_state.get('matches_calculated', False) else 'No'}</strong>
                </div>
                
                <form method="POST" style="display: inline;">
                    <button type="submit" class="toggle-btn">
                        {button_text}
                    </button>
                </form>
                
                <div class="warning">
                    <strong>⚠️ Danger Zone</strong><br>
                    Clear all user responses and reset the system
                </div>
                
                <form method="POST" action="/clustering-test/clear-responses" style="display: inline;">
                    <button type="submit" class="clear-btn" onclick="return confirm('Are you sure? This will delete ALL responses and cannot be undone!')">
                        🗑️ Clear All Responses
                    </button>
                </form>
                
                <div class="admin-links">
                    <a href="/clustering-test/admin-stats">📈 View Statistics</a> | 
                    <a href="/clustering-test">📝 View Questionnaire</a>
                </div>
                
                <div class="info">
                    💡 Click the button above to toggle the system state
                </div>
            </div>
        </body>
        </html>
        """
@app.route('/clustering-test/activateresults1131', methods=['POST'])
def secret_activation_toggle():
    """Handle the actual toggle action"""
    result = clustering_test.activate_results()
    
    if result['status'] == 'success':
        # Determine button text and color based on NEW state
        if result['activated']:
            status_color = "#28a745"
            status_icon = "✅"
            status_message = "Results have been ACTIVATED!"
            user_message = "Users will automatically see the countdown within 3 seconds"
        else:
            status_color = "#6c757d"
            status_icon = "⏸️"
            status_message = "Results have been DEACTIVATED!"
            user_message = "Users are now in waiting mode"
            
        return f"""
        <html>
        <head>
            <title>Toggle Complete</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: Arial, sans-serif; padding: 30px; text-align: center; background: #f8f9fa; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .status {{ color: {status_color}; font-size: 1.5em; margin-bottom: 20px; }}
                .message {{ font-size: 1.1em; margin-bottom: 30px; color: #333; }}
                .stats {{ background: #f1f3f4; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .btn {{ background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 1em; border-radius: 8px; cursor: pointer; margin: 10px; text-decoration: none; display: inline-block; }}
                .btn:hover {{ opacity: 0.9; }}
                .info {{ color: #6c757d; font-size: 0.9em; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="status">{status_icon} {status_message}</div>
                <div class="message">{result['message']}</div>
                
                <div class="stats">
                    <strong>📊 Updated Status</strong><br>
                    Total Participants: <strong>{result['user_count']}</strong><br>
                    System State: <strong>{'ACTIVE' if result['activated'] else 'INACTIVE'}</strong>
                </div>
                
                <a href="/clustering-test/activateresults1131" class="btn">🔄 Back to Control Panel</a>
                <a href="/clustering-test/admin-stats" class="btn">📈 View Statistics</a>
                
                <div class="info">
                    💡 {user_message}
                </div>
            </div>
        </body>
        </html>
        """
    else:
        return f"""
        <html>
        <head><title>Toggle Error</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h2>❌ Toggle Failed</h2>
        <p>{result['message']}</p>
        <a href="/clustering-test/activateresults1131">🔄 Try Again</a>
        </body>
        </html>
        """, 500

@app.route('/clustering-test/admin-stats')
def admin_stats():
    """Simple admin statistics page"""
    stats = clustering_test.get_admin_stats()
    
    return f"""
    <html>
    <head><title>Clustering Test Statistics</title></head>
    <body style="font-family: Arial; padding: 30px;">
    <h2>Clustering Test Statistics</h2>
    <ul>
        <li><strong>Total Responses:</strong> {stats['total_responses']}</li>
        <li><strong>Results Activated:</strong> {'Yes' if stats['activated'] else 'No'}</li>
        <li><strong>Matches Calculated:</strong> {'Yes' if stats['matches_calculated'] else 'No'}</li>
        <li><strong>Activation Time:</strong> {stats['activation_time'] or 'Not activated'}</li>
    </ul>
    
    <h3>Recent Participants:</h3>
    <ul>
    {''.join([f"<li>{r['name']} (ID: {r['id']}) - {r['timestamp']}</li>" for r in stats['sample_responses']])}
    </ul>
    
    <hr>
    <p><a href="/clustering-test/activateresults1131">🚀 Activate Results</a></p>
    </body>
    </html>
    """

# API Routes
@app.route('/api/clustering/check-activation')
def api_check_activation():
    """API endpoint to check if results are activated"""
    try:
        result = clustering_test.check_activation_status()
        app.logger.info(f"Activation check API called, returning: {result}")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error in check-activation API: {str(e)}")
        import traceback
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "activated": False,
            "activation_time": None,
            "user_count": 0,
            "matches_calculated": False,
            "error": str(e)
        }), 500

@app.route('/api/clustering/get-matches/<user_id>')
def api_get_matches(user_id):
    """API endpoint to get matches for a user"""
    try:
        app.logger.info(f"Get matches API called for user: {user_id}")
        result = clustering_test.get_user_matches(user_id)
        app.logger.info(f"Returning matches result: {result}")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error in get-matches API: {str(e)}")
        import traceback
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/clustering-test/clear-responses', methods=['POST'])
def clear_responses():
    """Clear all responses - admin function"""
    try:
        result = clustering_test.clear_all_responses()
        
        if result['status'] == 'success':
            return f"""
            <html>
            <head><title>Responses Cleared</title></head>
            <body style="font-family: Arial; padding: 30px; text-align: center; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #28a745;">✅ All Responses Cleared!</h2>
                <p style="font-size: 1.1em; margin-bottom: 30px;">{result['message']}</p>
                <a href="/clustering-test/activateresults1131" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">🔙 Back to Control Panel</a>
                <a href="/clustering-test" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-left: 10px;">📝 Go to Questionnaire</a>
            </div>
            </body>
            </html>
            """
        else:
            return f"""
            <html>
            <head><title>Clear Failed</title></head>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h2>❌ Clear Failed</h2>
            <p>{result['message']}</p>
            <a href="/clustering-test/activateresults1131">🔄 Back to Control Panel</a>
            </body>
            </html>
            """, 500
    except Exception as e:
        return f"Error: {str(e)}", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)

# you run this file by
# cd ~/palpant-labsite
# source venv/bin/activate
# gunicorn --bind 127.0.0.1:8000 app:app

# Changes to this file require these steps in bash after as they initate app.py:
# pkill gunicorn
# sudo systemctl daemon-reexec
# sudo systemctl daemon-reload
# sudo systemctl start flaskapp
# sudo systemctl enable flaskapp
# sudo systemctl status flaskapp
# sudo systemctl restart nginx

# Changes to other files like html and css require:
# sudo systemctl daemon-reload
# sudo systemctl restart flaskapp