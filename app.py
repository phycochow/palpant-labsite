from flask import Flask, render_template, jsonify, request
import os
import json
import numpy as np
import pandas as pd
import gc
import logging
import csv
from PyPDF2 import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# Import from local modules
from data_manager import (
    load_lookup_tables,
    load_viewer_data,
    load_enrichment_data,
    get_search_table,
    clear_memory_cache
)
from utils import (
    NpEncoder, 
    getUserProtocolFeatures, 
    getUserData, 
    process_maturity_indicators
)

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

# Load lookup tables at startup
FeatureCategories_dict, TargetParameters_dict = load_lookup_tables(
    feature_categories_filepath, target_param_filepath
)

# Cache for benchmark results to avoid reprocessing
_benchmark_results_cache = {}

# ----- API Routes -----
@app.route('/api/enrichment_data', methods=['GET'])
def get_enrichment_data():
    """
    Serve the enrichment records, optionally filtered by ?parameter=...
    """
    # Lazy load the enrichment data
    enrichment_data, enrichment_columns = load_enrichment_data(enrich_filepath)
    
    if not enrichment_data:
        return jsonify({'error': 'Enrichment data not available'}), 404

    selected_label = request.args.get('parameter')
    if selected_label:
        filtered = [r for r in enrichment_data if r.get('Target Label') == selected_label]
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
    viewer_data, viewer_columns = load_viewer_data(cleaned_database_filepath)
    
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
            binary_filepath=binary_filepath,
            cleaned_database_filepath=cleaned_database_filepath,
            odds_filepath=odds_filepath,
            feature_categories_filepath=feature_categories_filepath,
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

@app.route('/api/submit_benchmark', methods=['POST'])
def submit_benchmark():
    """
    Process a benchmark submission with protocol, experimental data, and references.
    """
    # Call the process_benchmark_submission function with request data and files
    result = process_benchmark_submission(request.form, request.files)
    
    # If the result contains an error status, return it as is
    if result.get('status') == 'error':
        return jsonify(result)
    
    # Otherwise, return the successful result
    return jsonify(result)


