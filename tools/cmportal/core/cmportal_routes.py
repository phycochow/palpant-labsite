"""
CMPortal Routes Module
Contains all routes and logic for the CMPortal dashboard tool
"""

from flask import render_template, jsonify, request, current_app
import os
import json
import numpy as np
import pandas as pd
import tempfile
import shutil
import traceback
import threading
import time
from werkzeug.utils import secure_filename

# Import CMPortal-specific modules
from tools.cmportal.core.cmportal_config import DATASET_PATHS, UPLOAD_FOLDER, MAX_CONTENT_LENGTH
from tools.cmportal.core.cmportal_data_manager import (
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
from tools.cmportal.core.cmportal_utils import (
    NpEncoder,
    getUserProtocolFeatures,
    getUserData,
    process_maturity_indicators
)

# Global variables for CMPortal
_benchmark_results_cache = {}
FeatureCategories_dict = {}
TargetParameters_dict = {}
CausalFeatureCategories_dict = {}


def register_cmportal_routes(app):
    """
    Register all CMPortal routes with the Flask app
    """
    
    # Set upload folder and max content length
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    
    # Ensure uploads directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Load lookup tables at startup
    global FeatureCategories_dict, TargetParameters_dict, CausalFeatureCategories_dict
    FeatureCategories_dict, TargetParameters_dict, CausalFeatureCategories_dict = load_lookup_tables(
        DATASET_PATHS['feature_categories_filepath'],
        DATASET_PATHS['target_param_filepath'],
        DATASET_PATHS['causal_feature_categories_filepath']
    )
    
    # Start background cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_temp_files, daemon=True)
    cleanup_thread.start()
    
    # ===== Page Routes =====
    
    @app.route('/cmportal')
    def cmportal():
        """Main CMPortal dashboard page"""
        return render_template('cmportal.html',
            FeatureCategories=FeatureCategories_dict.keys(),
            CausalFeatureCategories=CausalFeatureCategories_dict.keys(),
            TargetParameters=TargetParameters_dict.keys()
        )
    
    @app.route('/dash')
    def dash():
        """Dashboard base page"""
        return render_template('dashboard.html')
    
    # ===== API Routes =====
    
    @app.route('/api/enrichment_data', methods=['GET'])
    def get_enrichment_data():
        """Serve enrichment records, optionally filtered by parameter"""
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
        """Serve the entire cleaned database as JSON"""
        viewer_data, viewer_columns = load_viewer_data(DATASET_PATHS['cleaned_database_filepath'])
        
        if not viewer_data:
            return jsonify({'error': 'Viewer data not available'}), 404

        return jsonify({
            'data': viewer_data,
            'columns': viewer_columns
        })
    
    @app.route('/api/get_ProtocolFeatures', methods=['POST'])
    def get_ProtocolFeatures():
        """Get protocol features by category key"""
        key = request.form.get('selected_key', '')
        return jsonify(values=FeatureCategories_dict.get(key, []))
    
    @app.route('/api/get_TargetParameters', methods=['POST'])
    def get_TargetParameters():
        """Get target parameters by category key"""
        key = request.form.get('selected_key', '')
        return jsonify(values=TargetParameters_dict.get(key, []))
    
    @app.route('/api/get_CausalFeatures', methods=['POST'])
    def get_CausalFeatures():
        """Get causal features by category key"""
        key = request.form.get('selected_key', '')
        return jsonify(values=CausalFeatureCategories_dict.get(key, []))
    
    @app.route('/api/submit_features', methods=['POST'])
    def submit_features():
        """Handle feature search form submission"""
        # Get form fields
        parameter = request.form.get('parameter', '')
        features = request.form.getlist('selected_features[]')
        explicit_mode = request.form.get('mode', '')
        
        # Determine search mode
        if explicit_mode:
            mode = explicit_mode
        else:
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
        
        # Validate mode-specific requirements
        if mode == 'normal' and not features:
            return jsonify({'status': 'error', 'message': 'Normal mode requires at least one feature.'})
        if mode == 'enrichment' and not parameter:
            return jsonify({'status': 'error', 'message': 'Enrichment mode requires a target topic.'})
        if mode == 'combined' and (not parameter or not features):
            return jsonify({'status': 'error', 'message': 'Combined mode requires both topic and features.'})
        
        # Get toggle states
        raw_states = request.form.getlist('toggle_states[]')
        toggle_states = [s.lower() == 'true' for s in raw_states]
        
        try:
            # Get search results
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
            
            # Check if empty
            if result_table.empty:
                error_msg = 'No results found. '
                if mode == 'normal':
                    error_msg += 'Try fewer features.'
                elif mode == 'enrichment':
                    error_msg += 'Try a different topic.'
                else:
                    error_msg += 'Try fewer constraints.'
                
                return jsonify({'status': 'error', 'message': error_msg})
            
            # Serialize results
            result_table = result_table.replace({np.nan: None})
            result_data = json.loads(json.dumps(result_table.to_dict(orient='records'), cls=NpEncoder))
            result_columns = result_table.columns.tolist()
            
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
            
            return app.response_class(
                response=json.dumps(response, cls=NpEncoder),
                status=200,
                mimetype='application/json'
            )
        except Exception as e:
            app.logger.error(f"Error in submit_features: {e}")
            return jsonify({'status': 'error', 'message': f'Error processing request: {str(e)}'})
    
    @app.route('/api/filter_features', methods=['POST'])
    def filter_features():
        """Filter features endpoint"""
        features = request.form.getlist('filter_features[]')
        return jsonify({'status': 'success', 'data': {'filtered_features': features}})
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        """Handle file size exceeded error"""
        return jsonify({
            'status': 'error',
            'message': 'File too large. Maximum allowed size is 5MB per file.'
        }), 413

    @app.route('/api/submit_benchmark', methods=['POST'])
    def submit_benchmark():
        """
        Handle benchmark form submission with file uploads or database protocol selection
        """
        temp_dir = None

        try:
            # Get form data
            protocol_file = request.files.get('protocol_file')
            experimental_file = request.files.get('experimental_file')
            selected_purpose = request.form.get('selected_purpose')
            selected_protocol_ids = request.form.getlist('selected_protocol_ids[]')
            selected_own_protocol_id = request.form.get('selected_own_protocol_id')

            # Validate inputs
            if not protocol_file and not selected_own_protocol_id:
                return jsonify({'status': 'error', 'message': 'Protocol file or database selection required'})

            if not selected_purpose:
                return jsonify({'status': 'error', 'message': 'Protocol purpose selection is required'})

            if not selected_own_protocol_id and protocol_file and not experimental_file:
                return jsonify({'status': 'error', 'message': 'Experimental data file required when uploading protocol'})

            # Create temporary directory
            temp_dir = tempfile.mkdtemp(prefix="benchmark_")
            app.logger.info(f"Created temporary directory: {temp_dir}")

            # Process protocol file
            protocol_data = None
            if protocol_file:
                protocol_filename = secure_filename(protocol_file.filename)
                protocol_path = os.path.join(temp_dir, protocol_filename)
                protocol_file.save(protocol_path)
                protocol_data = {'path': protocol_path, 'name': protocol_filename}

            # Process experimental file
            experimental_data = None
            if experimental_file:
                experimental_filename = secure_filename(experimental_file.filename)
                experimental_path = os.path.join(temp_dir, experimental_filename)
                experimental_file.save(experimental_path)
                experimental_data = {'path': experimental_path, 'name': experimental_filename}

            # Process reference pairs (optional)
            reference_data = []
            ref_protocol_files = request.files.getlist('reference_protocol_files[]')
            ref_experimental_files = request.files.getlist('reference_experimental_files[]')

            for ref_protocol, ref_experimental in zip(ref_protocol_files, ref_experimental_files):
                if ref_protocol and ref_experimental:
                    ref_protocol_filename = secure_filename(ref_protocol.filename)
                    ref_experimental_filename = secure_filename(ref_experimental.filename)

                    ref_protocol_path = os.path.join(temp_dir, ref_protocol_filename)
                    ref_experimental_path = os.path.join(temp_dir, ref_experimental_filename)

                    ref_protocol.save(ref_protocol_path)
                    ref_experimental.save(ref_experimental_path)

                    reference_data.append({
                        'protocol_path': ref_protocol_path,
                        'data_path': ref_experimental_path
                    })

            # Process benchmark data
            try:
                results = process_benchmark_data(
                    protocol_data=protocol_data,
                    experimental_data=experimental_data,
                    selected_purpose=selected_purpose,
                    selected_protocol_ids=selected_protocol_ids,
                    reference_data=reference_data,
                    selected_own_protocol_id=selected_own_protocol_id
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
            # Always clean up temporary files
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    app.logger.info(f"Cleaned up temporary directory: {temp_dir}")
                except Exception as e:
                    app.logger.error(f"Error cleaning up {temp_dir}: {e}")

    # ===== Teardown Handler =====

    @app.teardown_appcontext
    def teardown_cmportal(exception=None):
        """Clean up CMPortal resources on app shutdown"""
        global _benchmark_results_cache
        _benchmark_results_cache.clear()
        clear_memory_cache()


# ===== Helper Functions =====

def process_benchmark_data(protocol_data, experimental_data, selected_purpose,
                           selected_protocol_ids, reference_data, selected_own_protocol_id=None):
    """
    Process benchmark data and return results

    Args:
        protocol_data: Dict with protocol file path/name or None if using DB
        experimental_data: Dict with experimental file path/name or None if using DB
        selected_purpose: Selected protocol purpose
        selected_protocol_ids: List of DB protocol IDs to compare against
        reference_data: List of dicts with reference protocol/data info
        selected_own_protocol_id: Optional protocol ID selected from DB

    Returns:
        Dict with benchmark results for visualization
    """
    # Get feature candidates and load dataframes
    c_candidates = get_candidates()
    target_feature_dict = get_target_feature_dict(DATASET_PATHS['odds_filepath'])
    binary_df = get_binary_df(DATASET_PATHS['binary_filepath'])
    cleaned_df = get_cleaned_df(DATASET_PATHS['cleaned_database_filepath'])

    # Define indicators
    indicators = [
        'Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)',
        'Contractile Force (mN)', 'Contractile Stress (mN/mm2)',
        'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)',
        'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)',
        'Conduction Velocity from Calcium Imaging (cm/s)',
        'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)',
        'Resting Membrane Potential (mV)', 'Beat Rate (bpm)',
        'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)',
        'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TNNI1)'
    ]

    # Handle main protocol - either from database or uploaded file
    if selected_own_protocol_id:
        try:
            # Load from database
            index_for_binary = int(selected_own_protocol_id) - 1
            index_for_cleaned = int(selected_own_protocol_id)

            # Get features
            filtered_b_row = binary_df.loc[index_for_binary, c_candidates]
            main_features = [col for col, val in filtered_b_row.items() if val]

            # Get experimental data
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

            main_protocol_name, main_results_by_indicator = process_maturity_indicators(
                main_data, main_features, target_feature_dict
            )

        except Exception as e:
            raise Exception(f"Failed to load protocol ID {selected_own_protocol_id}: {str(e)}")
    else:
        # Process uploaded files
        if not experimental_data:
            raise Exception("Experimental data required when uploading protocol")

        main_data = getUserData(experimental_data['path'])

        if protocol_data:
            main_features = getUserProtocolFeatures(protocol_data['path'], c_candidates)
        else:
            raise Exception("Protocol data required")

        main_protocol_name, main_results_by_indicator = process_maturity_indicators(
            main_data, main_features, target_feature_dict
        )

    # Create results structure
    results = {
        'status': 'success',
        'protocol_name': main_protocol_name,
        'selected_purpose': selected_purpose,
        'results': main_results_by_indicator,
        'reference_results': [],
        'db_protocol_results': []
    }

    # Process purpose-based reference
    PurposeData = {'ProtocolName': f'Key Characteristics of {selected_purpose}'}
    for indicator in indicators:
        PurposeData[indicator] = ''

    PurposeFeatures = target_feature_dict.get(selected_purpose, [])
    PurposeProtocolName, PurposeQResultsByIndicator = process_maturity_indicators(
        PurposeData, PurposeFeatures, target_feature_dict
    )

    results['reference_results'].append({
        'name': PurposeProtocolName,
        'results': PurposeQResultsByIndicator
    })

    # Process user-uploaded reference pairs
    for ref_data in reference_data:
        RefData = getUserData(ref_data['data_path'])
        RefFeatures = getUserProtocolFeatures(ref_data['protocol_path'], c_candidates)
        RefProtocolName, RefQResultsByIndicator = process_maturity_indicators(
            RefData, RefFeatures, target_feature_dict
        )

        results['reference_results'].append({
            'name': RefProtocolName,
            'results': RefQResultsByIndicator
        })

    # Process database protocol comparisons
    for protocol_id in selected_protocol_ids:
        try:
            index_for_binary = int(protocol_id) - 1
            index_for_cleaned = int(protocol_id)

            # Get features
            filtered_b_row = binary_df.loc[index_for_binary, c_candidates]
            IDRefFeatures = [col for col, val in filtered_b_row.items() if val]

            # Get experimental data
            filtered_c_row = cleaned_df.loc[index_for_cleaned, indicators]

            protocol_name_suffix = " (Reference)" if protocol_id == selected_own_protocol_id else ""
            IDRefData = {'ProtocolName': f'Protocol {protocol_id}{protocol_name_suffix}'}

            for indicator in indicators:
                if indicator in filtered_c_row and not pd.isna(filtered_c_row[indicator]) and str(filtered_c_row[indicator]) != "nan":
                    if indicator == 'T-tubule Structure (Found)':
                        IDRefData[indicator] = '1'
                    else:
                        IDRefData[indicator] = str(filtered_c_row[indicator])
                else:
                    IDRefData[indicator] = ""

            IDRefProtocolName, IDRefQResultsByIndicator = process_maturity_indicators(
                IDRefData, IDRefFeatures, target_feature_dict
            )

            results['db_protocol_results'].append({
                'id': protocol_id,
                'name': IDRefProtocolName,
                'results': IDRefQResultsByIndicator
            })
        except Exception as e:
            current_app.logger.error(f"Error processing protocol ID {protocol_id}: {str(e)}")

    return results


def cleanup_temp_files():
    """
    Background thread to clean up old temporary files
    Runs every 20 minutes
    """
    while True:
        try:
            current_time = time.time()
            time.sleep(1200)  # 20 minutes

            current_app.logger.info("Running scheduled temp file cleanup")

            # Clean uploads directory
            if os.path.exists(UPLOAD_FOLDER):
                for filename in os.listdir(UPLOAD_FOLDER):
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    if os.path.isfile(file_path):
                        if current_time - os.path.getmtime(file_path) > 1200:
                            try:
                                os.remove(file_path)
                                current_app.logger.info(f"Deleted old upload: {filename}")
                            except Exception as e:
                                current_app.logger.error(f"Error deleting {filename}: {e}")

            # Clean temp directories
            system_temp = tempfile.gettempdir()
            if os.path.exists(system_temp):
                for dirname in os.listdir(system_temp):
                    if dirname.startswith('benchmark_'):
                        dir_path = os.path.join(system_temp, dirname)
                        if os.path.isdir(dir_path):
                            if current_time - os.path.getmtime(dir_path) > 1200:
                                try:
                                    shutil.rmtree(dir_path)
                                    current_app.logger.info(f"Deleted old temp directory: {dirname}")
                                except Exception as e:
                                    current_app.logger.error(f"Error deleting directory {dirname}: {e}")

        except Exception as e:
            if current_app:
                current_app.logger.error(f"Error in cleanup thread: {e}")
