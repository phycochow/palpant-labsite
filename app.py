from flask import Flask, render_template, jsonify, request
import os
import json
import numpy as np
import pandas as pd
import gc
import logging

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
from utils import NpEncoder

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