def process_benchmark_submission(request_data, request_files):
    """
    Process user's benchmark submission with all components in a single function.
    
    Parameters:
    - request_data: Form data from the request
    - request_files: File uploads from the request
    
    Returns:
    - Dictionary with processed benchmark results
    """
    try:
        # Initialize variables
        reference_results = []
        db_protocol_results = []
        
        # Retrieve causal candidates (all possible features)
        causal_candidates = ["hiPSC Matrix Coating - EBs (18)", "hiPSC Matrix Coating - Geltrex (33)", "hiPSC Matrix Coating - Matrigel (163)", "hiPSC Matrix Coating - MEF feeder cells (8)", "hiPSC Matrix Coating - Vitronectin (10)", "hiPSC Backbone Media - Conditioned (12)", "hiPSC Backbone Media - DMEM/F12 (10)", "hiPSC Backbone Media - Embryonic Stem Cell (127)", "hiPSC Backbone Media - Essential 8 (82)", "hiPSC Backbone Media - mTeSR (106)", "hiPSC Backbone Media - StemFit (5)", "hiPSC Backbone Media - StemFlex (5)", "hiPSC-CM Backbone Media - Commercial CM Kit (12)", "hiPSC-CM Backbone Media - Cor.4U Complete (6)", "hiPSC-CM Backbone Media - DMEM (18)", "hiPSC-CM Backbone Media - iCell Maintenance (86)", "hiPSC-CM Backbone Media - RPMI-1640 (167)", "hiPSC-CM Backbone Media - StemPro-34 (14)", "hiPSC-CM Media Supplement - 1-thioglycerol (14)", "hiPSC-CM Media Supplement - Albumin (28)", "hiPSC-CM Media Supplement - B27 (180)", "hiPSC-CM Media Supplement - Ascorbic Acid (41)", "hiPSC-CM Media Supplement - iCell Maintenance Medium (41)", "hiPSC-CM Media Supplement - L-glutamine (19)", "hiPSC-CM Media Supplement - HEPES (16)", "hiPSC-CM Media Supplement - FBS (16)", "hiPSC-CM Media Supplement - Transferrin (11)", "hiPSC-CM Media Supplement - Mercaptoethanol (10)", "hiPSC-CM Media Supplement - Lipids (9)", "hiPSC-CM Media Supplement - GlutaMax (8)", "hiPSC-CM Media Supplement - Nonessential Amino Acids (8)", "hiPSC-CM Media Supplement - Selenium (7)", "hiPSC-CM Media Supplement - Polyvinylalchohol (6)", "hiPSC-CM Media Supplement - Lipid Mix (5)", "hiPSC-CM Media Supplement - VEGF (4)", "hiPSC-CM Media Supplement - bFGF (3)", "Wnt Induction - CHIR99021 (184)", "Wnt Induction - Activin A (80)", "Wnt Induction - BMP4 (74)", "Wnt Induction - bFGF (45)", "Wnt Induction - StemCell Diff Kit (4)", "Wnt Induction - Wnt3a (3)", "Seeding Confluency Regardless of 2D or 3D (%) - 85 to 89 (43)", "Seeding Confluency Regardless of 2D or 3D (%) - 90 to 94 (26)", "Seeding Confluency Regardless of 2D or 3D (%) - 95 to 100 (23)", "Seeding Confluency Regardless of 2D or 3D (%) - 80 to 84 (12)", "Seeding Confluency Regardless of 2D or 3D (%) - 70 to 79 (11)", "Seeding Confluency Specifically for 2D Protocols (%) - 70 to 79 (6)", "Seeding Confluency Specifically for 3D Protocols (%) - 70 to 79 (3)", "Seeding Confluency Specifically for 2D Protocols (%) - 80 to 84 (5)", "Seeding Confluency Specifically for 3D Protocols (%) - 80 to 84 (5)", "Seeding Confluency Specifically for 2D Protocols (%) - 85 to 89 (26)", "Seeding Confluency Specifically for 3D Protocols (%) - 85 to 89 (12)", "Seeding Confluency Specifically for 2D Protocols (%) - 90 to 94 (12)", "Seeding Confluency Specifically for 3D Protocols (%) - 90 to 94 (13)", "Seeding Confluency Specifically for 2D Protocols (%) - 95 to 100 (6)", "Seeding Confluency Specifically for 3D Protocols (%) - 95 to 100 (13)", "Wnt Induction Duration (days) - 3 days (38)", "Wnt Induction Duration (days) - 4 days (15)", "Wnt Induction Duration (days) - 5 days (8)", "Wnt Induction Duration (days) Quantiles - Q3 (>0 and ≤1) (186)", "Wnt Induction Duration (days) Quantiles - Q2 (>1 and ≤2) (75)", "Wnt Induction Duration (days) Quantiles - Q1 (>2 and ≤5) (61)", "Wnt Inhibitor - IWP (112)", "Wnt Inhibitor - IWR (56)", "Wnt Inhibitor - Wnt-C59 (30)", "Wnt Inhibitor - XAV939 (24)", "Wnt Inhibitor - DS-I-7 (9)", "Wnt Inhibitor - bFGF (8)", "Wnt Inhibitor - KY02111 (7)", "Wnt Inhibitor - BMP4 (7)", "Wnt Inhibitor - VEGF (3)", "Wnt Inhibitor Duration (days) - 4 days (19)", "Wnt Inhibitor Duration (days) - 3 days (17)", "Wnt Inhibitor Duration (days) - >6 days (12)", "Wnt Inhibitor Duration (days) - 5 days (6)", "Wnt Inhibitor Duration (days) - 6 days (4)", "Wnt Inhibitor Duration (days) Quantiles - Q2 (>1 and ≤2) (156)", "Wnt Inhibitor Duration (days) Quantiles - Q3 (>1 and ≤1) (108)", "Wnt Inhibitor Duration (days) Quantiles - Q1 (>2 and ≤9) (58)", "Insulin Start Day - 7 (85)", "Insulin Start Day - 6 (20)", "Insulin Start Day - 1 (19)", "Insulin Start Day - 8 (15)", "Insulin Start Day - 5 (14)", "Insulin Start Day - 4 (11)", "Insulin Start Day - 9 (10)", "Insulin Start Day - 0 (7)", "Insulin Start Day - After 11 (7)", "Insulin Start Day - 10 (6)", "Insulin Start Day - 3 (5)", "Insulin Start Day - 2 (4)", "Insulin Start Day - 11 (3)", "Insulin Withdrawal Duration (days) Quantiles - Q2 (>2 and ≤4) (25)", "Insulin Withdrawal Duration (days) Quantiles - Q1 (>4 and ≤10) (11)", "Insulin Withdrawal Duration (days) - 4 days (18)", "Insulin Withdrawal Duration (days) - 3 days (6)", "Insulin Withdrawal Duration (days) - 6 days (3)", "Insulin Withdrawal Duration (days) - 8 days (3)", "Purification Protocol - Glucose and Lactate (85)", "Purification Protocol - Metabolic (8)", "Purification Protocol - Cell Sorting (7)", "Purification Protocol - Antibiotic (4)", "hiPSC-CM Purification Duration (days) - <3 days (31)", "hiPSC-CM Purification Duration (days) - 4 days (29)", "hiPSC-CM Purification Duration (days) - 3 days (13)", "hiPSC-CM Purification Duration (days) - 6 days (10)", "hiPSC-CM Purification Duration (days) - 5 days (6)", "hiPSC-CM Purification Duration (days) - 7 days (6)", "hiPSC-CM Purification Duration (days) - >9 days (5)", "hiPSC-CM Purification Duration (days) - 8 days (4)", "hiPSC-CM Purification Duration (days) Quantiles - Q2 (>1 and ≤4) (61)", "hiPSC-CM Purification Duration (days) Quantiles - Q1 (>4 and ≤20) (31)", "Differentiation Purity (%) Quantiles - Q4 (>79 and ≤85) (40)", "Differentiation Purity (%) Quantiles - Q3 (>85 and ≤90) (34)", "Differentiation Purity (%) Quantiles - Q5 (>30 and ≤79) (32)", "Differentiation Purity (%) Quantiles - Q2 (>90 and ≤95) (27)", "Differentiation Purity (%) Quantiles - Q1 (>95 and ≤99) (22)", "New Media for Maturation - RPMI-1640 (30)", "New Media for Maturation - DMEM (21)", "New Media for Maturation - F12 (7)", "New Media for Maturation - Commercial Kit (5)", "hiPSC-CM Maturation Media - RPMI-1640 (153)", "hiPSC-CM Maturation Media - iCell Maintenance (83)", "hiPSC-CM Maturation Media - DMEM (35)", "hiPSC-CM Maturation Media - Commercial Kit (27)", "hiPSC-CM Maturation Media - StemPro-34 (14)", "hiPSC-CM Maturation Media - F12 (10)", "hiPSC-CM Maturation Media - Cor.4U Complete (6)", "Coating for Replating - Matrigel (65)", "Coating for Replating - Gelatin (43)", "Coating for Replating - Fibronectin (32)", "Coating for Replating - Geltrex (10)", "Coating for Replating - Laminin (5)", "Coating for Replating - Synthemax (3)", "Coating for Replating - Vitronectin (3)", "Maturation Strategy - Metabolic (33)", "Maturation Strategy - Electrical (39)", "Maturation Strategy - Tension (64)", "Maturation Strategy - Other Cells (80)", "Maturation Strategy - Mechanical (36)", "Maturation Strategy - Cell Alignment (59)", "Maturation Strategy - Elastomeric (33)", "Maturation Strategy - ECM (21)", "Metabolic Maturation Component - T3 (14)", "Metabolic Maturation Component - Fatty Acid (13)", "Metabolic Maturation Component - Palmitic Acid (11)", "Metabolic Maturation Component - Creatine (7)", "Metabolic Maturation Component - Taurine (7)", "Metabolic Maturation Component - Dexamethasone (7)", "Metabolic Maturation Component - L-carnitine (6)", "Metabolic Maturation Component - Nonessential Amino Acids (6)", "Metabolic Maturation Component - Galactose (4)", "Metabolic Maturation Component - Lactate (4)", "Metabolic Maturation Component - Insulin-Transferrin-Selenium (3)", "Metabolic Maturation Component - Vitamin B12 (3)", "Metabolic Maturation Component - Biotin (3)", "Metabolic Maturation Component - Ascorbic Acid (3)", "Metabolic Maturation Component - Albumax (3)", "Metabolic Maturation Component - B27 (3)", "Metabolic Maturation Component - KOSR (3)", "Metabolic Maturation Component - IGF-1 (3)", "Metabolic Maturation Component Category - Fatty Acids and Lipids (21)", "Metabolic Maturation Component Category - Metabolic Modulation (20)", "Metabolic Maturation Component Category - Hormonal Stimulation (14)", "Metabolic Maturation Component Category - Sugars and Carbohydrates (9)", "Metabolic Maturation Component Category - Amino Acids and Derivatives (9)", "Metabolic Maturation Component Category - Signaling Pathway Regulators (6)", "Metabolic Maturation Component Category - Kinase Inhibitors (3)", "2D Surface - ECM-coated (115)", "2D Surface - Micropatterned (27)", "2D Surface - Hydrogel (17)", "2D Surface - Electrospun (13)", "2D Surface - Microelectrode Array (9)", "2D Surface - Nanotopography (6)", "2D Surface - Decellularized ECM (3)", "2D Surface - Microparticle/fluid (3)", "3D Platform - Fibrin (50)", "3D Platform - Scaffold Free (43)", "3D Platform - Collagen (38)", "3D Platform - Matrigel (33)", "3D Platform - Extracellular Scaffold (18)", "3D Platform - 3D printed (9)", "3D Platform - Polyethylene Glycol (8)", "3D Platform - Gelatin (6)", "3D Platform - Fibronectin (3)", "3D Platform - Nanotechnology (3)", "3D Tissue Media - RPMI-1640 (72)", "3D Tissue Media - MEM-α (60)", "3D Tissue Media - DMEM (53)", "3D Tissue Media - Commercial Kit (21)", "3D Tissue Media - Growth Factor (12)", "3D Tissue Media - iCell Maintenance (12)", "3D Tissue Media - High-glucose DMEM (9)", "3D Tissue Media - Iscove (5)", "Differentiation Purity Assessment - Flow Cytometry cTnT+ (135)", "Differentiation Purity Assessment - Flow Cytometry a-actinin+ (9)", "Differentiation Purity Assessment - IHC a-actinin (8)", "Differentiation Purity Assessment - IHC cTnT (7)", "Differentiation Purity Assessment - Visual Inspection (6)", "Differentiation Purity Assessment - Flow Cytometry SIRPA+ (4)", "Differentiation Purity Assessment - Flow Cytometry VCAM1+ (4)", "Differentiation Purity Assessment - Flow Cytometry cTnI+ (3)", "Immunofluorescent Imaging - Yes (268)", "Electron Imaging - Transmission (62)", "Electron Imaging - Scanning (22)", "Sacromere or Cellular Alignment Analysis - Yes (72)", "Contractile Analysis Method - Motion Tracking (93)", "Contractile Analysis Method - Deflection (39)", "Contractile Analysis Method - Force Transducer (27)", "Contractile Analysis Method - Traction Force Microscopy (9)", "Calcium Handling Analysis Method - Visual (104)", "Calcium Handling Analysis Method - Genetical (23)", "Electrophysiology Analysis Method - Patch Clamp (59)", "Electrophysiology Analysis Method - Optical Mapping (39)", "Electrophysiology Analysis Method - Microelectrode (31)", "Electrophysiology Analysis Method - Motion-Contrast Reconstruction (5)", "Electrophysiology Analysis Method - Genetical (3)", "Metabolic Analysis Method - Seahorse (35)", "Metabolic Analysis Method - Flux Rates (13)", "Metabolic Analysis Method - Mitochondrial (4)", "Metabolic Analysis Method - Genetic (3)", "Fatty Acid Metabolism Assessed - Yes (20)", "Gene Analysis Method - RNA (169)", "Cell Line - iCell (47)", "Cell Line - WTC11 (30)", "Cell Line - IMR90 (19)", "Cell Line - Cor.4U (16)", "Cell Line - DF19-9-11T.H (16)", "Cell Line - PGP1 (11)", "Cell Line - 253G1 (10)", "Cell Line - Gibco episomal (10)", "Cell Line - 201B7 (9)", "Cell Line - iCell2 (8)", "Cell Line - SCVI-273 (8)", "Cell Line - BJ1 (7)", "Cell Line - C25 (6)", "Cell Line - ATCC (5)", "Cell Line - Cellapy (4)", "Cell Line - BJ RiPS (4)", "Cell Line - 201B6 (3)", "Number of Cell Lines - 1 (225)", "Number of Cell Lines - 2 (50)", "Number of Cell Lines - 3 (29)", "Number of Cell Lines - 4 (11)", "Number of Cell Lines - >5 (9)", "Cell Line Sex - Both (118)", "Cell Line Sex - Male (64)", "Cell Line Sex - Female (40)", "Cell Line Ancestry - Caucasian (41)", "Cell Line Ancestry - Asian (28)", "Cell Coculture - Cardiomyocyte (157)", "Cell Coculture - Stromal Cell (78)", "Cell Coculture - Endothelial Cell (35)", "3D CM Ratio (CM-EC-SC) Quantiles - Q1 (>91 and ≤100) (74)", "3D CM Ratio (CM-EC-SC) Quantiles - Q3 (>9 and ≤75) (48)", "3D CM Ratio (CM-EC-SC) Quantiles - Q2 (>75 and ≤91) (28)", "3D EC Ratio (CM-EC-SC) Quantiles - Q2 (>0 and ≤0) (119)", "3D EC Ratio (CM-EC-SC) Quantiles - Q1 (>0 and ≤91) (31)", "3D SC Ratio (CM-EC-SC) Quantiles - Q3 (>0 and ≤0) (74)", "3D SC Ratio (CM-EC-SC) Quantiles - Q1 (>10 and ≤50) (47)", "3D SC Ratio (CM-EC-SC) Quantiles - Q2 (>0 and ≤10) (29)", "3D Stromal Cell Source - Human Fibroblast (38)", "3D Stromal Cell Source - Stromal Cell (35)", "3D Stromal Cell Source - Cardiac Fibroblast (32)", "3D Stromal Cell Source - Mesenchymal Stem Cell (12)", "3D Stromal Cell Source - hiPSC-CardiacF (8)", "3D Stromal Cell Source - Dermal Fibroblast (7)", "3D Stromal Cell Source - hiPSC-MuralC (3)", "3D Stromal Cell Source - hiPSC-SmoothMC (3)", "3D Endothelial Cell Source - hiPSC-EndothelialC (16)", "3D Endothelial Cell Source - Umbilical Vein EndothelialC (10)", "3D Endothelial Cell Source - Cardiac Microvascular EndothelialC (5)"]

        # 1. PROCESS USER'S PROTOCOL (either uploaded file or selected features)
        if 'protocol_file' in request_files and request_files['protocol_file'].filename:
            # Extract features from uploaded protocol PDF
            protocol_file = request_files['protocol_file']
            protocol_features = getUserProtocolFeatures(protocol_file, causal_candidates)
        else:
            # Use manually selected features from form
            protocol_features = request_data.getlist('selected_features[]')
        
        print('Step 1 done')

        # 2. PROCESS USER'S EXPERIMENTAL DATA (required)
        if 'experimental_file' not in request_files or not request_files['experimental_file'].filename:
            return {
                'status': 'error',
                'message': 'Experimental data file is required.'
            }
        
        experimental_file = request_files['experimental_file']
        user_data = getUserData(experimental_file)
        
        print('Step 2 done')

        # 3. PROCESS MATURITY INDICATORS FOR USER'S PROTOCOL
        protocol_name, results_dict = process_maturity_indicators(user_data, protocol_features)
        user_protocol_name = protocol_name

        reference_results.append((protocol_name, results_dict))

        # 4. GET SELECTED PURPOSE (required)
        selected_purpose = request_data.get('selected_purpose', '')
        if not selected_purpose:
            return {
                'status': 'error',
                'message': 'Protocol purpose selection is required.'
            }

        # 5. PROCESS PURPOSE-BASED REFERENCE
        # Create empty template for all indicators
        purpose_data = {'ProtocolName': f'{selected_purpose} Protocols'}
        for indicator in [
            'Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)',
            'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
            'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)',
            'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)',
            'Conduction Velocity from Calcium Imaging (cm/s)', 
            'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)',
            'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
            'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)',
            'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TTNI1)'
        ]:
            purpose_data[indicator] = ''
        
        # Get features for the selected purpose
        target_feature_dict = get_target_feature_dict(odds_filepath)
        purpose_features = [feature for feature in target_feature_dict[selected_purpose] if feature in causal_candidates]
        purpose_name, purpose_results = process_maturity_indicators(purpose_data, purpose_features)
        
        # Add to reference results
        reference_results.append((purpose_name, purpose_results))
        
        # 6. PROCESS USER UPLOADED REFERENCE PAIRS
        reference_pairs = json.loads(request_data.get('reference_pairs', '[]')) if 'reference_pairs' in request_data else []
        
        for i, pair in enumerate(reference_pairs):
            if 'protocol' in pair and 'data' in pair:
                ref_protocol_key = f"ref_protocol_{i}"
                ref_data_key = f"ref_data_{i}"
                
                if ref_protocol_key in request_files and ref_data_key in request_files:
                    ref_protocol_file = request_files[ref_protocol_key]
                    ref_data_file = request_files[ref_data_key]
                    
                    # Process reference protocol and data
                    ref_features = getUserProtocolFeatures(ref_protocol_file, causal_candidates)
                    ref_data = getUserData(ref_data_file)
                    ref_name, ref_results = process_maturity_indicators(ref_data, ref_features)
                    
                    # Add to reference results
                    reference_results.append({
                        'id': f"ref_{i}",
                        'name': ref_name or f"Reference {i+1}",
                        'results': ref_results
                    })
        
        # 7. PROCESS DATABASE PROTOCOL IDS
        selected_protocol_ids = request_data.getlist('selected_protocol_ids[]')
        if selected_protocol_ids:
            # Load necessary dataframes
            binary_df = get_binary_df(binary_filepath)
            cleaned_df = get_cleaned_df(cleaned_database_filepath)
            
            for protocol_id in selected_protocol_ids:
                # Convert ID to indices (accounting for 0-based indexing)
                try:
                    binary_index = int(protocol_id) - 1
                    cleaned_index = binary_index + 1  # Adjust as needed based on your data structure
                    
                    # Get protocol features from binary dataframe
                    binary_row = binary_df.iloc[binary_index]
                    db_features = [col for col in causal_candidates if binary_row.get(col, False)]
                    
                    # Get protocol name from cleaned dataframe
                    title = cleaned_df.iloc[cleaned_index]['Title'] if 'Title' in cleaned_df.columns else f"Protocol ID: {protocol_id}"
                    
                    # Create empty indicator data
                    db_data = {'ProtocolName': title}
                    
                    # Check for experimental values in the cleaned dataframe
                    indicators = [
                        'Sarcomere Length (um)', 'Cell Area (um2)', 'T-tubule Structure (Found)',
                        'Contractile Force (mN)', 'Contractile Stress (mN/mm2)', 
                        'Contraction Upstroke Velocity (um/s)', 'Calcium Flux Amplitude (F/F0)',
                        'Time to Calcium Flux Peak (ms)', 'Time from Calcium Peak to Relaxation (ms)',
                        'Conduction Velocity from Calcium Imaging (cm/s)', 
                        'Action Potential Conduction Velocity (cm/s)', 'Action Potential Amplitude (mV)',
                        'Resting Membrane Potential (mV)', 'Beat Rate (bpm)', 
                        'Max Capture Rate of Paced CMs (Hz)', 'MYH7 Percentage (MYH6)',
                        'MYL2 Percentage (MYL7)', 'TNNI3 Percentage (TTNI1)'
                    ]
                    
                    for indicator in indicators:
                        if indicator in cleaned_df.columns:
                            value = cleaned_df.iloc[cleaned_index][indicator]
                            # Only add non-NaN experimental values
                            db_data[indicator] = str(value) if pd.notna(value) else ''
                        else:
                            db_data[indicator] = ''
                    
                    # Process the database protocol
                    db_name, db_results = process_maturity_indicators(db_data, db_features)
                    
                    # Add to database results
                    db_protocol_results.append({
                        'id': protocol_id,
                        'name': db_name or title,
                        'results': db_results
                    })
                except Exception as e:
                    app.logger.error(f"Error processing protocol ID {protocol_id}: {str(e)}")
        
        # 8. PREPARE FINAL RESPONSE
        response_data = {
            'status': 'success',
            'protocol_name': user_protocol_name,
            'selected_purpose': selected_purpose,
            'results': results_dict,
            'reference_results': reference_results,
            'db_protocol_results': db_protocol_results
        }
        
        return response_data
        
    except Exception as e:
        app.logger.error(f"Error in process_benchmark_submission: {str(e)}")
        return {
            'status': 'error',
            'message': f'Error processing benchmark: {str(e)}'
        }

# ----- Web Routes -----
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
    global _benchmark_results_cache
    _benchmark_results_cache.clear()
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
