from flask import Flask, render_template, jsonify, request
import os
import json
import numpy as np
import pandas as pd
import gc
import logging
import csv
from PyPDF2 import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# Import from local modules
from data_manager import (
    load_lookup_tables,
    load_viewer_data,
    load_enrichment_data,
    get_search_table,
    clear_memory_cache
)
from utils import (
    NpEncoder, 
    getUserProtocolFeatures, 
    getUserData, 
    process_maturity_indicators
)

app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# ----- Preset databases -----
DATA_DIR = os.path.join(app.static_folder, 'datasets')
target_param_filepath = os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv')
feature_categories_filepath = os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv')
enrich_filepath = os.path.join(DATA_DIR, '1_PermutatedImportancesTRUE_02May25.csv')
cleaned_database_filepath = os.path.join(DATA_DIR, '0_CleanedDatabase_25Feb25.csv')
binary_filepath = os.path.join(DATA_DIR, '1_BinaryFeatures_25Feb25.csv')
odds_filepath = os.path.join(DATA_DIR, '1_PositiveOddsEnrichments_03May25.csv')

# Load lookup tables at startup
FeatureCategories_dict, TargetParameters_dict = load_lookup_tables(
    feature_categories_filepath, target_param_filepath
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
    enrichment_data, enrichment_columns = load_enrichment_data(enrich_filepath)
    
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
    viewer_data, viewer_columns = load_viewer_data(cleaned_database_filepath)
    
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
            binary_filepath=binary_filepath,
            cleaned_database_filepath=cleaned_database_filepath,
            odds_filepath=odds_filepath,
            feature_categories_filepath=feature_categories_filepath,
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
    Process a benchmark submission with protocol, experimental data, and references.
    """
    # Call the process_benchmark_submission function with request data and files
    result = process_benchmark_submission(request.form, request.files)
    
    # If the result contains an error status, return it as is
    if result.get('status') == 'error':
        return jsonify(result)
    
    # Otherwise, return the successful result
    return jsonify(result)


def process_benchmark_submission(request_data, request_files):
    """
    Process user's benchmark submission with all components in a single function.
    
    Parameters:
    - request_data: Form data from the request
    - request_files: File uploads from the request
    
    Returns:
    - Dictionary with processed benchmark results
    """
    try:
        # Initialize variables
        protocol_features = []
        user_protocol_name = "Custom Protocol"
        reference_results = []
        db_protocol_results = []
        
        # Retrieve causal candidates (all possible features)
        causal_candidates = [
            "hiPSC Matrix Coating - EBs (18)", "hiPSC Matrix Coating - Geltrex (33)", 
            "hiPSC Matrix Coating - Matrigel (163)", "hiPSC Matrix Coating - MEF feeder cells (8)",
            # ... add all the other candidates here ... 
            "3D Endothelial Cell Source - Cardiac Microvascular EndothelialC (5)"
        ]
        
        # 1. PROCESS USER'S PROTOCOL (either uploaded file or selected features)
        if 'protocol_file' in request_files and request_files['protocol_file'].filename:
            # Extract features from uploaded protocol PDF
            protocol_file = request_files['protocol_file']
            protocol_features = getUserProtocolFeatures(protocol_file, causal_candidates)
        else:
            # Use manually selected features from form
            protocol_features = request_data.getlist('selected_features[]')
        
        # 2. PROCESS USER'S EXPERIMENTAL DATA (required)
        if 'experimental_file' not in request_files or not request_files['experimental_file'].filename:
            return {
                'status': 'error',
                'message': 'Experimental data file is required.'
            }
        
        experimental_file = request_files['experimental_file']
        user_data = getUserData(experimental_file)
        
        # 3. GET SELECTED PURPOSE (required)
        selected_purpose = request_data.get('selected_purpose', '')
        if not selected_purpose:
            return {
                'status': 'error',
                'message': 'Protocol purpose selection is required.'
            }
        
        # 4. PROCESS MATURITY INDICATORS FOR USER'S PROTOCOL
        protocol_name, results_dict = process_maturity_indicators(user_data, protocol_features)
        if protocol_name and protocol_name != "Unnamed Protocol":
            user_protocol_name = protocol_name
        
        # 5. PROCESS PURPOSE-BASED REFERENCE
        # Create empty template for all indicators
        purpose_data = {'ProtocolName': f'{selected_purpose} Protocols'}
        for indicator in [
            'Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)',
            'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
            'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)',
            'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)',
            'Conduction Velocity from Calcium Imaging (cm/s)', 
            'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)',
            'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
            'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)',
            'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TTNI1)'
        ]:
            purpose_data[indicator] = ''
        
        # Get features for the selected purpose
        target_feature_dict = get_target_feature_dict(odds_filepath)
        if selected_purpose in target_feature_dict:
            purpose_features = target_feature_dict[selected_purpose]
            purpose_name, purpose_results = process_maturity_indicators(purpose_data, purpose_features)
            
            # Add to reference results
            reference_results.append({
                'id': 'purpose',
                'name': purpose_name or selected_purpose,
                'results': purpose_results
            })
        
        # 6. PROCESS USER UPLOADED REFERENCE PAIRS
        reference_pairs = json.loads(request_data.get('reference_pairs', '[]')) if 'reference_pairs' in request_data else []
        
        for i, pair in enumerate(reference_pairs):
            if 'protocol' in pair and 'data' in pair:
                ref_protocol_key = f"ref_protocol_{i}"
                ref_data_key = f"ref_data_{i}"
                
                if ref_protocol_key in request_files and ref_data_key in request_files:
                    ref_protocol_file = request_files[ref_protocol_key]
                    ref_data_file = request_files[ref_data_key]
                    
                    # Process reference protocol and data
                    ref_features = getUserProtocolFeatures(ref_protocol_file, causal_candidates)
                    ref_data = getUserData(ref_data_file)
                    ref_name, ref_results = process_maturity_indicators(ref_data, ref_features)
                    
                    # Add to reference results
                    reference_results.append({
                        'id': f"ref_{i}",
                        'name': ref_name or f"Reference {i+1}",
                        'results': ref_results
                    })
        
        # 7. PROCESS DATABASE PROTOCOL IDS
        selected_protocol_ids = request_data.getlist('selected_protocol_ids[]')
        if selected_protocol_ids:
            # Load necessary dataframes
            binary_df = get_binary_df(binary_filepath)
            cleaned_df = get_cleaned_df(cleaned_database_filepath)
            
            for protocol_id in selected_protocol_ids:
                # Convert ID to indices (accounting for 0-based indexing)
                try:
                    binary_index = int(protocol_id) - 1
                    cleaned_index = binary_index + 1  # Adjust as needed based on your data structure
                    
                    # Get protocol features from binary dataframe
                    binary_row = binary_df.iloc[binary_index]
                    db_features = [col for col in causal_candidates if binary_row.get(col, False)]
                    
                    # Get protocol name from cleaned dataframe
                    title = cleaned_df.iloc[cleaned_index]['Title'] if 'Title' in cleaned_df.columns else f"Protocol ID: {protocol_id}"
                    
                    # Create empty indicator data
                    db_data = {'ProtocolName': title}
                    
                    # Check for experimental values in the cleaned dataframe
                    indicators = [
                        'Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)',
                        'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
                        'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)',
                        'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)',
                        'Conduction Velocity from Calcium Imaging (cm/s)', 
                        'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)',
                        'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
                        'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)',
                        'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TTNI1)'
                    ]
                    
                    for indicator in indicators:
                        if indicator in cleaned_df.columns:
                            value = cleaned_df.iloc[cleaned_index][indicator]
                            # Only add non-NaN experimental values
                            db_data[indicator] = str(value) if pd.notna(value) else ''
                        else:
                            db_data[indicator] = ''
                    
                    # Process the database protocol
                    db_name, db_results = process_maturity_indicators(db_data, db_features)
                    
                    # Add to database results
                    db_protocol_results.append({
                        'id': protocol_id,
                        'name': db_name or title,
                        'results': db_results
                    })
                except Exception as e:
                    app.logger.error(f"Error processing protocol ID {protocol_id}: {str(e)}")
        
        # 8. PREPARE FINAL RESPONSE
        response_data = {
            'status': 'success',
            'protocol_name': user_protocol_name,
            'selected_purpose': selected_purpose,
            'results': results_dict,
            'reference_results': reference_results,
            'db_protocol_results': db_protocol_results
        }
        
        return response_data
        
    except Exception as e:
        app.logger.error(f"Error in process_benchmark_submission: {str(e)}")
        return {
            'status': 'error',
            'message': f'Error processing benchmark: {str(e)}'
        }

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
