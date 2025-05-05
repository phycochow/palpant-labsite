/**
 * Benchmark functionality for CMPortal
 */

// Extend CMPortal namespace
window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

// Flag to track initialization
CMPortal.benchmark.initialized = false;

// Arrays to store selections
CMPortal.benchmark.selectedFeatures = [];
CMPortal.benchmark.selectedPurpose = null;
CMPortal.benchmark.selectedProtocolIds = [];
CMPortal.benchmark.referencePairs = [];

// Initialize the benchmark functionality
CMPortal.benchmark.init = function() {
    if (CMPortal.benchmark.initialized) return;

    // Initialize form components
    CMPortal.benchmark.initializeFeatureForm();
    CMPortal.benchmark.initializePurposeForm();
    CMPortal.benchmark.initializeProtocolIdSelection();
    CMPortal.benchmark.initializeFileUploads();
    CMPortal.benchmark.initializeReferencePairs();
    CMPortal.benchmark.initializeSubmitButton();

    CMPortal.benchmark.initialized = true;
};

// Initialize the feature selection form (left panel)
CMPortal.benchmark.initializeFeatureForm = function() {
    const keyDropdown = document.getElementById('benchmark-key-dropdown-features');
    const checkboxContainer = document.getElementById('benchmark-checkbox-container-features');
    if (!keyDropdown || !checkboxContainer) return console.error('Feature form elements missing');

    keyDropdown.addEventListener('change', function() {
        checkboxContainer.innerHTML = '';
        checkboxContainer.classList.add('search-ui-hidden');
        CMPortal.benchmark.selectedFeatures = [];
        CMPortal.benchmark.updateSelectionSummary('features');
        CMPortal.benchmark.updateSubmitButton();

        const selectedKey = this.value;
        if (!selectedKey) return;
        checkboxContainer.classList.remove('search-ui-hidden');
        checkboxContainer.innerHTML = `<p id="benchmark-loading-message-features">Loading features...</p>`;

        const payload = new URLSearchParams();
        payload.append('selected_key', selectedKey);

        // Update the endpoint to use the causal feature categories API
        fetch('/api/get_CausalFeatures', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
            body: payload.toString()
        })
        .then(res => res.json())
        .then(data => {
            checkboxContainer.innerHTML = '';
            const validValues = (data.values || []).filter(v => v && v.trim());
            if (!validValues.length) {
                checkboxContainer.textContent = 'No features available for this category.';
                return;
            }
            validValues.forEach((value, idx) => {
                const item = document.createElement('div');
                item.className = 'search-ui-checkbox-item';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `benchmark-feature-${idx}`;
                input.value = value;
                input.name = 'selected_features';
                if (CMPortal.benchmark.selectedFeatures.includes(value)) input.checked = true;
                input.addEventListener('change', function() {
                    if (this.checked) {
                        if (!CMPortal.benchmark.selectedFeatures.includes(value)) {
                            CMPortal.benchmark.selectedFeatures.push(value);
                        }
                    } else {
                        CMPortal.benchmark.selectedFeatures = CMPortal.benchmark.selectedFeatures.filter(f => f !== value);
                    }
                    CMPortal.benchmark.updateSelectionSummary('features');
                    CMPortal.benchmark.updateSubmitButton();
                });
                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = value;
                item.append(input, label);
                checkboxContainer.appendChild(item);
            });
        })
        .catch(err => {
            console.error('Error loading features:', err);
            checkboxContainer.innerHTML = '<p>Error loading features. Please try again.</p>';
        });
    });

    const protocolFile = document.getElementById('protocol-file');
    if (protocolFile) {
        protocolFile.addEventListener('change', function() {
            const hasFile = this.files && this.files.length > 0;
            const featureForm = document.getElementById('benchmark-form-features');
            if (featureForm) {
                if (hasFile) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    CMPortal.benchmark.selectedFeatures = [];
                    CMPortal.benchmark.updateSelectionSummary('features');
                } else {
                    featureForm.classList.remove('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = false);
                }
                CMPortal.benchmark.updateSubmitButton();
            }
        });
    }
};

