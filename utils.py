import json
import numpy as np
import pandas as pd
import re
from PyPDF2 import PdfReader

# Precompiled regex pattern for better performance
_quantile_pattern = re.compile(r'Q[1-6]')

# Cache for protocol features to avoid reprocessing
_protocol_features_cache = {}

# Centralized constants to avoid redundancy
MATURITY_QUANTILES = {
    "Sarcomere Length (um)": [(1.95, 2.5), (1.88, 1.95), (1.75, 1.88), (1.64, 1.75), (1.01, 1.64)],
    "Cell Area (um2)": [(2850, 9000), (1800, 2850), (350, 1800)],
    "T-tubule Structure (Found)": [(0.9, 1), (0, 0.9)],
    "Contractile Force (mN)": [(1.04, 20), (0.43, 1.04), (0.16, 0.43), (0.04, 0.16), (0.0, 0.04)],
    "Contractile Stress (mN/mm2)": [(3.95, 50), (1.9, 3.95), (0.51, 1.9), (0.07, 0.51)],
    "Contraction Upstroke Velocity (um/s)": [(50, 1300), (31.5, 50), (10, 31.5), (1.2, 10)],
    "Calcium Flux Amplitude (F/F0)": [(2.3, 8), (1.6, 2.3), (0.9, 1.6), (0.25, 0.9), (0.03, 0.25)],
    "Beat Rate (bpm)": [(7, 27.6), (27.6, 38.8), (38.8, 45), (45, 60), (108, 60)],
    "Time to Calcium Flux Peak (ms)": [(0.06, 154), (154, 200), (200, 254), (254, 365), (2000, 365)],
    "Time from Calcium Peak to Relaxation (ms)": [(0.2, 310), (1000, 310)],
    "Conduction Velocity from Calcium Imaging (cm/s)": [(17, 44), (8.53, 17), (1.5, 8.53)],
    "Action Potential Conduction Velocity (cm/s)": [(28.5, 41), (16, 28.5), (10.75, 16), (2.5, 10.75)],
    "Action Potential Amplitude (mV)": [(110, 170), (100, 110), (97, 100), (50, 97)],
    "Resting Membrane Potential (mV)": [(-85, -78), (-78, -74), (-74, -66), (-66, -60), (-35, -60)],
    "Max Capture Rate of Paced CMs (Hz)": [(2.9, 6.9), (1, 2.9)],
    "MYH7 Percentage (MYH6)": [(82.35, 94.6), (30.1, 82.35)],
    "MYL2 Percentage (MYL7)": [(30.1, 45.7), (1.2, 30.1)],
    "TNNI3 Percentage (TNNI1)": [(16.15, 26), (6.5, 16.15)],
    "3D Estimated Cell Density (mil cells/mL)": [(21, 150), (10, 21), (5, 10), (0.47, 5), (0.01, 0.47)],
    "3D Estimated Tissue Size (mm2)": [(26.2, 3500), (9.12, 26.2), (0.13, 2), (0.01, 0.13)],
}

# Centralized mapping of indicators to their categories
INDICATOR_CATEGORIES = {
    'Sarcomere Length (um)': 'Sarcomere Length (um) Quantiles',
    'Cell Area (um2)': 'Cell Area (um2) Quantiles',
    'T-tubule Structure (Found)': 'T-tubule Structure (Found) Quantiles',
    'Contractile Force (mN)': 'Contractile Force (mN) Quantiles',
    'Contractile Stress (mN/mm2)': 'Contractile Stress (mN/mm2) Quantiles',
    'Contraction Upstroke Velocity (um/s)': 'Contraction Upstroke Velocity (um/s) Quantiles',
    'Calcium Flux Amplitude (F/F0)': 'Calcium Flux Amplitude (F/F0) Quantiles',
    'Beat Rate (bpm)': 'Beat Rate (bpm) Quantiles',
    'Time to Calcium Flux Peak (ms)': 'Time to Calcium Flux Peak (ms) Quantiles',
    'Time from Calcium Peak to Relaxation (ms)': 'Time from Calcium Peak to Relaxation (ms) Quantiles',
    'Conduction Velocity from Calcium Imaging (cm/s)': 'Conduction Velocity from Calcium Imaging (cm/s) Quantiles',
    'Action Potential Conduction Velocity (cm/s)': 'Action Potential Conduction Velocity (cm/s) Quantiles',
    'Action Potential Amplitude (mV)': 'Action Potential Amplitude (mV) Quantiles',
    'Resting Membrane Potential (mV)': 'Resting Membrane Potential (mV) Quantiles',
    'Max Capture Rate of Paced CMs (Hz)': 'Max Capture Rate of Paced CMs (Hz) Quantiles',
    'MYH7 Percentage (MYH6)': 'MYH7 Percentage (MYH6) Quantiles',
    'MYL2 Percentage (MYL7)': 'MYL2 Percentage (MYL7) Quantiles',
    'TNNI3 Percentage (TNNI1)': 'TNNI3 Percentage (TNNI1) Quantiles',
    '3D Estimated Cell Density (mil cells/mL)': '3D Estimated Cell Density (mil cells/mL) Quantiles',
    '3D Estimated Tissue Size (mm2)': '3D Estimated Tissue Size (mm2) Quantiles'
}

