"""
Utility functions for palpant-labsite
Extracted from app.py for better modularity
"""

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
    "3D Estimated Cell Density (mil cells/mL)": [(5, 40), (1.25, 5), (0.25, 1.25)]
}

# PDF field mapping for consistent data extraction - UPDATED for consistent field names
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
    'TNNI3_Percentage_TTNI1': 'TNNI3 Percentage (TNNI1)'  # Special weird PDF form behavior TTNT instead of TNNT
}


class NpEncoder(json.JSONEncoder):
    """
    Custom JSON encoder for NumPy types.
    
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


def normalize_field_name(field_name):
    """
    Normalize field names by replacing Unicode symbols with ASCII equivalents
    and standardizing formatting for consistent matching.
    """
    if not isinstance(field_name, str):
        return str(field_name)
        
    replacements = {
        'um²': 'um2',
        'mm²': 'mm2',
        'μm²': 'um2',
        'μm': 'um',
        'μm/s': 'um/s',
        '²': '2',
        '%C2%B2': '2',  # URL-encoded version of ²
    }
    
    result = field_name
    for original, replacement in replacements.items():
        result = result.replace(original, replacement)
    
    return result


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
    Extract experimental data from a PDF file by reading fields in order.
    This approach tries multiple strategies:
    1. First map by field names using the PDF_FIELD_MAP
    2. Then fill in any missing fields by assuming order if needed
    
    Args:
        pdf_path: String path to the PDF file or file object
        
    Returns:
        Dictionary with extracted form data
    """
    # Define expected fields in their expected order
    expected_fields = [
        "ProtocolName",
        "Sarcomere Length (um)",
        "Cell Area (um2)", 
        "T-tubule Structure (Found)",
        "Contractile Force (mN)", 
        "Contractile Stress (mN/mm2)",
        "Contraction Upstroke Velocity (um/s)", 
        "Calcium Flux Amplitude (F/F0)",
        "Time to Calcium Flux Peak (ms)", 
        "Time from Calcium Peak to Relaxation (ms)",
        "Conduction Velocity from Calcium Imaging (cm/s)",
        "Action Potential Conduction Velocity (cm/s)", 
        "Action Potential Amplitude (mV)",
        "Resting Membrane Potential (mV)", 
        "Beat Rate (bpm)",
        "Max Capture Rate of Paced CMs (Hz)", 
        "MYH7 Percentage (MYH6)",
        "MYL2 Percentage (MYL7)", 
        "TNNI3 Percentage (TNNI1)"
    ]
    
    try:
        reader = PdfReader(pdf_path)
        fields = reader.get_fields()
        
        if not fields:
            print("WARNING: No form fields found in the PDF.")
            return {}
        
        # First attempt: Map fields by name using our field mapping
        result = {}
        mapped_fields = set()
        all_fields_list = []
        
        # Get all field values and store their values in a list to track order
        for field_name, field in fields.items():
            field_value = field.get('/V', '') or field.get('V', '')
            all_fields_list.append((field_name, field_value))
            
            # Normalize the field name to handle Unicode characters
            normalized_key = normalize_field_name(field_name)
            
            # Try to map this field using our field mapping
            if field_name in PDF_FIELD_MAP:
                mapped_key = PDF_FIELD_MAP[field_name]
                result[mapped_key] = field_value
                mapped_fields.add(mapped_key)
            elif normalized_key in PDF_FIELD_MAP:
                mapped_key = PDF_FIELD_MAP[normalized_key]
                result[mapped_key] = field_value
                mapped_fields.add(mapped_key)
        
        # Debug output
        print(f"PDF contains {len(fields)} form fields")
        print(f"Successfully mapped {len(mapped_fields)} fields by name")
        
        return result
        
    except Exception as e:
        print(f"Error reading PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}


def GetQuantileFeatures(CategoryLabel, FeaturesByAllLabels, AllQuantileFeatures):
    """
    Extract quantile-specific features for a given category label.
    """
    FeaturesByQuantile, IsQuantileFeature = {}, False
    
    RelevantLabels = [i for i in AllQuantileFeatures if CategoryLabel in i]

    for Label in RelevantLabels:
        Features = FeaturesByAllLabels[Label]
        
        if Label in AllQuantileFeatures:
            try:
                # Extract quantile (Q1, Q2, Q3, Q4, Q5, Q6) using regex
                match = _quantile_pattern.search(Label)
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
    - Tuple: (ProtocolName, ResultsDict)
        ResultsDict: Dictionary with maturity indicator IDs as keys and tuples (quantile, flag) as values
        where flag is:
        0 = Predicted data (no experimental value provided)
        1 = Experimental data within quantile ranges
        3 = Experimental data higher than the best quantile bounds (returns Q1)
        4 = Experimental data lower than the worst quantile bounds (returns worst quantile)
    """
    # Initialize the results dictionary
    ResultsDict = {}
    
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
            try:
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
                        # Check if value is better than the best range (lower is better)
                        if float_value < best_low:
                            quantile = 'Q1'
                            flag = 3  # Better than best
                        # Check if value is worse than worst range (higher is worse)
                        elif float_value > worst_high:
                            quantile = f'Q{len(ranges)}'
                            flag = 4  # Worse than worst
                        else:
                            # Value is within ranges, find which quantile
                            for i, (low, high) in enumerate(ranges):
                                if low <= float_value <= high:
                                    quantile = f'Q{i+1}'
                                    flag = 1
                                    break
                    else:
                        # For normal metrics (higher is better)
                        # Check if value is better than the best range (higher is better)
                        if float_value > best_high:
                            quantile = 'Q1'
                            flag = 3  # Better than best
                        # Check if value is worse than worst range (lower is worse)
                        elif float_value < worst_low:
                            quantile = f'Q{len(ranges)}'
                            flag = 4  # Worse than worst
                        else:
                            # Value is within ranges, find which quantile
                            for i, (low, high) in enumerate(ranges):
                                if low <= float_value <= high:
                                    quantile = f'Q{i+1}'
                                    flag = 1
                                    break
                    
                    if quantile:
                        ResultsDict[indicator_id] = (quantile, flag)
                        
            except (ValueError, TypeError) as e:
                print(f"Could not process value for {indicator_id}: {value} - {str(e)}")
                continue
        
        # For missing values: predict quantile based on protocol features
        if indicator_id not in ResultsDict and indicator_id in expected_indicators:
            # Get quantile features for this indicator
            FeaturesByQuantile = GetQuantileFeatures(indicator_id, FeaturesByAllLabels, AllQuantileFeatures)
            
            if FeaturesByQuantile:
                # Score the protocol and get predicted quantile
                scored = ScoreProtocol(protocol_features, FeaturesByQuantile)
                predicted_quantile = scored.get('Reference Quantile(s)', 'Q3')
                ResultsDict[indicator_id] = (predicted_quantile, 0)  # Flag 0 for predicted
            else:
                # If no quantile features available, default to Q3
                ResultsDict[indicator_id] = ('Q3', 0)
    
    return Name, ResultsDict


def add_and_sort_by_matches(BinaryFeature_df, selected_columns, categories_dict, filter_features, filter_categories):
    """
    Rank and filter protocols based on feature matching.
    Preserves the exact behavior of the original implementation.
    
    Args:
        BinaryFeature_df: DataFrame with binary features
        selected_columns: List of column names to match
        categories_dict: Dictionary mapping features to categories
        filter_features: List of features to filter by
        filter_categories: List of categories to filter by
    
    Returns:
        Filtered and sorted DataFrame
    """
    # Calculate match count for each row
    BinaryFeature_df['Matches'] = BinaryFeature_df[selected_columns].sum(axis=1)
    
    # Sort by matches in descending order
    sorted_df = BinaryFeature_df.sort_values(by='Matches', ascending=False)
    
    # Filter based on categories if specified
    if filter_categories:
        category_mask = pd.Series([False] * len(sorted_df), index=sorted_df.index)
        for feature in selected_columns:
            if feature in categories_dict:
                feature_category = categories_dict[feature]
                if feature_category in filter_categories:
                    category_mask |= (sorted_df[feature] == True)
        sorted_df = sorted_df[category_mask]
    
    # Filter based on specific features if specified
    if filter_features:
        feature_mask = pd.Series([True] * len(sorted_df), index=sorted_df.index)
        for feature in filter_features:
            if feature in sorted_df.columns:
                feature_mask &= (sorted_df[feature] == True)
        sorted_df = sorted_df[feature_mask]
    
    return sorted_df
