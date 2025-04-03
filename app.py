from flask import Flask, render_template, jsonify, request  # Added the missing request import
import database
import os, csv
from collections import defaultdict
import pandas as pd

app = Flask(__name__)

# ----- Preset databases -----
csv_filepath = os.path.join(app.static_folder, 'datasets/0_FeatureCategories_01Mar25.csv')

FeatureCategories_dict = defaultdict(list)

with open(csv_filepath, mode='r', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        for key, value in row.items():
            FeatureCategories_dict[key].append(value)

FeatureCategories_dict = dict(FeatureCategories_dict)

cleaned_df = pd.read_csv(os.path.join(app.static_folder, 'datasets/0_CleanedDatabase_25Feb25.csv'))
cleaned_df = cleaned_df.fillna("NaN")


# ----- bridge from python to html -----
# API endpoints for AJAX calls - for table
@app.route('/api/viewer')
def api_viewer():
    # Convert DataFrame to records but also send column names in order
    return jsonify({
        'data': cleaned_df.to_dict(orient='records'),
        'columns': cleaned_df.columns.tolist()
    })

# Code for dropdown menu
@app.route('/api/get_ProtocolFeatures', methods=['POST'])
def get_ProtocolFeatures():
    # Get the selected key from the AJAX request
    selected_key = request.form['selected_key']
    
    # Get the corresponding values for the selected key
    values = FeatureCategories_dict.get(selected_key, [])
    
    # Return the values as JSON
    return jsonify(values=values)

# Handle feature submissions
@app.route('/api/submit_features', methods=['POST'])
def submit_features():
    category = request.form.get('category', '')
    # Get all selected features (multiple values with the same name)
    features = request.form.getlist('features[]')
    
    # You can process the submitted data here
    # For example, save to database, generate a file, etc.
    
    # For now, just return the data as confirmation
    result = {
        'status': 'success',
        'message': 'Features submitted successfully',
        'data': {
            'category': category,
            'selected_features': features,
            'count': len(features)
        }
    }
    
    # Log the submission for debugging
    print(f"Feature submission received: {category} - {features}")
    
    return jsonify(result)

# ----- Actual webpage rendering -----
@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html')

@app.route('/dash')
def dash():
    return render_template('dashboard.html')

@app.route('/test')
def test():
    return render_template('testcase.html', FeatureCategories=FeatureCategories_dict.keys())

if __name__ == '__main__':
    # Development server only – not used in production
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