# PDF field mapping for consistency - UPDATED for consistent field names
PDF_FIELD_MAP = {
    'ProtocolName': 'ProtocolName',
    'Sarcomere_Length_um': 'Sarcomere Length (um)',
    'Cell_Area_um²': 'Cell Area (um2)',  # Handle both um² and um2
    'Cell_Area_um2': 'Cell Area (um2)',  # Alternative entry for ASCII version
    'T-tubule_Structure_Found': 'T-tubule Structure (Found)',
    'Contractile_Force_mN': 'Contractile Force (mN)',
    'Contractile_Stress_mN_mm²': 'Contractile Stress (mN/mm2)',  # Handle both mm² and mm2
    'Contractile_Stress_mN_mm2': 'Contractile Stress (mN/mm2)',  # Alternative entry for ASCII version
    'Contraction_Upstroke_Velocity_um_s': 'Contraction Upstroke Velocity (um/s)',
    'Calcium_Flux_Amplitude_F_F0': 'Calcium Flux Amplitude (F/F0)',
    'Time_to_Calcium_Flux_Peak_ms': 'Time to Calcium Flux Peak (ms)',
    'Time_from_Calcium_Peak_to_Relaxation_ms': 'Time from Calcium Peak to Relaxation (ms)',
    'Conduction_Velocity_from_Calcium_Imaging_cm_s': 'Conduction Velocity from Calcium Imaging (cm/s)',
    'Action_Potential_Conduction_Velocity_cm_s': 'Action Potential Conduction Velocity (cm/s)',
    'Action_Potential_Amplitude_mV': 'Action Potential Amplitude (mV)',
    'Resting_Membrane_Potential_mV': 'Resting Membrane Potential (mV)',
    'Beat_Rate_bpm': 'Beat Rate (bpm)',
    'Max_Capture_Rate_of_Paced_CMs_Hz': 'Max Capture Rate of Paced CMs (Hz)',
    'MYH7_Percentage_MYH6': 'MYH7 Percentage (MYH6)',
    'MYL2_Percentage_MYL7': 'MYL2 Percentage (MYL7)',
    'TNNI3_Percentage_TNNI1': 'TNNI3 Percentage (TNNI1)'
}

# NEW: Function to normalize field names by replacing Unicode with ASCII equivalents
def normalize_field_name(field_name):
    """
    Normalize field names by replacing unicode symbols with ASCII equivalents
    """
    replacements = {
        'um²': 'um2',
        'mm²': 'mm2',
        'μm²': 'um2',
        'μm': 'um',
        'μm/s': 'um/s',
        '²': '2',
    }
    
    result = field_name
    for original, replacement in replacements.items():
        result = result.replace(original, replacement)
    
    return result

# Cache for protocol features to avoid reprocessing
_protocol_features_cache = {}

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

def get_scoring_weights(num_quantiles: int, selected_quantile: str):
    """Returns a scoring dictionary based on the selected quantile.
    
    The selected quantile receives a score of 1. Each quantile's score decreases
    by 1 for each unit of distance from the selected quantile.
    """
    quantile_order = [f'Q{i+1}' for i in range(num_quantiles)]
    
    if selected_quantile not in quantile_order:
        raise ValueError(f"Invalid quantile: {selected_quantile}. Available quantiles: {quantile_order}")
    
    selected_index = quantile_order.index(selected_quantile)
    return {q: 1 - abs(i - selected_index) for i, q in enumerate(quantile_order)}

def compute_score(protocol_features: list, selected_quantile: str, quantile_features: dict, scoring_weights: dict):
    """
    Compute score for a protocol based on its features and the selected quantile.
    """
    score = 0
    for quantile, features in quantile_features.items():
        weight = scoring_weights.get(quantile, 0)
        for feature in features:
            if feature in protocol_features:
                score += 1 * weight
    return score

def classify_quantile(indicator_name, value):
    """
    Classify a value into a quantile based on predefined ranges.
    """
    if indicator_name not in MATURITY_QUANTILES:
        return None

    for i, (low, high) in enumerate(MATURITY_QUANTILES[indicator_name]):
        if low < float(value) <= high:
            return f"Q{i+1}"
    return 'Q1'  # Default to Q1 if no match