// Initialize the purpose selection form (middle panel)
CMPortal.benchmark.initializePurposeForm = function() {
    const keyDropdown = document.getElementById('benchmark-key-dropdown-purpose');
    const checkboxContainer = document.getElementById('benchmark-checkbox-container-purpose');
    if (!keyDropdown || !checkboxContainer) return console.error('Purpose form elements missing');

    keyDropdown.addEventListener('change', function() {
        checkboxContainer.innerHTML = '';
        checkboxContainer.classList.add('search-ui-hidden');
        CMPortal.benchmark.selectedPurpose = null;
        CMPortal.benchmark.updateSelectionSummary('purpose');
        CMPortal.benchmark.updateSubmitButton();

        const selectedKey = this.value;
        if (!selectedKey) return;
        checkboxContainer.classList.remove('search-ui-hidden');
        checkboxContainer.innerHTML = `<p id="benchmark-loading-message-purpose">Loading parameters...</p>`;

        const payload = new URLSearchParams();
        payload.append('selected_key', selectedKey);

        fetch('/api/get_TargetParameters', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
            body: payload.toString()
        })
        .then(res => res.json())
        .then(data => {
            checkboxContainer.innerHTML = '';
            const validValues = (data.values || []).filter(v => v && v.trim());
            if (!validValues.length) {
                checkboxContainer.textContent = 'No parameters available for this category.';
                return;
            }
            validValues.forEach((value, idx) => {
                const item = document.createElement('div');
                item.className = 'search-ui-checkbox-item';
                const input = document.createElement('input');
                input.type = 'radio';
                input.id = `benchmark-purpose-${idx}`;
                input.value = value;
                input.name = 'selected_purpose';
                input.addEventListener('change', function() {
                    if (this.checked) {
                        CMPortal.benchmark.selectedPurpose = value;
                    }
                    CMPortal.benchmark.updateSelectionSummary('purpose');
                    CMPortal.benchmark.updateSubmitButton();
                });
                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = value;
                item.append(input, label);
                checkboxContainer.appendChild(item);
            });
        })
        .catch(err => {
            console.error('Error loading parameters:', err);
            checkboxContainer.innerHTML = '<p>Error loading parameters. Please try again.</p>';
        });
    });
};

// Initialize the protocol ID selection (right panel)
CMPortal.benchmark.initializeProtocolIdSelection = function() {
    const container = document.getElementById('protocol-id-container');
    if (!container) {
        console.error('Protocol ID container not found');
        return;
    }

    for (let i = 1; i <= 322; i++) {
        const id = i.toString().padStart(3, '0');
        const item = document.createElement('div');
        item.className = 'search-ui-checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `protocol-id-${id}`;
        input.value = id;
        input.name = 'selected_protocol_ids';

        input.addEventListener('change', function() {
            if (this.checked) {
                if (CMPortal.benchmark.selectedProtocolIds.length >= 3) {
                    this.checked = false;
                    alert('You can select a maximum of 3 protocols from the database.');
                    return;
                }
                if (!CMPortal.benchmark.selectedProtocolIds.includes(id)) {
                    CMPortal.benchmark.selectedProtocolIds.push(id);
                }
            } else {
                CMPortal.benchmark.selectedProtocolIds = CMPortal.benchmark.selectedProtocolIds.filter(pid => pid !== id);
            }
            CMPortal.benchmark.updateSelectionSummary('protocols');
            CMPortal.benchmark.updateSubmitButton();
        });

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = `Protocol ID: ${id}`;

        item.append(input, label);
        container.appendChild(item);
    }
};

// Initialize file uploads (left and middle panel)
CMPortal.benchmark.initializeFileUploads = function() {
    // Protocol file upload (left panel)
    CMPortal.benchmark.initializeFileUpload(
        document.querySelector('.search-ui-container:nth-of-type(1) .upload-area'),
        document.getElementById('protocol-file'),
        document.getElementById('browse-button'),
        'protocol'
    );

    // Experimental data upload (middle panel)
    CMPortal.benchmark.initializeFileUpload(
        document.querySelector('.search-ui-container:nth-of-type(2) .upload-area'),
        document.getElementById('experimental-file'),
        document.getElementById('experimental-browse-button'),
        'experimental'
    );
};

