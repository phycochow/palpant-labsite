"""
CMPortal Configuration Module
Contains file paths and configuration settings for CMPortal
"""

import os

# Define base paths - cmportal_config.py is in dashboard/tools/cmportal/core/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DATASETS_DIR = os.path.join(BASE_DIR, 'tools', 'cmportal', 'static', 'datasets')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'tools', 'cmportal', 'uploads')

# Dataset file paths - USE ORIGINAL KEY NAMES
DATASET_PATHS = {
    'target_param_filepath': os.path.join(DATASETS_DIR, '0_TargetParameters_12Apr25.csv'),
    'feature_categories_filepath': os.path.join(DATASETS_DIR, '0_FeatureCategories_01Mar25.csv'),
    'causal_feature_categories_filepath': os.path.join(DATASETS_DIR, '0_CausalFeatureCategories_04Mar25.csv'),
    'enrich_filepath': os.path.join(DATASETS_DIR, '1_PermutatedImportancesTRUE_02May25.csv'),
    'cleaned_database_filepath': os.path.join(DATASETS_DIR, '0_CleanedDatabase_25Feb25.csv'),
    'binary_filepath': os.path.join(DATASETS_DIR, '1_BinaryFeatures_25Feb25.csv'),
    'odds_filepath': os.path.join(DATASETS_DIR, '1_PositiveOddsEnrichments_03May25.csv'),
    'selected_vars_filepath': os.path.join(DATASETS_DIR, '2_SelectedVariables_12Dec25.csv')
}

# Upload settings
MAX_CONTENT_LENGTH = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'csv', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS