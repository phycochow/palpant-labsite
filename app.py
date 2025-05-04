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
from PyPDF2 import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# Initialize Flask app
app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# ----- Centralized dataset paths -----
DATA_DIR = os.path.join(app.static_folder, 'datasets')
DATASET_PATHS = {
    'target_param_filepath': os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv'),
    'feature_categories_filepath': os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv'),
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
    get_candidates
)
from utils import (
    NpEncoder, 
    getUserProtocolFeatures, 
    getUserData, 
    process_maturity_indicators
)

# Load lookup tables at startup
FeatureCategories_dict, TargetParameters_dict = load_lookup_tables(
    DATASET_PATHS['feature_categories_filepath'], 
    DATASET_PATHS['target_param_filepath']
)

# Cache for benchmark results to avoid reprocessing
_benchmark_results_cache = {}

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

@app.route('/api/submit_benchmark', methods=['POST'])
def submit_benchmark():
    """
    Handle the benchmark form submission, preprocess all inputs into Python data structures,
    then pass them to process_benchmark_data for actual processing.
    """
    # Create temporary directory for file processing
    temp_dir = tempfile.mkdtemp(prefix="benchmark_")
    
    try:
        # Access files uploaded in the request
        protocol_file = request.files.get('protocol_file')
        experimental_file = request.files.get('experimental_file')
        
        # Access selected features (as a list)
        selected_features = request.form.getlist('selected_features[]')
        
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
        
        # Access reference pair files and save them to temp directory
        reference_data = []
        for i in range(len(reference_pairs)):
            ref_protocol = request.files.get(f'ref_protocol_{i}')
            ref_data = request.files.get(f'ref_data_{i}')
            if ref_protocol and ref_data:
                # Save files to temp directory
                ref_protocol_path = os.path.join(temp_dir, f"ref_protocol_{i}_{ref_protocol.filename}")
                ref_data_path = os.path.join(temp_dir, f"ref_data_{i}_{ref_data.filename}")
                
                ref_protocol.save(ref_protocol_path)
                ref_data.save(ref_data_path)
                
                reference_data.append({
                    'protocol_path': ref_protocol_path,
                    'protocol_name': ref_protocol.filename,
                    'data_path': ref_data_path,
                    'data_name': ref_data.filename
                })
        
        # Print for debugging (keep your existing debug code)
        print(f"Protocol file: {protocol_file.filename if protocol_file else 'None'}")
        print(f"Experimental file: {experimental_file.filename if experimental_file else 'None'}")
        print(f"Selected features: {selected_features}")
        print(f"Selected purpose: {selected_purpose}")
        print(f"Selected protocol IDs: {selected_protocol_ids}")
        print(f"Reference pairs: {reference_pairs}")
        print(f"Reference files: {[{k: v for k, v in pair.items() if k.endswith('_name')} for pair in reference_data]}")
        
        # Validate required inputs
        if not experimental_file:
            return jsonify({'status': 'error', 'message': 'Experimental data file is required'})
        
        if not selected_purpose:
            return jsonify({'status': 'error', 'message': 'Protocol purpose selection is required'})
        
        if not protocol_file and not selected_features:
            return jsonify({'status': 'error', 'message': 'Either protocol file or feature selection is required'})
        
        # Preprocess main files
        protocol_data = None
        if protocol_file:
            protocol_path = os.path.join(temp_dir, protocol_file.filename)
            protocol_file.save(protocol_path)
            protocol_data = {
                'path': protocol_path,
                'name': protocol_file.filename
            }
        
        experimental_path = os.path.join(temp_dir, experimental_file.filename)
        experimental_file.save(experimental_path)
        experimental_data = {
            'path': experimental_path,
            'name': experimental_file.filename
        }
        
        # Process the data and generate results
        try:
            results = process_benchmark_data(
                protocol_data=protocol_data,
                experimental_data=experimental_data,
                selected_features=selected_features,
                selected_purpose=selected_purpose,
                selected_protocol_ids=selected_protocol_ids,
                reference_data=reference_data
            )
            return jsonify(results)
        except Exception as e:
            app.logger.error(f"Error processing benchmark: {str(e)}")
            import traceback
            app.logger.error(traceback.format_exc())
            return jsonify({
                'status': 'error',
                'message': f'Error processing benchmark: {str(e)}'
            })
        
    except Exception as e:
        app.logger.error(f"Error in submit_benchmark: {str(e)}")
        import traceback
        app.logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': f'Error processing request: {str(e)}'
        })
        
    finally:
        # Clean up temporary files
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            app.logger.error(f"Error cleaning up temporary files: {e}")


