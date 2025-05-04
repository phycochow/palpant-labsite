import os
import csv
import pandas as pd
import numpy as np
import gc
import logging
from collections import defaultdict

# Setup a basic logger for use outside Flask context
logger = logging.getLogger(__name__)

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
def load_lookup_tables(feature_categories_filepath, target_param_filepath):
    """Load lookup tables from CSV files into dictionaries"""
    FeatureCategories_dict = defaultdict(list)
    TargetParameters_dict = defaultdict(list)

    try:
        with open(feature_categories_filepath, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                for key, val in row.items():
                    if val and val.strip():  # Only add non-empty values
                        FeatureCategories_dict[key].append(val)
        logger.info('Successfully loaded feature categories')
        
        with open(target_param_filepath, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                for key, val in row.items():
                    if val and val.strip():  # Only add non-empty values
                        TargetParameters_dict[key].append(val)
        logger.info('Successfully loaded target parameter findings')
    except Exception as e:
        logger.error(f'Error loading lookup tables: {e}')
        
    return FeatureCategories_dict, TargetParameters_dict

# ----- Lazy Loading Helper Functions -----
def load_viewer_data(cleaned_database_filepath):
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
            logger.info(f'Loaded cleaned database: {len(viewer_data)} rows')
        except Exception as e:
            logger.error(f'Error loading cleaned database: {e}')
            viewer_data = []
            viewer_columns = []
    
    return viewer_data, viewer_columns

def load_enrichment_data(enrich_filepath):
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
            logger.info(f'Loaded enrichment data: {len(enrichment_data)} rows')
        except Exception as e:
            logger.error(f'Error loading enrichment data: {e}')
            enrichment_data = []
            enrichment_columns = []
    
    return enrichment_data, enrichment_columns

def get_binary_df(binary_filepath):
    """Lazy loader for binary features dataframe"""
    global _binary_df
    
    if _binary_df is None:
        logger.info('Loading binary features dataframe')
        _binary_df = pd.read_csv(binary_filepath, low_memory=False)
    
    return _binary_df

def get_cleaned_df(cleaned_database_filepath):
    """Lazy loader for cleaned dataframe"""
    global _cleaned_df
    
    if _cleaned_df is None:
        logger.info('Loading cleaned database dataframe')
        _cleaned_df = pd.read_csv(cleaned_database_filepath)
    
    return _cleaned_df

def get_categories_dict(feature_categories_filepath):
    """Lazy loader for categories dictionary"""
    global _categories_dict
    
    if _categories_dict is None:
        logger.info('Loading categories dictionary')
        categories_df = pd.read_csv(feature_categories_filepath, low_memory=False)
        _categories_dict = {col: categories_df[col].dropna().tolist() for col in categories_df.columns}
        del categories_df
        gc.collect()
    
    return _categories_dict

def get_target_feature_dict(odds_filepath):
    """Lazy loader for enrichments dictionary"""
    global _target_feature_dict, _odds_enrichments_df
    
    if _target_feature_dict is None:
        logger.info('Loading enrichments dictionary')
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
    logger.info('Memory cache cleared')

def get_search_table(FeaturesOfInterest, binary_filepath, cleaned_database_filepath, 
                    odds_filepath, feature_categories_filepath, LabelOfInterest=None, 
                    CategoriesOfInterest=[True,False,False,False,False], SearchMode=None):
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
    binary_df = get_binary_df(binary_filepath)
    cleaned_df = get_cleaned_df(cleaned_database_filepath)
    target_feature_dict = get_target_feature_dict(odds_filepath)
    categories_dict = get_categories_dict(feature_categories_filepath)
    
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
    
    # Import the utility function from utils
    from utils import add_and_sort_by_matches
    
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