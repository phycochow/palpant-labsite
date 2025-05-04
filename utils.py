import json
import numpy as np
import pandas as pd

def add_and_sort_by_matches(BinaryFeature_df, selected_columns, categories_dict, filter_features, filter_categories):
    """
    Rank and filter protocols based on feature matching.
    Preserves the exact behavior of the original implementation.
    
    Args:
        BinaryFeature_df: DataFrame with binary features
        selected_columns: List of columns to match
        categories_dict: Dictionary of category features
        filter_features: Features to filter by
        filter_categories: Categories to filter by
        
    Returns:
        tuple: (sorted_indices, additional_columns_df)
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

# Custom JSON encoder to handle NaN values
class NpEncoder(json.JSONEncoder):
    """
    Custom JSON encoder for handling NumPy types and NaN values.
    
    This encoder converts:
    - NumPy integers to Python integers
    - NumPy floats to Python floats
    - NumPy arrays to Python lists
    - NumPy and Python booleans to Python booleans
    - NaN values to None
    """
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