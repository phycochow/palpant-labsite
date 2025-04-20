from flask import Flask, render_template, jsonify, request
import os, csv
from collections import defaultdict
import pandas as pd
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

# Configure logger to INFO (console only)
app.logger.setLevel(logging.INFO)
app.logger.info('Flask application startup')

# ----- Preset databases -----
# SearchTab - Target parameter findings (for left panel)
target_param_filepath = os.path.join(app.static_folder, 'datasets/0_TargetParameters_12Apr25.csv')
# enrichmentByLabel 
# SearchTab - Feature categories (for right panel)
feature_categories_filepath = os.path.join(app.static_folder, 'datasets/0_FeatureCategories_01Mar25.csv')
# EnrichmentTab
enrich_filepath = os.path.join(app.static_folder, 'datasets/1_PermutatedImportancesTRUE_20Apr25.csv')
# ViewerTab
cleaned_database_filepath = os.path.join(app.static_folder, 'datasets/0_CleanedDatabase_25Feb25.csv')

# Initialize dictionaries for each dataset
FeatureCategories_dict = defaultdict(list)
TargetParameters_dict = defaultdict(list)

try:
    # Load feature categories (for right panel)
    with open(feature_categories_filepath, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, value in row.items():
                FeatureCategories_dict[key].append(value)
    FeatureCategories_dict = dict(FeatureCategories_dict)
    app.logger.info('Successfully loaded feature categories')
    
    # Load target parameter findings (for left panel)
    with open(target_param_filepath, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, value in row.items():
                TargetParameters_dict[key].append(value)
    TargetParameters_dict = dict(TargetParameters_dict)
    app.logger.info('Successfully loaded target parameter findings')
except Exception as e:
    app.logger.error(f'Error loading data files: {str(e)}')

try:
    cleaned_df = pd.read_csv(cleaned_database_filepath)
    cleaned_df = cleaned_df.fillna("NaN")
    app.logger.info(f'Successfully loaded database with {len(cleaned_df)} records')
except Exception as e:
    app.logger.error(f'Error loading cleaned database: {str(e)}')
    cleaned_df = pd.DataFrame()  # empty fallback

# Load enrichment data
try:
    enrichment_df = pd.read_csv(enrich_filepath)
    enrichment_df = enrichment_df.fillna('')
    app.logger.info(f'Successfully loaded enrichment data with {len(enrichment_df)} records')
except Exception as e:
    app.logger.error(f'Error loading enrichment data: {str(e)}')
    enrichment_df = pd.DataFrame()  # empty fallback

@app.route('/api/enrichment_data', methods=['GET'])
def get_enrichment_data():
    """
    Serve the enrichment CSV as JSON, optionally filtered by a selected parameter:
      - data: list of row‐dicts
      - columns: list of column names
    """
    if enrichment_df.empty:
        return jsonify({'error': 'Enrichment data not available'}), 404

    # optionally filter by 'Target Label'
    selected_label = request.args.get('parameter', None)
    df = enrichment_df
    if selected_label:
        df = df[df['Target Label'] == selected_label]

    data = df.to_dict(orient='records')
    return jsonify({
        'data': data,
        'columns': list(df.columns)
    })


# ----- bridge from python to html -----
@app.route('/api/viewer')
def api_viewer():
    try:
        return jsonify({
            'data': cleaned_df.to_dict(orient='records'),
            'columns': cleaned_df.columns.tolist()
        })
    except Exception as e:
        app.logger.error(f'Error in api_viewer: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_ProtocolFeatures', methods=['POST'])
def get_ProtocolFeatures():
    try:
        selected_key = request.form['selected_key']
        values = FeatureCategories_dict.get(selected_key, [])
        return jsonify(values=values)
    except Exception as e:
        app.logger.error(f'Error in get_ProtocolFeatures: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_TargetParameters', methods=['POST'])
def get_TargetParameters():
    try:
        selected_key = request.form['selected_key']
        values = TargetParameters_dict.get(selected_key, [])
        return jsonify(values=values)
    except Exception as e:
        app.logger.error(f'Error in get_TargetParameters: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit_features', methods=['POST'])
def submit_features():
    try:
        parameter = request.form.get('parameter', '')
        features = request.form.getlist('selected_features[]')
        result = {
            'status': 'success',
            'data': {
                'parameter': parameter,
                'selected_features': features
            }
        }
        app.logger.info(f"Feature submission: Parameter={parameter}, Features={features}")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f'Error in submit_features: {str(e)}')
        return jsonify({'status': 'error', 'data': {'message': str(e)}}), 500

@app.route('/api/filter_features', methods=['POST'])
def filter_features():
    try:
        features = request.form.getlist('filter_features[]')
        result = {
            'status': 'success',
            'data': {'filtered_features': features}
        }
        app.logger.info(f"Filter features: {features}")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f'Error in filter_features: {str(e)}')
        return jsonify({'status': 'error', 'data': {'message': str(e)}}), 500

@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html',
                          FeatureCategories=FeatureCategories_dict.keys(),
                          TargetParameters=TargetParameters_dict.keys())

@app.route('/dash')
def dash():
    return render_template('dashboard.html')

@app.route('/test')
def test():
    return render_template('testcase.html',
                          FeatureCategories=FeatureCategories_dict.keys(),
                          TargetParameters=TargetParameters_dict.keys())

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