def getUserProtocolFeatures(file_path, causal_candidates):
    """
    Extract features from a protocol PDF file.
    Uses the cache to avoid reprocessing.
    
    Args:
        file_path: String path to the PDF file or file object
        causal_candidates: List of feature candidates to match against
    
    Returns:
        List of selected feature labels
    """
    import os
    
    # Create a cache key based on path or filename
    if hasattr(file_path, 'filename'):
        # For file objects (like those from request.files)
        cache_key = f"{file_path.filename}_{hash(tuple(causal_candidates))}"
    else:
        # For string paths
        cache_key = f"{os.path.basename(file_path)}_{hash(tuple(causal_candidates))}"
    
    if cache_key in _protocol_features_cache:
        return _protocol_features_cache[cache_key]
    
    reader = PdfReader(file_path)
    fields = reader.get_fields()

    binary_list = []
    for field in fields.values():
        if field.get("/FT") == "/Btn" or field.get("FT") == "/Btn":
            value = field.get("/V") or field.get("V")
            is_checked = value in ["/Yes", "Yes", True]
            binary_list.append(bool(is_checked))

    if len(causal_candidates) != len(binary_list):
        raise ValueError(f"Mismatch: {len(causal_candidates)} labels vs {len(binary_list)} fields")

    selected_labels = [label for label, is_true in zip(causal_candidates, binary_list) if is_true]
    
    # Store in cache
    _protocol_features_cache[cache_key] = selected_labels
    return selected_labels

def getUserData(pdf_path):
    """
    Extract experimental data from a PDF file.
    
    Args:
        pdf_path: String path to the PDF file or file object
        
    Returns:
        Dictionary with extracted form data
    """
    reader = PdfReader(pdf_path)
    fields = reader.get_fields()
    
    if not fields:
        return {}
    
    # For debugging - print received fields
    print(f"PDF fields received: {list(fields.keys())}")
        
    # Process the fields based on whether keys are in the mapping
    result = {}
    for key, val in fields.items():
        field_value = val.get('/V', '')
        
        # Normalize the key to handle Unicode characters
        normalized_key = normalize_field_name(key)
        
        if key in PDF_FIELD_MAP:
            mapped_key = PDF_FIELD_MAP[key]
            result[mapped_key] = field_value
        elif normalized_key in PDF_FIELD_MAP:
            mapped_key = PDF_FIELD_MAP[normalized_key]
            result[mapped_key] = field_value
        else:
            # For fields not in the mapping, use the original key
            result[key] = field_value
    
    # For debugging - print mapped results
    print(f"Mapped results: {list(result.keys())}")
            
    return result

def GetQuantileFeatures(CategoryLabel, FeaturesByAllLabels, AllQuantileFeatures):
    FeaturesByQuantile, IsQuantileFeature = {}, False
    
    RelevantLabels = [i for i in AllQuantileFeatures if CategoryLabel in i]

    for Label in RelevantLabels:
        Features = FeaturesByAllLabels[Label]
        
        if Label in AllQuantileFeatures:
            try:
                # Extract quantile (Q1, Q2, Q3, Q4, Q5, 6) using regex
                match = re.search(r'Q[1-6]', Label)
                if match:
                    quantile = match.group(0)  # Extract the matched quantile string (e.g., 'Q1')
                    FeaturesByQuantile[quantile] = Features  # Append features to quantile group
                    IsQuantileFeature = True
                else:
                    raise ValueError(f"Quantile not found in Label: {Label}")
        
            except Exception as e:
                if IsQuantileFeature:
                    raise RuntimeError(f"Label is a quantile feature but cannot find {Label}: {str(e)}")
                else:
                    raise RuntimeError('Check this part')

    return FeaturesByQuantile

def ScoreProtocol(protocol_features: list, FeaturesByQuantile: dict) -> pd.Series:
    """
    Score a protocol against different quantiles and determine the best matching quantile.
    """
    score_columns = {}
    # Sort the quantiles in natural order (e.g., Q1, Q2, Q3, ...)
    sorted_quantiles = sorted(FeaturesByQuantile.keys(), key=lambda x: int(x[1:]))
    
    for selected_quantile in sorted_quantiles:
        scoring_weights = get_scoring_weights(len(FeaturesByQuantile), selected_quantile)
        # Compute the score for the protocol_features for the given quantile.
        score = compute_score(protocol_features, selected_quantile, FeaturesByQuantile, scoring_weights)
        score_columns[f'{selected_quantile}_Score'] = score

    # Convert scores into a Series.
    scores_series = pd.Series(score_columns)
    
    # Identify the quantile(s) with the highest score.
    max_score = scores_series.max()
    best_cols = scores_series[scores_series == max_score].index.tolist()
    quantile_ids = [col.split('_')[0] for col in best_cols]
    quantile_nums = [int(q[1:]) for q in quantile_ids if q.startswith('Q') and q[1:].isdigit()]

    if len(set(quantile_nums)) == 1:
        predicted_quantile = f"Q{quantile_nums[0]}"
    else:
        avg_quantile = sum(quantile_nums) / len(quantile_nums)
        predicted_quantile = f"Q{avg_quantile:.1f}"

    # Create a Series that includes the predicted quantile(s) and the scores.
    result_series = pd.Series({'Reference Quantile(s)': predicted_quantile})
    result_series = pd.concat([result_series, scores_series])
    
    return result_series

