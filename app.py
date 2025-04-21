from flask import Flask, render_template, jsonify, request
import os, csv
from collections import defaultdict

app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# ----- Preset databases -----
DATA_DIR        = os.path.join(app.static_folder, 'datasets')
TARGET_PARAMS   = os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv')
FEATURE_CATS    = os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv')
ENRICH_CSV      = os.path.join(DATA_DIR, '1_PermutatedImportancesTRUE_20Apr25.csv')
VIEWER_CSV      = os.path.join(DATA_DIR, '0_CleanedDatabase_25Feb25.csv')

# Load the *small* lookup tables into memory (these are tiny)
FeatureCategories_dict = defaultdict(list)
TargetParameters_dict  = defaultdict(list)

for path, store, name in [
    (FEATURE_CATS, FeatureCategories_dict, 'feature categories'),
    (TARGET_PARAMS, TargetParameters_dict,  'target parameters')
]:
    try:
        with open(path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # accumulate each column's values
                for key, val in row.items():
                    store[key].append(val)
        app.logger.info(f'Successfully loaded {name}')
    except FileNotFoundError:
        app.logger.error(f'Could not find {name} file at {path}')
    except Exception as e:
        app.logger.error(f'Error loading {name}: {e}')

@app.route('/api/enrichment_data')
def get_enrichment_data():
    """
    Stream-filter the enrichment CSV by Target Label.
    Only rows matching ?parameter=... are returned.
    """
    selected = request.args.get('parameter')
    try:
        with open(ENRICH_CSV, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            out = []
            for row in reader:
                if not selected or row.get('Target Label') == selected:
                    out.append(row)
            return jsonify({
                'data':    out,
                'columns': reader.fieldnames
            })
    except FileNotFoundError:
        return jsonify({'error': 'Enrichment dataset not found'}), 404
    except Exception as e:
        app.logger.error(f'Error in enrichment_data: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/viewer')
def api_viewer():
    """
    Stream the entire cleaned database CSV.
    """
    try:
        with open(VIEWER_CSV, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            out = [row for row in reader]
            return jsonify({
                'data':    out,
                'columns': reader.fieldnames
            })
    except FileNotFoundError:
        return jsonify({'error': 'Viewer dataset not found'}), 404
    except Exception as e:
        app.logger.error(f'Error in api_viewer: {e}')
        return jsonify({'error': str(e)}), 500

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
    parameter = request.form.get('parameter','')
    features  = request.form.getlist('selected_features[]')
    return jsonify({
        'status':'success',
        'data': {
            'parameter': parameter,
            'selected_features': features
        }
    })

@app.route('/api/filter_features', methods=['POST'])
def filter_features():
    features = request.form.getlist('filter_features[]')
    return jsonify({
        'status':'success',
        'data': {'filtered_features': features}
    })

@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html',
        FeatureCategories=FeatureCategories_dict.keys(),
        TargetParameters= TargetParameters_dict.keys()
    )

@app.route('/dash')
def dash():
    return render_template('dashboard.html')

@app.route('/test')
def test():
    return render_template('testcase.html',
        FeatureCategories=FeatureCategories_dict.keys(),
        TargetParameters= TargetParameters_dict.keys()
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
