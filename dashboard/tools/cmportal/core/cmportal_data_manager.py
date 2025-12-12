import os
import csv
import pandas as pd
import numpy as np
import gc
import logging
from collections import defaultdict

# Import configuration with paths
import config

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
_causal_categories_dict = None

# ----- Load small lookup tables into memory at startup -----
def load_lookup_tables(feature_categories_filepath, target_param_filepath, causal_feature_categories_filepath=None):
    """Load lookup tables from CSV files into dictionaries"""
    FeatureCategories_dict = defaultdict(list)
    TargetParameters_dict = defaultdict(list)
    CausalFeatureCategories_dict = defaultdict(list)

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
        
        # Load causal feature categories if file path is provided
        if causal_feature_categories_filepath:
            with open(causal_feature_categories_filepath, newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for key, val in row.items():
                        if val and val.strip():  # Only add non-empty values
                            CausalFeatureCategories_dict[key].append(val)
            logger.info('Successfully loaded causal feature categories')
    except Exception as e:
        logger.error(f'Error loading lookup tables: {e}')
        
    return FeatureCategories_dict, TargetParameters_dict, CausalFeatureCategories_dict

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
        
        if _odds_enrichments_df is None and odds_filepath:
            _odds_enrichments_df = pd.read_csv(odds_filepath, low_memory=False)
            
        if _odds_enrichments_df is not None:
            _target_feature_dict = {col: _odds_enrichments_df[col].dropna().tolist() for col in _odds_enrichments_df.columns}
    
    return _target_feature_dict
    
def get_causal_categories_dict(causal_feature_categories_filepath):
    """Lazy loader for causal categories dictionary"""
    global _causal_categories_dict
    
    if _causal_categories_dict is None and causal_feature_categories_filepath:
        logger.info('Loading causal categories dictionary')
        causal_categories_df = pd.read_csv(causal_feature_categories_filepath, low_memory=False)
        _causal_categories_dict = {col: causal_categories_df[col].dropna().tolist() for col in causal_categories_df.columns}
        del causal_categories_df
        gc.collect()
    
    return _causal_categories_dict
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
        
    # Clear any benchmark-specific caches from utils.py
    try:
        from utils import _protocol_features_cache
        _protocol_features_cache.clear()
    except ImportError:
        pass
        
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
    
    # Use parameter to load target_feature_dict
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

def get_candidates():
    return ["hiPSC Matrix Coating - Matrigel (163)", "hiPSC Matrix Coating - Geltrex (33)", "hiPSC Matrix Coating - EBs (18)", "hiPSC Matrix Coating - Vitronectin (10)", "hiPSC Matrix Coating - MEF feeder cells (8)", "hiPSC Backbone Media - Embryonic Stem Cell (127)", "hiPSC Backbone Media - mTeSR (106)", "hiPSC Backbone Media - Essential 8 (82)", "hiPSC Backbone Media - Conditioned (12)", "hiPSC Backbone Media - DMEM/F12 (10)", "hiPSC Backbone Media - StemFit (5)", "hiPSC Backbone Media - StemFlex (5)", "hiPSC-CM Backbone Media - RPMI-1640 (167)", "hiPSC-CM Backbone Media - iCell Maintenance (86)", "hiPSC-CM Backbone Media - DMEM (18)", "hiPSC-CM Backbone Media - StemPro-34 (14)", "hiPSC-CM Backbone Media - Commercial CM Kit (12)", "hiPSC-CM Backbone Media - Cor.4U Complete (6)", "hiPSC-CM Media Supplement - B27 (180)", "hiPSC-CM Media Supplement - Ascorbic Acid (41)", "hiPSC-CM Media Supplement - iCell Maintenance Medium (41)", "hiPSC-CM Media Supplement - Albumin (28)", "hiPSC-CM Media Supplement - L-glutamine (19)", "hiPSC-CM Media Supplement - HEPES (16)", "hiPSC-CM Media Supplement - FBS (16)", "hiPSC-CM Media Supplement - 1-thioglycerol (14)", "hiPSC-CM Media Supplement - Transferrin (11)", "hiPSC-CM Media Supplement - Mercaptoethanol (10)", "hiPSC-CM Media Supplement - Lipids (9)", "hiPSC-CM Media Supplement - GlutaMax (8)", "hiPSC-CM Media Supplement - Nonessential Amino Acids (8)", "hiPSC-CM Media Supplement - Selenium (7)", "hiPSC-CM Media Supplement - Polyvinylalchohol (6)", "hiPSC-CM Media Supplement - Lipid Mix (5)", "hiPSC-CM Media Supplement - VEGF (4)", "hiPSC-CM Media Supplement - bFGF (3)", "Wnt Induction - CHIR99021 (184)", "Wnt Induction - Activin A (80)", "Wnt Induction - BMP4 (74)", "Wnt Induction - bFGF (45)", "Wnt Induction - StemCell Diff Kit (4)", "Wnt Induction - Wnt3a (3)", "Seeding Confluency (%) - 85 to 89 (43)", "Seeding Confluency (%) - 90 to 94 (26)", "Seeding Confluency (%) - 95 to 100 (23)", "Seeding Confluency (%) - 80 to 84 (12)", "Seeding Confluency (%) - 70 to 79 (11)", "Seeding Confluency 2D (%) - 70 to 79 (6)", "Seeding Confluency 3D (%) - 70 to 79 (3)", "Seeding Confluency 2D (%) - 80 to 84 (5)", "Seeding Confluency 3D (%) - 80 to 84 (5)", "Seeding Confluency 2D (%) - 85 to 89 (26)", "Seeding Confluency 3D (%) - 85 to 89 (12)", "Seeding Confluency 2D (%) - 90 to 94 (12)", "Seeding Confluency 3D (%) - 90 to 94 (13)", "Seeding Confluency 2D (%) - 95 to 100 (6)", "Seeding Confluency 3D (%) - 95 to 100 (13)", "Wnt Induction Duration (days) - 3 days (38)", "Wnt Induction Duration (days) - 4 days (15)", "Wnt Induction Duration (days) - 5 days (8)", "Wnt Induction Duration (days) Quantiles - Q3 (>1 and ≤1) (186)", "Wnt Induction Duration (days) Quantiles - Q2 (>1 and ≤2) (75)", "Wnt Induction Duration (days) Quantiles - Q1 (>2 and ≤5) (61)", "Wnt Inhibitor - IWP (112)", "Wnt Inhibitor - IWR (56)", "Wnt Inhibitor - Wnt-C59 (30)", "Wnt Inhibitor - XAV939 (24)", "Wnt Inhibitor - DS-I-7 (9)", "Wnt Inhibitor - bFGF (8)", "Wnt Inhibitor - KY02111 (7)", "Wnt Inhibitor - BMP4 (7)", "Wnt Inhibitor - VEGF (3)", "Wnt Inhibitor Duration (days) - 4 days (19)", "Wnt Inhibitor Duration (days) - 3 days (17)", "Wnt Inhibitor Duration (days) - >6 days (12)", "Wnt Inhibitor Duration (days) - 5 days (6)", "Wnt Inhibitor Duration (days) - 6 days (4)", "Wnt Inhibitor Duration (days) Quantiles - Q2 (>1 and ≤2) (156)", "Wnt Inhibitor Duration (days) Quantiles - Q3 (>1 and ≤1) (108)", "Wnt Inhibitor Duration (days) Quantiles - Q1 (>2 and ≤9) (58)", "Insulin Start Day - 7 (85)", "Insulin Start Day - 6 (20)", "Insulin Start Day - 1 (19)", "Insulin Start Day - 8 (15)", "Insulin Start Day - 5 (14)", "Insulin Start Day - 4 (11)", "Insulin Start Day - 9 (10)", "Insulin Start Day - 0 (7)", "Insulin Start Day - After 11 (7)", "Insulin Start Day - 10 (6)", "Insulin Start Day - 3 (5)", "Insulin Start Day - 2 (4)", "Insulin Start Day - 11 (3)", "Insulin Withdrawal Duration (days) Quantiles - Q2 (>2 and ≤4) (25)", "Insulin Withdrawal Duration (days) Quantiles - Q1 (>4 and ≤10) (11)", "Insulin Withdrawal Duration (days) - 4 days (18)", "Insulin Withdrawal Duration (days) - 3 days (6)", "Insulin Withdrawal Duration (days) - 6 days (3)", "Insulin Withdrawal Duration (days) - 8 days (3)", "Purification Protocol - Glucose and Lactate (85)", "Purification Protocol - Metabolic (8)", "Purification Protocol - Cell Sorting (7)", "Purification Protocol - Antibiotic (4)", "hiPSC-CM Purification Duration (days) - <3 days (31)", "hiPSC-CM Purification Duration (days) - 4 days (29)", "hiPSC-CM Purification Duration (days) - 3 days (13)", "hiPSC-CM Purification Duration (days) - 6 days (10)", "hiPSC-CM Purification Duration (days) - 5 days (6)", "hiPSC-CM Purification Duration (days) - 7 days (6)", "hiPSC-CM Purification Duration (days) - >9 days (5)", "hiPSC-CM Purification Duration (days) - 8 days (4)", "hiPSC-CM Purification Duration (days) Quantiles - Q2 (>1 and ≤4) (61)", "hiPSC-CM Purification Duration (days) Quantiles - Q1 (>4 and ≤20) (31)", "Differentiation Purity (%) Quantiles - Q4 (>79 and ≤85) (40)", "Differentiation Purity (%) Quantiles - Q3 (>85 and ≤90) (34)", "Differentiation Purity (%) Quantiles - Q5 (>30 and ≤79) (32)", "Differentiation Purity (%) Quantiles - Q2 (>90 and ≤95) (27)", "Differentiation Purity (%) Quantiles - Q1 (>95 and ≤99) (22)", "New Media for Maturation - RPMI-1640 (30)", "New Media for Maturation - DMEM (21)", "New Media for Maturation - F12 (7)", "New Media for Maturation - Commercial Kit (5)", "hiPSC-CM Maturation Media - RPMI-1640 (153)", "hiPSC-CM Maturation Media - iCell Maintenance (83)", "hiPSC-CM Maturation Media - DMEM (35)", "hiPSC-CM Maturation Media - Commercial Kit (27)", "hiPSC-CM Maturation Media - StemPro-34 (14)", "hiPSC-CM Maturation Media - F12 (10)", "hiPSC-CM Maturation Media - Cor.4U Complete (6)", "Coating for Replating - Matrigel (65)", "Coating for Replating - Gelatin (43)", "Coating for Replating - Fibronectin (32)", "Coating for Replating - Geltrex (10)", "Coating for Replating - Laminin (5)", "Coating for Replating - Synthemax (3)", "Coating for Replating - Vitronectin (3)", "Maturation Strategy - Metabolic (33)", "Maturation Strategy - Electrical (39)", "Maturation Strategy - Tension (64)", "Maturation Strategy - Other Cells (80)", "Maturation Strategy - Mechanical (36)", "Maturation Strategy - Cell Alignment (59)", "Maturation Strategy - Elastomeric (33)", "Maturation Strategy - ECM (21)", "Metabolic Component - T3 (14)", "Metabolic Component - Fatty Acid (13)", "Metabolic Component - Palmitic Acid (11)", "Metabolic Component - Creatine (7)", "Metabolic Component - Taurine (7)", "Metabolic Component - Dexamethasone (7)", "Metabolic Component - L-carnitine (6)", "Metabolic Component - Nonessential Amino Acids (6)", "Metabolic Component - Galactose (4)", "Metabolic Component - Lactate (4)", "Metabolic Component - Insulin-Transferrin-Selenium (3)", "Metabolic Component - Vitamin B12 (3)", "Metabolic Component - Biotin (3)", "Metabolic Component - Ascorbic Acid (3)", "Metabolic Component - Albumax (3)", "Metabolic Component - B27 (3)", "Metabolic Component - KOSR (3)", "Metabolic Component - IGF-1 (3)", "Metabolic Component Category - Fatty Acids and Lipids (21)", "Metabolic Component Category - Metabolic Modulation (20)", "Metabolic Component Category - Hormonal Stimulation (14)", "Metabolic Component Category - Sugars and Carbohydrates (9)", "Metabolic Component Category - Amino Acids and Derivatives (9)", "Metabolic Component Category - Signaling Pathway Regulators (6)", "Metabolic Component Category - Kinase Inhibitors (3)", "2D Surface - ECM-coated (115)", "2D Surface - Micropatterned (27)", "2D Surface - Hydrogel (17)", "2D Surface - Electrospun (13)", "2D Surface - Microelectrode Array (9)", "2D Surface - Nanotopography (6)", "2D Surface - Decellularized ECM (3)", "2D Surface - Microparticle/fluid (3)", "3D Platform - Fibrin (50)", "3D Platform - Scaffold Free (43)", "3D Platform - Collagen (38)", "3D Platform - Matrigel (33)", "3D Platform - Extracellular Scaffold (18)", "3D Platform - 3D printed (9)", "3D Platform - Polyethylene Glycol (8)", "3D Platform - Gelatin (6)", "3D Platform - Fibronectin (3)", "3D Platform - Nanotechnology (3)", "3D Tissue Media - RPMI-1640 (72)", "3D Tissue Media - MEM-α (60)", "3D Tissue Media - DMEM (53)", "3D Tissue Media - Commercial Kit (21)", "3D Tissue Media - Growth Factor (12)", "3D Tissue Media - iCell Maintenance (12)", "3D Tissue Media - High-glucose DMEM (9)", "3D Tissue Media - Iscove (5)", "Cell Line - iCell (47)", "Cell Line - WTC11 (30)", "Cell Line - IMR90 (19)", "Cell Line - Cor.4U (16)", "Cell Line - DF19-9-11T.H (16)", "Cell Line - PGP1 (11)", "Cell Line - 253G1 (10)", "Cell Line - Gibco episomal (10)", "Cell Line - 201B7 (9)", "Cell Line - iCell2 (8)", "Cell Line - SCVI-273 (8)", "Cell Line - BJ1 (7)", "Cell Line - C25 (6)", "Cell Line - ATCC (5)", "Cell Line - Cellapy (4)", "Cell Line - BJ RiPS (4)", "Cell Line - 201B6 (3)", "Number of Cell Lines - 1 (225)", "Number of Cell Lines - 2 (50)", "Number of Cell Lines - 3 (29)", "Number of Cell Lines - 4 (11)", "Number of Cell Lines - >5 (9)", "Cell Line Sex - Both (118)", "Cell Line Sex - Male (64)", "Cell Line Sex - Female (40)", "Cell Line Ancestry - Caucasian (41)", "Cell Line Ancestry - Asian (28)", "Cell Coculture - Cardiomyocyte (157)", "Cell Coculture - Stromal Cell (78)", "Cell Coculture - Endothelial Cell (35)", "3D CM Ratio (CM-EC-SC) Quantiles - Q1 (>91 and ≤100) (74)", "3D CM Ratio (CM-EC-SC) Quantiles - Q3 (>9 and ≤75) (48)", "3D CM Ratio (CM-EC-SC) Quantiles - Q2 (>75 and ≤91) (28)", "3D EC Ratio (CM-EC-SC) Quantiles - Q2 (>0 and ≤0) (119)", "3D EC Ratio (CM-EC-SC) Quantiles - Q1 (>0 and ≤91) (31)", "3D SC Ratio (CM-EC-SC) Quantiles - Q3 (>0 and ≤0) (74)", "3D SC Ratio (CM-EC-SC) Quantiles - Q1 (>10 and ≤50) (47)", "3D SC Ratio (CM-EC-SC) Quantiles - Q2 (>0 and ≤10) (29)", "3D Stromal Cell Source - Human Fibroblast (38)", "3D Stromal Cell Source - Stromal Cell (35)", "3D Stromal Cell Source - Cardiac Fibroblast (32)", "3D Stromal Cell Source - Mesenchymal Stem Cell (12)", "3D Stromal Cell Source - hiPSC-CardiacF (8)", "3D Stromal Cell Source - Dermal Fibroblast (7)", "3D Stromal Cell Source - hiPSC-MuralC (3)", "3D Stromal Cell Source - hiPSC-SmoothMC (3)", "3D Endothelial Cell Source - hiPSC-EndothelialC (16)", "3D Endothelial Cell Source - Umbilical Vein EndothelialC (10)", "3D Endothelial Cell Source - Cardiac Microvascular EndothelialC (5)", "Differentiation Purity Assessment - Flow Cytometry cTnT+ (135)", "Differentiation Purity Assessment - Flow Cytometry a-actinin+ (9)", "Differentiation Purity Assessment - IHC a-actinin (8)", "Differentiation Purity Assessment - IHC cTnT (7)", "Differentiation Purity Assessment - Visual Inspection (6)", "Differentiation Purity Assessment - Flow Cytometry SIRPA+ (4)", "Differentiation Purity Assessment - Flow Cytometry VCAM1+ (4)", "Differentiation Purity Assessment - Flow Cytometry cTnI+ (3)", "Immunofluorescent Imaging - Yes (268)", "Electron Imaging - Transmission (62)", "Electron Imaging - Scanning (22)", "Sacromere or Cellular Alignment Analysis - Yes (72)", "Contractile Analysis Method - Motion Tracking (93)", "Contractile Analysis Method - Deflection (39)", "Contractile Analysis Method - Force Transducer (27)", "Contractile Analysis Method - Traction Force Microscopy (9)", "Calcium Handling Analysis Method - Visual (104)", "Calcium Handling Analysis Method - Genetic (23)", "Electrophysiology Analysis Method - Patch Clamp (59)", "Electrophysiology Analysis Method - Optical Mapping (39)", "Electrophysiology Analysis Method - Microelectrode (31)", "Electrophysiology Analysis Method - Motion-Contrast Reconstruction (5)", "Electrophysiology Analysis Method - Genetic (3)", "Metabolic Analysis Method - Seahorse (35)", "Metabolic Analysis Method - Flux Rates (13)", "Metabolic Analysis Method - Mitochondrial (4)", "Metabolic Analysis Method - Genetic (3)", "Fatty Acid Metabolism Assessed - Yes (20)", "Gene Analysis Method - RNA (169)"]

def load_selected_variables(filepath):
    """Load selected variables list from CSV (single column, no header assumed)"""
    try:
        df = pd.read_csv(filepath, header=None)  # Single column, no header
        return df[0].dropna().str.strip().tolist()  # Remove NaN, strip whitespace
    except Exception as e:
        print(f"Error loading selected variables: {e}")
        return []