def process_maturity_indicators(user_data, protocol_features, target_feature_dict):
    """
    Process maturity indicators by combining experimental data with protocol features.
    
    Returns:
    - ResultsDict: Dictionary with maturity indicator IDs as keys and tuples (quantile, flag) as values
        where flag is:
        0 = Predicted data (no experimental value provided)
        1 = Experimental data within quantile ranges
        3 = Experimental data higher than the best quantile bounds (returns Q1)
        4 = Experimental data lower than the worst quantile bounds (returns worst quantile)
    """
    # Initialize the results dictionary
    ResultsDict = {}
    
    # For debugging - print received user_data keys
    print(f"Received keys for user_data: {list(user_data.keys())}")
    
    # Define expected indicators for clear reference
    expected_indicators = [
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
    
    print(f"Expected indicators: {expected_indicators}")
    
    # Get all quantile features
    FeaturesByAllLabels = target_feature_dict

    # Get list of all quantile features - use generator for memory efficiency
    AllQuantileFeatures = [label for label in FeaturesByAllLabels.keys() if "Quantiles" in label]

    # Process each maturity indicator
    Name = "Unnamed Protocol"
    for indicator_id, value in user_data.items():
        if indicator_id == 'ProtocolName':
            Name = value
            
        elif value and value.strip():  # If reported value is not empty
            # Convert value to float
            float_value = float(value)
            
            # Check if value is within any quantile range
            quantile = None
            flag = 1  # Default to normal experimental data
            
            if indicator_id in MATURITY_QUANTILES:
                ranges = MATURITY_QUANTILES[indicator_id]
                
                # Get the best and worst bounds for this indicator
                best_low, best_high = ranges[0]
                worst_low, worst_high = ranges[-1]
                
                # Special cases for Beat Rate, Time, and Resting Membrane Potential where direction is reversed
                reversed_metrics = ["Beat Rate", "Time", "Resting"]
                is_reversed = any(term in indicator_id for term in reversed_metrics)
                
                if is_reversed:
                    # For reversed metrics (Beat Rate, Time, Resting Membrane)
                    # Check if value is better than the best range
                    if float_value < best_low:  # Using <= for the lower bound
                        quantile = f"Q1"  # Best quantile
                        flag = 3  # Above best bound
                    # Check if value is worse than the worst range
                    elif float_value >= worst_high:  # Using >= for the upper bound
                        quantile = f"Q{len(ranges)}"  # Worst quantile
                        flag = 4  # Below worst bound
                    else:
                        # Use classify_quantile to get the normal quantile
                        quantile = classify_quantile(indicator_id, float_value)
                else:
                    # For normal metrics
                    # Check if value is better than the best range
                    if float_value > best_high:  # Using >= for the upper bound
                        quantile = "Q1"  # Best quantile
                        flag = 3  # Above best bound
                    # Check if value is worse than the worst range
                    elif float_value <= worst_low:  # Using <= for the lower bound
                        quantile = f"Q{len(ranges)}"  # Worst quantile
                        flag = 4  # Below worst bound
                    else:
                        # Use classify_quantile to get the normal quantile
                        quantile = classify_quantile(indicator_id, float_value)
            else:
                # If no quantile ranges defined, use default classification
                quantile = classify_quantile(indicator_id, float_value)
            
            ResultsDict[indicator_id] = (quantile, flag)
                
        else:
            # Need to predict reference value if no reported value
            category_label = INDICATOR_CATEGORIES.get(indicator_id)
            
            if not category_label:
                continue  # Skip if no category found

            # Get features for each quantile in this category
            quantile_features = GetQuantileFeatures(category_label, FeaturesByAllLabels, AllQuantileFeatures)

            # Score the protocol to predict the quantile
            score_series = ScoreProtocol(protocol_features, quantile_features)
            
            # Extract the predicted quantile from the result
            predicted_quantile = score_series['Reference Quantile(s)']
            
            # Store in results dictionary with 0 to indicate predicted (reference) value
            ResultsDict[indicator_id] = (predicted_quantile, 0)
    
    return Name, ResultsDict