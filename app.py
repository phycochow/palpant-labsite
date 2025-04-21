from flask import Flask, render_template, jsonify, request
import os, csv
import pandas as pd
from collections import defaultdict

app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# ----- Preset databases -----
DATA_DIR        = os.path.join(app.static_folder, 'datasets')
target_param_filepath     = os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv')
feature_categories_filepath = os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv')
enrich_filepath           = os.path.join(DATA_DIR, '1_PermutatedImportancesTRUE_20Apr25.csv')
cleaned_database_filepath = os.path.join(DATA_DIR, '0_CleanedDatabase_25Feb25.csv')

# ----- Load small lookup tables into memory -----
FeatureCategories_dict = defaultdict(list)
TargetParameters_dict  = defaultdict(list)

try:
    with open(feature_categories_filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, val in row.items():
                FeatureCategories_dict[key].append(val)
    app.logger.info('Successfully loaded feature categories')
    
    with open(target_param_filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, val in row.items():
                TargetParameters_dict[key].append(val)
    app.logger.info('Successfully loaded target parameter findings')
except Exception as e:
    app.logger.error(f'Error loading lookup tables: {e}')

# ----- Load larger CSVs once, convert to plain lists, then drop DataFrames -----
try:
    _df = pd.read_csv(cleaned_database_filepath)
    _df = _df.fillna("NaN")
    viewer_data = _df.to_dict(orient='records')
    viewer_columns = _df.columns.tolist()
    del _df
    app.logger.info(f'Loaded cleaned database: {len(viewer_data)} rows')
except Exception as e:
    app.logger.error(f'Error loading cleaned database: {e}')
    viewer_data = []
    viewer_columns = []

try:
    _df = pd.read_csv(enrich_filepath)
    _df = _df.fillna('')
    enrichment_data = _df.to_dict(orient='records')
    enrichment_columns = _df.columns.tolist()
    del _df
    app.logger.info(f'Loaded enrichment data: {len(enrichment_data)} rows')
except Exception as e:
    app.logger.error(f'Error loading enrichment data: {e}')
    enrichment_data = []
    enrichment_columns = []

@app.route('/api/enrichment_data', methods=['GET'])
def get_enrichment_data():
    """
    Serve the enrichment records, optionally filtered by ?parameter=...
    """
    if not enrichment_data:
        return jsonify({'error': 'Enrichment data not available'}), 404

    selected_label = request.args.get('parameter')
    if selected_label:
        filtered = [r for r in enrichment_data if r.get('Target Label') == selected_label]
    else:
        filtered = enrichment_data

    return jsonify({
        'data':    filtered,
        'columns': enrichment_columns
    })

@app.route('/api/viewer')
def api_viewer():
    """
    Serve the entire cleaned database as JSON
    """
    if not viewer_data:
        return jsonify({'error': 'Viewer data not available'}), 404

    return jsonify({
        'data':    viewer_data,
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
    # existing form fields
    parameter     = request.form.get('parameter', '')
    features      = request.form.getlist('selected_features[]')
    
    # new: pull in the toggle_states[] values (strings "true"/"false")
    raw_states    = request.form.getlist('toggle_states[]')
    # optional: convert them to real Python bools
    toggle_states = [s.lower() == 'true' for s in raw_states]

    return jsonify({
        'status': 'success',
        'data': {
            'parameter': parameter,
            'selected_features': features
        },
        'toggle_states': toggle_states
    })

@app.route('/api/filter_features', methods=['POST'])
def filter_features():
    features = request.form.getlist('filter_features[]')
    return jsonify({
        'status': 'success',
        'data': {'filtered_features': features}
    })

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