def process_benchmark_data(protocol_data, experimental_data, selected_features, selected_purpose, 
                         selected_protocol_ids, reference_data):
    """
    Process the benchmark data and return results.
    
    Args:
        protocol_data: Dictionary with protocol file path and name, or None if features selected
        experimental_data: Dictionary with experimental file path and name
        selected_features: List of selected features (used if protocol_data is None)
        selected_purpose: The selected protocol purpose
        selected_protocol_ids: List of database protocol IDs to compare against
        reference_data: List of dictionaries with reference protocol and data info
        
    Returns:
        List with benchmark results
    """
    # Get all feature candidates
    c_candidates = get_candidates()
    target_feature_dict = get_target_feature_dict(DATASET_PATHS['odds_filepath'])
    
    # Load binary features dataframe
    binary_df = get_binary_df(DATASET_PATHS['binary_filepath'])
    
    # 1. Process User's experimental data
    main_data = getUserData(experimental_data['path'])
    
    # 2. Process User's protocol - either from file or selected features        
    if protocol_data:
        # User uploaded a protocol file
        main_features = getUserProtocolFeatures(protocol_data['path'], c_candidates)
    else:
        # User selected features from dropdown
        main_features = selected_features

    # 3. Process main protocol data
    main_protocol_name, main_results_by_indicator = process_maturity_indicators(main_data, main_features, target_feature_dict)
    
    # 4. Initialize results structure
    main_results = (main_protocol_name, main_results_by_indicator)
    
    print('-------------- MAIN IS DONE\n\n\n')


    # Reference data
    reference_results = []

    # 5. Process purpose-based reference data
    indicators = ['Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)', 
                 'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
                 'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)', 
                 'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)', 
                 'Conduction Velocity from Calcium Imaging (cm/s)', 
                 'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)', 
                 'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
                 'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)', 
                 'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TNNI1)']
    
    PurposeData = {'ProtocolName': f'{selected_purpose} Protocols'}
    # Add empty values for all indicators
    for indicator in indicators:
        PurposeData[indicator] = ''
        
    # Get target feature dictionary to retrieve purpose features
    target_feature_dict = get_target_feature_dict(DATASET_PATHS['odds_filepath'])
    
    # Get features associated with selected purpose
    if selected_purpose in target_feature_dict:
        PurposeFeatures = target_feature_dict[selected_purpose]
    else:
        PurposeFeatures = []  # Default to empty list if purpose not found
        
    PurposeProtocolName, PurposeQResultsByIndicator = process_maturity_indicators(PurposeData, PurposeFeatures, target_feature_dict)

    # Add purpose reference to results
    reference_results.append((PurposeProtocolName, PurposeQResultsByIndicator))
    

    print('-------------- PURPOSE IS DONE\n\n\n')

    # 6. Process user-uploaded reference pairs
    for ref_data in reference_data:
        ProtocolPath, DataPath = ref_data['protocol_path'], ref_data['data_path']
        RefData = getUserData(DataPath)
        RefFeatures = getUserProtocolFeatures(ProtocolPath, c_candidates)

        RefProtocolName, RefQResultsByIndicator = process_maturity_indicators(RefData, RefFeatures, target_feature_dict)
        reference_results.append((RefProtocolName, RefQResultsByIndicator))
    
    # 7. Process database protocol comparisons
    cleaned_df = get_cleaned_df(DATASET_PATHS['cleaned_database_filepath'])
    
    for protocol_id in selected_protocol_ids:
        # Adjust indices as needed (binary df is 0-indexed, cleaned might be 1-indexed)
        try:
            index_for_binary = int(protocol_id) - 1
            index_for_cleaned = int(protocol_id)
            
            # Get features from binary dataframe
            filtered_b_row = binary_df.loc[index_for_binary, c_candidates]
            IDRefFeatures = [col for col, val in filtered_b_row.items() if val]
            
            # Get experimental data from cleaned dataframe
            filtered_c_row = cleaned_df.loc[index_for_cleaned, indicators]
            IDRefData = {'ProtocolName': f'Protocol {protocol_id}'}
            
            for indicator in indicators:
                if indicator in filtered_c_row and not pd.isna(filtered_c_row[indicator]) and str(filtered_c_row[indicator]) != "nan":
                    if indicator == 'T-tubule Structure (Found)':
                        IDRefData[indicator] = '1'
                    else:
                        IDRefData[indicator] = str(filtered_c_row[indicator])
                else:
                    IDRefData[indicator] = ""

            IDRefProtocolName, IDRefQResultsByIndicator = process_maturity_indicators(IDRefData, IDRefFeatures, target_feature_dict)
            reference_results.append((IDRefProtocolName, IDRefQResultsByIndicator))
        except Exception as e:
            app.logger.error(f"Error processing protocol ID {protocol_id}: {str(e)}")
            continue
    
    # Return all results as a list, starting with the main results, followed by reference results
    all_results = [(main_protocol_name, main_results_by_indicator)] + reference_results
    
    return all_results

# ----- Web Routes -----
@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html',
        FeatureCategories=FeatureCategories_dict.keys(),
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

# Changes to other files like html and css require:
# sudo systemctl daemon-reload
# sudo systemctl restart flaskapp