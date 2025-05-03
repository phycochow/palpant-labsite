from flask import Flask, render_template, jsonify, request
import os, csv
import pandas as pd
import numpy as np
import json
from collections import defaultdict
import gc

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

# ----- Global dataframe holders -----
# Initialize variables that will be used later for lazy loading
_binary_df = None
_cleaned_df = None
_odds_enrichments_df = None
_categories_dict = None
_target_feature_dict = None
viewer_data = None
viewer_columns = None
enrichment_data = None
enrichment_columns = None

# ----- Load small lookup tables into memory at startup -----
FeatureCategories_dict = defaultdict(list)
TargetParameters_dict = defaultdict(list)

try:
    with open(feature_categories_filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, val in row.items():
                if val and val.strip():  # Only add non-empty values
                    FeatureCategories_dict[key].append(val)
    app.logger.info('Successfully loaded feature categories')
    
    with open(target_param_filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            for key, val in row.items():
                if val and val.strip():  # Only add non-empty values
                    TargetParameters_dict[key].append(val)
    app.logger.info('Successfully loaded target parameter findings')
except Exception as e:
    app.logger.error(f'Error loading lookup tables: {e}')

# ----- Lazy Loading Helper Functions -----
def load_viewer_data():
    """Lazy loader for viewer data"""
    global viewer_data, viewer_columns
    
    if viewer_data is None:
        try:
            _df = pd.read_csv(cleaned_database_filepath, low_memory=False)
            _df = _df.fillna("NaN")
            viewer_data = _df.to_dict(orient='records')
            viewer_columns = _df.columns.tolist()
            del _df
            gc.collect()  # Explicitly call garbage collection
            app.logger.info(f'Loaded cleaned database: {len(viewer_data)} rows')
        except Exception as e:
            app.logger.error(f'Error loading cleaned database: {e}')
            viewer_data = []
            viewer_columns = []
    
    return viewer_data, viewer_columns

def load_enrichment_data():
    """Lazy loader for enrichment data"""
    global enrichment_data, enrichment_columns
    
    if enrichment_data is None:
        try:
            _df = pd.read_csv(enrich_filepath, low_memory=False)
            _df = _df.fillna('')
            enrichment_data = _df.to_dict(orient='records')
            enrichment_columns = _df.columns.tolist()
            del _df
            gc.collect()  # Explicitly call garbage collection
            app.logger.info(f'Loaded enrichment data: {len(enrichment_data)} rows')
        except Exception as e:
            app.logger.error(f'Error loading enrichment data: {e}')
            enrichment_data = []
            enrichment_columns = []
    
    return enrichment_data, enrichment_columns

def get_binary_df():
    """Lazy loader for binary features dataframe"""
    global _binary_df
    
    if _binary_df is None:
        app.logger.info('Loading binary features dataframe')
        _binary_df = pd.read_csv(binary_filepath, low_memory=False)
    
    return _binary_df

def get_cleaned_df():
    """Lazy loader for cleaned dataframe"""
    global _cleaned_df
    
    if _cleaned_df is None:
        app.logger.info('Loading cleaned database dataframe')
        _cleaned_df = pd.read_csv(cleaned_database_filepath)
    
    return _cleaned_df

def get_categories_dict():
    """Lazy loader for categories dictionary"""
    global _categories_dict
    
    if _categories_dict is None:
        app.logger.info('Loading categories dictionary')
        categories_df = pd.read_csv(feature_categories_filepath, low_memory=False)
        _categories_dict = {col: categories_df[col].dropna().tolist() for col in categories_df.columns}
        del categories_df
        gc.collect()
    
    return _categories_dict

def get_target_feature_dict():
    """Lazy loader for enrichments dictionary"""
    global _target_feature_dict, _odds_enrichments_df
    
    if _target_feature_dict is None:
        app.logger.info('Loading enrichments dictionary')
        _odds_enrichments_df = pd.read_csv(odds_filepath, low_memory=False)
        _target_feature_dict = {col: _odds_enrichments_df[col].dropna().tolist() for col in _odds_enrichments_df.columns}
    
    return _target_feature_dict

# Free up memory when not in use
def clear_memory_cache():
    """Clear memory cache of large dataframes when not in use"""
    global _binary_df, _cleaned_df, _odds_enrichments_df, _categories_dict, _target_feature_dict
    global viewer_data, viewer_columns, enrichment_data, enrichment_columns
    
    if _binary_df is not None:
        del _binary_df
        _binary_df = None
        
    if _cleaned_df is not None:
        del _cleaned_df
        _cleaned_df = None
        
    if _odds_enrichments_df is not None:
        del _odds_enrichments_df
        _odds_enrichments_df = None
        
    if _categories_dict is not None:
        del _categories_dict
        _categories_dict = None
        
    if _target_feature_dict is not None:
        del _target_feature_dict
        _target_feature_dict = None
        
    if viewer_data is not None:
        viewer_data = None
        viewer_columns = None
        
    if enrichment_data is not None:
        enrichment_data = None
        enrichment_columns = None
        
    gc.collect()
    app.logger.info('Memory cache cleared')

# ---------- SEARCH FUNCTIONALITY ----------
def add_and_sort_by_matches(BinaryFeature_df, selected_columns, categories_dict, filter_features, filter_categories):
    """
    Rank and filter protocols based on feature matching.
    Preserves the exact behavior of the original implementation.
    """
    # Make a copy to avoid modifying the original dataframe
    df_copy = BinaryFeature_df.copy()
    
    # 1) Compute match scores
    query_mask = df_copy.columns.isin(selected_columns)
    match_selected = df_copy.loc[:, query_mask] == True
    match_non_selected = df_copy.loc[:, ~query_mask] == False
    
    matches = match_selected.sum(axis=1) + match_non_selected.sum(axis=1)
    total_conditions = df_copy.shape[1]
    percent_match = (matches / total_conditions) * 100
    
    df_copy['Protocol Similarity Rank'] = matches.rank(
                                                      method='min', ascending=False
                                                      ).astype(int)
    
    # 2) Add per-category "Feature Found" flags
    for category, category_features in categories_dict.items():
        sel_feats = set(category_features).intersection(selected_columns)
        if sel_feats:
            category_mask = df_copy.columns.isin(sel_feats)
            df_copy[f'{category} Feature Found'] = df_copy.loc[:, category_mask].any(axis=1)
        else:
            df_copy[f'{category} Feature Found'] = False
            
    # 3) Sort by total Matches (desc)
    sorted_df = df_copy.sort_values(by='Protocol Similarity Rank')
    
    # 4) Filter by features: keep rows where *all* listed features are True
    if filter_features:
        valid_feature_filters = [f for f in filter_features if f in sorted_df.columns]
        if valid_feature_filters:
            mask = sorted_df[valid_feature_filters].all(axis=1)
            sorted_df = sorted_df.loc[mask]
            
    # 5) Filter by categories: keep rows where all corresponding category flags are True
    if filter_categories:
        valid_category_filters = [
            f"{category} Feature Found" for category in filter_categories
            if f"{category} Feature Found" in sorted_df.columns
        ]
        if valid_category_filters:
            mask = sorted_df[valid_category_filters].all(axis=1)
            sorted_df = sorted_df.loc[mask]
            
    # 6) Return the index and final columns
    return sorted_df.index, sorted_df.iloc[:, -6:]

def get_search_table(FeaturesOfInterest, LabelOfInterest=None, CategoriesOfInterest=[True,False,False,False,False], SearchMode=None):
    """
    Get a search result table with protocols matching the specified features and criteria.
    Now handles three explicitly defined modes:
    - normal: Find protocols with ALL selected features
    - enrichment: Find protocols based on target topic key characteristics
    - combined: Find protocols by target topic and filter by specific features
    
    Args:
        FeaturesOfInterest: List of features to search for
        LabelOfInterest: Target topic to search for (optional)
        CategoriesOfInterest: List of booleans indicating which categories to filter by
        SearchMode: Explicit mode to use ('normal', 'enrichment', or 'combined')
    """
    Categories = ['Protocol Variable', 'Analysis Method', 'Cell Profile', 'Study Characteristic', 'Measured Endpoint']
    
    # Load required dataframes if not already in memory
    binary_df = get_binary_df()
    cleaned_df = get_cleaned_df()
    target_feature_dict = get_target_feature_dict()
    categories_dict = get_categories_dict()
    
    # Determine mode based on inputs if not explicitly provided
    if not SearchMode:
        has_label = LabelOfInterest is not None and LabelOfInterest != ''
        has_features = bool(FeaturesOfInterest)
        
        if not has_label and has_features:
            mode = 'normal'
        elif has_label and not has_features:
            mode = 'enrichment'
        elif has_label and has_features:
            mode = 'combined'
        else:
            # Failsafe if somehow nothing was provided
            return pd.DataFrame()
    else:
        mode = SearchMode
    
    if mode == 'normal':
        # Normal mode: search protocols by ALL selected features
        selected_features = FeaturesOfInterest
        filter_features = FeaturesOfInterest  # In normal mode, filter by ALL selected features
        filter_categories = []  # Categories not used in normal mode
        wanted_cols = ['Protocol ID', 'Title', 'DOI']
    
    elif mode == 'enrichment':
        # Pure enrichment: just search for protocols with enrichment for target
        if LabelOfInterest not in target_feature_dict:
            print(f"DEBUG: Label '{LabelOfInterest}' not found in target_feature_dict. Available keys: {list(target_feature_dict.keys())[:5]}...")
            return pd.DataFrame()  # Return empty DataFrame if label not found
            
        selected_features = target_feature_dict[LabelOfInterest]
        # Debug print to check what features were found for this label
        print(f"DEBUG: Found {len(selected_features)} features for '{LabelOfInterest}'")
        
        filter_features = []  # No feature filtering
        filter_categories = [cat for cat, boo in zip(Categories, CategoriesOfInterest) if boo]
        wanted_cols = ['Title', 'DOI', LabelOfInterest.split(' -')[0]]
    
    elif mode == 'combined':
        # Combined mode: find protocols enriched for target topic and filter by features
        if LabelOfInterest not in target_feature_dict:
            return pd.DataFrame()  # Return empty DataFrame if label not found
            
        selected_features = target_feature_dict[LabelOfInterest]
        filter_features = FeaturesOfInterest
        filter_categories = [cat for cat, boo in zip(Categories, CategoriesOfInterest) if boo]
        wanted_cols = ['Title', 'DOI', LabelOfInterest.split(' -')[0]]
    
    else:
        # Invalid mode
        return pd.DataFrame()
    
    # Rank and filter protocols
    sorted_index, additional_columns = add_and_sort_by_matches(
        binary_df,
        selected_features,
        categories_dict,
        filter_features,
        filter_categories
    )
    
    # Get info from cleaned_df and create result dataframe
    result_df = cleaned_df[wanted_cols].iloc[1:].reset_index(drop=True).loc[sorted_index].copy()
    
    # Handle additional columns correctly to preserve column names
    if mode == 'normal':
        if isinstance(additional_columns, pd.DataFrame):
            # Convert specific column to a Series with proper name
            rank_series = additional_columns['Protocol Similarity Rank']
            result_df['Protocol Similarity Rank'] = rank_series
        else:
            # If it's already a Series, add it with its name
            result_df['Protocol Similarity Rank'] = additional_columns
    else:
        # For enrichment modes, ensure we preserve all column names when concatenating
        if isinstance(additional_columns, pd.DataFrame):
            # Use pandas merge instead of concat to preserve columns
            for col in additional_columns.columns:
                result_df[col] = additional_columns[col].values
    
    return result_df
# Custom JSON encoder to handle NaN values
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        if pd.isna(obj):  # Check if the object is NaN or None
            return None
        return super(NpEncoder, self).default(obj)

# -----------------------------------------

@app.route('/api/enrichment_data', methods=['GET'])
def get_enrichment_data():
    """
    Serve the enrichment records, optionally filtered by ?parameter=...
    """
    # Lazy load the enrichment data
    enrichment_data, enrichment_columns = load_enrichment_data()
    
    if not enrichment_data:
        return jsonify({'error': 'Enrichment data not available'}), 404

    selected_label = request.args.get('parameter')
    if selected_label:
        filtered = [r for r in enrichment_data if r.get('Target Label') == selected_label]
        print(filtered)
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
    viewer_data, viewer_columns = load_viewer_data()
    
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