// Initialize a file upload area (for protocol and experimental files)
CMPortal.benchmark.initializeFileUpload = function(uploadArea, fileInput, browseButton, type) {
    if (!uploadArea || !fileInput || !browseButton) {
        console.error(`Required elements not found for ${type} file upload`);
        return;
    }

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#2E7D32';
        this.style.backgroundColor = '#E8F5E9';
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '';
        this.style.backgroundColor = '';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '';
        this.style.backgroundColor = '';

        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            CMPortal.benchmark.updateUploadAreaText(uploadArea, e.dataTransfer.files[0].name);

            if (type === 'protocol') {
                const featureForm = document.getElementById('benchmark-form-features');
                if (featureForm) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    CMPortal.benchmark.selectedFeatures = [];
                    CMPortal.benchmark.updateSelectionSummary('features');
                }
            }

            CMPortal.benchmark.updateSubmitButton();
        }
    });

    browseButton.addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            const file = this.files[0];
            CMPortal.benchmark.updateUploadAreaText(uploadArea, file.name);

            if (type === 'protocol') {
                const featureForm = document.getElementById('benchmark-form-features');
                if (featureForm) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    CMPortal.benchmark.selectedFeatures = [];
                    CMPortal.benchmark.updateSelectionSummary('features');
                }
            }

            CMPortal.benchmark.updateSubmitButton();
        }
    });
};

// Update the upload area text (for protocol and experimental uploads)
CMPortal.benchmark.updateUploadAreaText = function(area, filename) {
    const textElement = area.querySelector('p');
    if (textElement) {
        textElement.innerHTML = `Selected file: <strong>${filename}</strong>`;
    }
};

// Initialize the reference protocol/data pairs
CMPortal.benchmark.initializeReferencePairs = function() {
    const addBtn = document.getElementById('add-reference-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.preventDefault();
            CMPortal.benchmark.addReferencePair();
        });
    }
    CMPortal.benchmark.addReferencePair(); // Add first empty reference block automatically
};

CMPortal.benchmark.addReferencePair = function() {
    if (CMPortal.benchmark.referencePairs.length >= 2) return;
    const idx = CMPortal.benchmark.referencePairs.length;
    const pair = { protocolFile: null, dataFile: null };
    CMPortal.benchmark.referencePairs.push(pair);

    const container = document.getElementById('reference-pairs-container');
    const block = document.createElement('div');
    block.className = 'reference-pair';
    block.dataset.index = idx;

    block.innerHTML = `
      <div class="upload-pair">
        <div class="upload-area protocol-area">
          <p>Protocol PDF</p>
          <input type="file" class="ref-protocol-input" accept=".pdf" style="display:none">
          <button class="btn btn-secondary browse-protocol">Browse File</button>
          <div class="filename protocol-name"></div>
        </div>
        <div class="upload-area data-area">
          <p>Data PDF</p>
          <input type="file" class="ref-data-input" accept=".pdf" style="display:none">
          <button class="btn btn-secondary browse-data">Browse File</button>
          <div class="filename data-name"></div>
        </div>
      </div>
    `;
    container.appendChild(block);

    const protBtn = block.querySelector('.browse-protocol');
    const protInput = block.querySelector('.ref-protocol-input');
    const protName = block.querySelector('.protocol-name');
    protBtn.addEventListener('click', e => { e.preventDefault(); protInput.click(); });
    protInput.addEventListener('change', () => {
        const f = protInput.files[0];
        if (f) {
            pair.protocolFile = f;
            protName.textContent = f.name;
        } else {
            pair.protocolFile = null;
            protName.textContent = '';
        }
        CMPortal.benchmark.onReferencePairChange(idx);
    });

    const dataBtn = block.querySelector('.browse-data');
    const dataInput = block.querySelector('.ref-data-input');
    const dataName = block.querySelector('.data-name');
    dataBtn.addEventListener('click', e => { e.preventDefault(); dataInput.click(); });
    dataInput.addEventListener('change', () => {
        const f = dataInput.files[0];
        if (f) {
            pair.dataFile = f;
            dataName.textContent = f.name;
        } else {
            pair.dataFile = null;
            dataName.textContent = '';
        }
        CMPortal.benchmark.onReferencePairChange(idx);
    });

    CMPortal.benchmark.onReferencePairChange(idx);
};

