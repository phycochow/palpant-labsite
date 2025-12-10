"""
Configuration for CMPortal tool
"""

import os

# Get CMPortal base directory
CMPORTAL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Dataset paths
DATA_DIR = os.path.join(CMPORTAL_DIR, 'static', 'datasets')

DATASET_PATHS = {
    'target_param_filepath': os.path.join(DATA_DIR, '0_TargetParameters_12Apr25.csv'),
    'feature_categories_filepath': os.path.join(DATA_DIR, '0_FeatureCategories_01Mar25.csv'),
    'causal_feature_categories_filepath': os.path.join(DATA_DIR, '0_CausalFeatureCategories_04Mar25.csv'),
    'enrich_filepath': os.path.join(DATA_DIR, '1_PermutatedImportancesTRUE_02May25.csv'),
    'cleaned_database_filepath': os.path.join(DATA_DIR, '0_CleanedDatabase_25Feb25.csv'),
    'binary_filepath': os.path.join(DATA_DIR, '1_BinaryFeatures_25Feb25.csv'),
    'odds_filepath': os.path.join(DATA_DIR, '1_PositiveOddsEnrichments_03May25.csv')
}

# Uploads directory
UPLOAD_FOLDER = os.path.join(CMPORTAL_DIR, 'core', 'uploads')

# File upload settings
MAX_CONTENT_LENGTH = 5000 * 1024  # 5MB