CMPortal.benchmark.onReferencePairChange = function(idx) {
    const pair = CMPortal.benchmark.referencePairs[idx];
    const addBtn = document.getElementById('add-reference-btn');

    if (pair.protocolFile && pair.dataFile && CMPortal.benchmark.referencePairs.length < 2) {
        addBtn.style.display = 'inline-block';
    } else {
        addBtn.style.display = 'none';
    }
    CMPortal.benchmark.updateSubmitButton();
};

// Initialize the submit button
CMPortal.benchmark.initializeSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.addEventListener('click', function(e) {
        e.preventDefault();
        CMPortal.benchmark.submitAndDisplayResults();
    });
};

// Update the submit button state
CMPortal.benchmark.updateSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;

    const protocolFile = document.getElementById('protocol-file');
    const experimentalFile = document.getElementById('experimental-file');

    const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
    const hasFeatures = CMPortal.benchmark.selectedFeatures.length > 0;
    const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
    const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;

    // Important: Check if any reference pair is incomplete (protocol OR data missing)
    const incompleteReferencePair = CMPortal.benchmark.referencePairs.some(p => 
        (p.protocolFile && !p.dataFile) || (!p.protocolFile && p.dataFile)
    );

    // Enable submit only if:
    // - Experimental file is uploaded
    // - Purpose is selected
    // - Protocol file OR feature selection provided
    // - NO incomplete reference pair
    submitBtn.disabled = !(hasExperimentalFile && hasPurpose && (hasProtocolFile || hasFeatures) && !incompleteReferencePair);
};

// Update the selection summary display
CMPortal.benchmark.updateSelectionSummary = function(type) {
    const summaryEl = document.getElementById(`benchmark-selection-summary-${type}`);
    if (!summaryEl) return;
    summaryEl.innerHTML = '';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';

    if (type === 'features') {
        const count = CMPortal.benchmark.selectedFeatures.length;
        const text = document.createElement('span');
        text.textContent = count ? `Selected ${count} feature(s)` : '';
        container.appendChild(text);

        if (count) {
            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'search-ui-reset-button';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                CMPortal.benchmark.resetFeatureSelections();
            });
            container.appendChild(resetBtn);
        }
    } else if (type === 'purpose') {
        const text = document.createElement('span');
        text.textContent = CMPortal.benchmark.selectedPurpose ? 
            `${CMPortal.benchmark.selectedPurpose} selected` : '';
        container.appendChild(text);
    } else if (type === 'protocols') {
        const count = CMPortal.benchmark.selectedProtocolIds.length;
        const text = document.createElement('span');
        text.textContent = count ? `Selected ${count} protocol ID(s)` : '';
        container.appendChild(text);

        if (count) {
            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'search-ui-reset-button';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                CMPortal.benchmark.resetProtocolIdSelections();
            });
            container.appendChild(resetBtn);
        }
    }

    summaryEl.appendChild(container);
};

// Reset feature selections
CMPortal.benchmark.resetFeatureSelections = function() {
    CMPortal.benchmark.selectedFeatures = [];
    const container = document.getElementById('benchmark-checkbox-container-features');
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    CMPortal.benchmark.updateSelectionSummary('features');
    CMPortal.benchmark.updateSubmitButton();
};

// Reset protocol ID selections
CMPortal.benchmark.resetProtocolIdSelections = function() {
    CMPortal.benchmark.selectedProtocolIds = [];
    const container = document.getElementById('protocol-id-container');
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    CMPortal.benchmark.updateSelectionSummary('protocols');
};

// Display status message
CMPortal.benchmark.showStatusMessage = function(message, isSuccess) {
    const statusMessage = document.getElementById('benchmark-status-message');
    
    if (!statusMessage) return;
    
    // Update message and styling
    statusMessage.textContent = message;
    statusMessage.className = isSuccess ? 
        'benchmark-status benchmark-status-success' : 
        'benchmark-status benchmark-status-error';
};

// New function to handle form submission and display results
CMPortal.benchmark.submitAndDisplayResults = function() {
    // Show loading state
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    }

    // Show the results container with loading message
    const resultsContainer = document.getElementById('benchmark-results-container');
    if (resultsContainer) {
    resultsContainer.style.display = 'block';
    }

    // Show loading message
    const statusMessage = document.getElementById('benchmark-status-message');
    if (statusMessage) {
    statusMessage.textContent = 'Processing your protocol submission...';
    statusMessage.className = 'benchmark-status benchmark-status-success';
    } else {
    console.warn('Status message element not found');
    }
    
    // Create FormData object for file upload
    const formData = new FormData();
    
    // Add protocol file or selected features
    const protocolFile = document.getElementById('protocol-file');
    if (protocolFile && protocolFile.files && protocolFile.files.length > 0) {
        formData.append('protocol_file', protocolFile.files[0]);
    } else {
        // Add selected features
        CMPortal.benchmark.selectedFeatures.forEach(feature => {
            formData.append('selected_features[]', feature);
        });
    }
    
    // Add experimental file (required)
    const experimentalFile = document.getElementById('experimental-file');
    if (experimentalFile && experimentalFile.files && experimentalFile.files.length > 0) {
        formData.append('experimental_file', experimentalFile.files[0]);
    } else {
        CMPortal.benchmark.showStatusMessage('❌ Error: Experimental data file is required', false);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Benchmark Protocol';
        return;
    }
    
    // Add selected purpose (required)
    if (CMPortal.benchmark.selectedPurpose) {
        formData.append('selected_purpose', CMPortal.benchmark.selectedPurpose);
    } else {
        CMPortal.benchmark.showStatusMessage('❌ Error: Protocol purpose selection is required', false);
        submitBtn.disabled = false;submitBtn.textContent = 'Benchmark Protocol';
        return;
    }
    
    // Add reference pairs
    const referencePairs = CMPortal.benchmark.referencePairs.filter(pair => pair.protocolFile && pair.dataFile);
    if (referencePairs.length > 0) {
        // Convert to JSON to send in form data
        formData.append('reference_pairs', JSON.stringify(
            referencePairs.map(pair => ({
                protocol: pair.protocolFile.name,
                data: pair.dataFile.name
            }))
        ));
        
        // Add actual files
        referencePairs.forEach((pair, i) => {
            formData.append(`ref_protocol_${i}`, pair.protocolFile);
            formData.append(`ref_data_${i}`, pair.dataFile);
        });
    }
    
    // Add selected protocol IDs
    CMPortal.benchmark.selectedProtocolIds.forEach(id => {
        formData.append('selected_protocol_ids[]', id);
    });
    
    // Make the API request
    fetch('/api/submit_benchmark', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Benchmark Protocol';
        
        // If there's an error, show it and stop
        if (data.status === 'error') {
            CMPortal.benchmark.showStatusMessage(`❌ ${data.message}`, false);
            return;
        }
        
        // Update UI with success message
        CMPortal.benchmark.showStatusMessage('✅ Protocol benchmarking completed successfully', true);
        
        // Initialize the radar chart visualization if available
        if (typeof CMPortal.benchmarkRadar !== 'undefined' && 
            typeof CMPortal.benchmarkRadar.visualizeResults === 'function') {
          
            // Format the results for the radar chart
            const radarData = CMPortal.benchmark.formatResultsForRadar(data);
          
            // Visualize the results
            if (radarData && radarData.length > 0) {
                CMPortal.benchmarkRadar.visualizeResults(radarData);
            }
        }
    })
    .catch(err => {
        console.error('Error submitting benchmark:', err);
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Benchmark Protocol';
        
        // Show error message
        CMPortal.benchmark.showStatusMessage(`❌ Error processing benchmark: ${err.message}`, false);
    });
};

// Format the results for the radar chart
CMPortal.benchmark.formatResultsForRadar = function(data) {
    // Check if we have valid data
    if (!data || data.status === 'error') return null;
    
    // Create the array of [name, results] pairs expected by the radar chart
    const radarData = [];
    
    // Add main protocol results
    radarData.push([
        data.protocol_name || 'Your Protocol',
        data.results
    ]);
    
    // Add reference protocol results
    if (data.reference_results && data.reference_results.length > 0) {
        data.reference_results.forEach(reference => {
            radarData.push([
                reference.name || 'Reference Protocol',
                reference.results
            ]);
        });
    }
    
    // Add database protocol results
    if (data.db_protocol_results && data.db_protocol_results.length > 0) {
        data.db_protocol_results.forEach(dbProtocol => {
            radarData.push([
                dbProtocol.name || `Protocol ID: ${dbProtocol.id}`,
                dbProtocol.results
            ]);
        });
    }
    
    return radarData;
};

// Tab activation handler (for lazy init)
$(document).on('tab-activated', function(event, tabId) {
    if (tabId === 'tab-benchmark') {
        CMPortal.benchmark.init();
    }
});

// DOM loaded setup
document.addEventListener('DOMContentLoaded', function() {
    CMPortal.benchmark.initializeCombinedUI = function() {
        const updateUIState = function() {
            const protocolFile = document.getElementById('protocol-file');
            const experimentalFile = document.getElementById('experimental-file');

            const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
            const hasFeatures = CMPortal.benchmark.selectedFeatures.length > 0;
            const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
            const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;

            if (hasProtocolFile || hasFeatures) {
                document.getElementById('protocol-progress').classList.add('complete');
            } else {
                document.getElementById('protocol-progress').classList.remove('complete');
            }

            if (hasExperimentalFile) {
                document.getElementById('experimental-progress').classList.add('complete');
            } else {
                document.getElementById('experimental-progress').classList.remove('complete');
            }

            if (hasPurpose) {
                document.getElementById('purpose-progress').classList.add('complete');
            } else {
                document.getElementById('purpose-progress').classList.remove('complete');
            }

            const protocolStatus = document.getElementById('protocol-step-status');
            if (protocolStatus) {
                if (hasProtocolFile || hasFeatures) {
                    protocolStatus.textContent = 'Complete';
                    protocolStatus.classList.add('complete');
                } else {
                    protocolStatus.textContent = 'Incomplete';
                    protocolStatus.classList.remove('complete');
                }
            }

            const experimentStatus = document.getElementById('experiment-step-status');
            if (experimentStatus) {
                if (hasExperimentalFile) {
                    experimentStatus.textContent = 'Complete';
                    experimentStatus.classList.add('complete');
                } else {
                    experimentStatus.textContent = 'Incomplete';
                    experimentStatus.classList.remove('complete');
                }
            }

            const purposeStatus = document.getElementById('purpose-step-status');
            if (purposeStatus) {
                if (hasPurpose) {
                    purposeStatus.textContent = 'Complete';
                    purposeStatus.classList.add('complete');
                } else {
                    purposeStatus.textContent = 'Incomplete';
                    purposeStatus.classList.remove('complete');
                }
            }

            const experimentalMarker = document.getElementById('experimental-file-marker');
            if (experimentalMarker) {
                if (hasExperimentalFile) {
                    experimentalMarker.classList.add('complete');
                } else {
                    experimentalMarker.classList.remove('complete');
                }
            }

            const purposeMarker = document.getElementById('purpose-marker');
            if (purposeMarker) {
                if (hasPurpose) {
                    purposeMarker.classList.add('complete');
                } else {
                    purposeMarker.classList.remove('complete');
                }
            }
        };

        const originalUpdateSubmitButton = CMPortal.benchmark.updateSubmitButton;
        CMPortal.benchmark.updateSubmitButton = function() {
            originalUpdateSubmitButton.call(this);
            updateUIState();
        };

        updateUIState();
    };

    if (typeof CMPortal.benchmark.init === 'function') {
        const originalInit = CMPortal.benchmark.init;
        CMPortal.benchmark.init = function() {
            originalInit.call(this);
            this.initializeCombinedUI();
        };
    }
});