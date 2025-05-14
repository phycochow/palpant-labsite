/**
 * Benchmark functionality for CMPortal
 */

// Extend CMPortal namespace
window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

// Flag to track initialization
CMPortal.benchmark.initialized = false;

// Arrays to store selections
CMPortal.benchmark.selectedOwnProtocolId = null; // NEW: For storing the user's selected protocol ID
CMPortal.benchmark.selectedFeatures = []; // KEPT: For backward compatibility
CMPortal.benchmark.selectedPurpose = null;
CMPortal.benchmark.selectedProtocolIds = [];
CMPortal.benchmark.referencePairs = [];

// Initialize the benchmark functionality
CMPortal.benchmark.init = function() {
    if (CMPortal.benchmark.initialized) return;

    // Initialize form components
    CMPortal.benchmark.initializeOwnProtocolIDSelection(); // NEW: Initialize the own protocol ID selection
    CMPortal.benchmark.initializePurposeForm();
    CMPortal.benchmark.initializeProtocolIdSelection();
    CMPortal.benchmark.initializeFileUploads();
    CMPortal.benchmark.initializeReferencePairs();
    CMPortal.benchmark.initializeSubmitButton();

    CMPortal.benchmark.initialized = true;
};

// NEW: Initialize the own protocol ID selection (left panel)
CMPortal.benchmark.initializeOwnProtocolIDSelection = function() {
    const container = document.getElementById('own-protocol-id-container');
    if (!container) {
        console.error('Own protocol ID container not found');
        return;
    }

    // Populate the container with protocol IDs 001-322 as radio buttons
    for (let i = 1; i <= 322; i++) {
        const id = i.toString().padStart(3, '0');
        const item = document.createElement('div');
        item.className = 'search-ui-checkbox-item';

        const input = document.createElement('input');
        input.type = 'radio'; // Use radio buttons since only one can be selected
        input.id = `own-protocol-id-${id}`;
        input.value = id;
        input.name = 'selected_own_protocol_id';

        input.addEventListener('change', function() {
            if (this.checked) {
                // Update the selected own protocol ID
                CMPortal.benchmark.selectedOwnProtocolId = id;

                // Disable the protocol file upload when a protocol ID is selected
                const protocolFile = document.getElementById('protocol-file');
                if (protocolFile) protocolFile.disabled = true;
                const uploadArea = document.querySelector('.search-ui-container:nth-of-type(1) .upload-area');
                if (uploadArea) {
                    uploadArea.classList.add('disabled');
                    uploadArea.style.opacity = '0.6';
                    uploadArea.style.pointerEvents = 'none';
                }
                const browseButton = document.getElementById('browse-button');
                if (browseButton) browseButton.disabled = true;

                // NEW: Auto-load experimental data when protocol is selected from database
                CMPortal.benchmark.handleAutoExperimentalData(true);
            }
            CMPortal.benchmark.updateSelectionSummary('own-protocol');
            CMPortal.benchmark.updateSubmitButton();
        });

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = `Protocol ID: ${id}`;

        item.append(input, label);
        container.appendChild(item);
    }
};

// NEW: Handle auto-experimental data logic
CMPortal.benchmark.handleAutoExperimentalData = function(isAutoLoaded) {
    const experimentalUploadArea = document.getElementById('experimental-upload-area');
    const autoLoadedMessage = document.getElementById('auto-loaded-message');
    const experimentalFile = document.getElementById('experimental-file');
    const experimentalBrowseButton = document.getElementById('experimental-browse-button');
    
    if (isAutoLoaded) {
        // Disable experimental upload and show auto-loaded message
        if (experimentalUploadArea) {
            experimentalUploadArea.classList.add('disabled');
            experimentalUploadArea.style.opacity = '0.6';
            experimentalUploadArea.style.pointerEvents = 'none';
        }
        if (autoLoadedMessage) {
            autoLoadedMessage.style.display = 'block';
        }
        if (experimentalFile) {
            experimentalFile.disabled = true;
        }
        if (experimentalBrowseButton) {
            experimentalBrowseButton.disabled = true;
        }
        
        // Mark experimental data as complete
        document.getElementById('experimental-progress').classList.add('complete');
        const experimentStatus = document.getElementById('experiment-step-status');
        if (experimentStatus) {
            experimentStatus.textContent = 'Auto-Loaded';
            experimentStatus.classList.add('complete');
        }
        const experimentalMarker = document.getElementById('experimental-file-marker');
        if (experimentalMarker) {
            experimentalMarker.classList.add('complete');
        }
    } else {
        // Enable experimental upload and hide auto-loaded message
        if (experimentalUploadArea) {
            experimentalUploadArea.classList.remove('disabled');
            experimentalUploadArea.style.opacity = '';
            experimentalUploadArea.style.pointerEvents = '';
        }
        if (autoLoadedMessage) {
            autoLoadedMessage.style.display = 'none';
        }
        if (experimentalFile) {
            experimentalFile.disabled = false;
        }
        if (experimentalBrowseButton) {
            experimentalBrowseButton.disabled = false;
        }
        
        // Reset experimental data progress indicator
        const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
        if (!hasExperimentalFile) {
            document.getElementById('experimental-progress').classList.remove('complete');
            const experimentStatus = document.getElementById('experiment-step-status');
            if (experimentStatus) {
                experimentStatus.textContent = 'Incomplete';
                experimentStatus.classList.remove('complete');
            }
            const experimentalMarker = document.getElementById('experimental-file-marker');
            if (experimentalMarker) {
                experimentalMarker.classList.remove('complete');
            }
        }
    }
};

// Initialize file uploads (left and middle panel)
CMPortal.benchmark.initializeFileUploads = function() {
    // Protocol file upload (left panel)
    const uploadArea = document.querySelector('.search-ui-container:nth-of-type(1) .upload-area');
    const fileInput = document.getElementById('protocol-file');
    const browseButton = document.getElementById('browse-button');
    const resetButton = document.getElementById('reset-protocol-file');
    
    if (!uploadArea || !fileInput || !browseButton || !resetButton) {
        console.error('Required elements not found for protocol file upload');
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
            resetButton.style.display = 'inline-block';

            // Disable the protocol ID selection when a file is uploaded
            CMPortal.benchmark.disableOwnProtocolSelection();
            
            // Re-enable experimental data upload
            CMPortal.benchmark.handleAutoExperimentalData(false);
            
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
            resetButton.style.display = 'inline-block';

            // Disable the protocol ID selection when a file is uploaded
            CMPortal.benchmark.disableOwnProtocolSelection();
            
            // Re-enable experimental data upload
            CMPortal.benchmark.handleAutoExperimentalData(false);
            
            CMPortal.benchmark.updateSubmitButton();
        }
    });

    // NEW: Add reset button functionality for protocol file
    resetButton.addEventListener('click', function(e) {
        e.preventDefault();
        // Clear the file input
        fileInput.value = '';
        // Reset the upload area text
        CMPortal.benchmark.updateUploadAreaText(uploadArea, null);
        // Hide the reset button
        resetButton.style.display = 'none';
        // Re-enable the protocol ID selection
        CMPortal.benchmark.enableOwnProtocolSelection();
        
        CMPortal.benchmark.updateSubmitButton();
    });

    // Experimental data upload (middle panel) - keep as before
    CMPortal.benchmark.initializeExperimentalFileUpload();
};

// Helper method to initialize experimental file upload
CMPortal.benchmark.initializeExperimentalFileUpload = function() {
    const uploadArea = document.getElementById('experimental-upload-area');
    const fileInput = document.getElementById('experimental-file');
    const browseButton = document.getElementById('experimental-browse-button');
    
    if (!uploadArea || !fileInput || !browseButton) {
        console.error('Required elements not found for experimental file upload');
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
            CMPortal.benchmark.updateSubmitButton();
        }
    });
};

// Helper method to disable own protocol selection
CMPortal.benchmark.disableOwnProtocolSelection = function() {
    const container = document.getElementById('own-protocol-id-container');
    if (container) {
        // Disable all radio buttons
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.disabled = true;
        });
        // Add disabled styling to container
        container.classList.add('disabled');
        container.style.opacity = '0.6';
        container.style.pointerEvents = 'none';
    }
    // Reset selection
    CMPortal.benchmark.selectedOwnProtocolId = null;
    CMPortal.benchmark.updateSelectionSummary('own-protocol');
};

// Helper method to enable own protocol selection
CMPortal.benchmark.enableOwnProtocolSelection = function() {
    const container = document.getElementById('own-protocol-id-container');
    if (container) {
        // Enable all radio buttons
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.disabled = false;
        });
        // Remove disabled styling from container
        container.classList.remove('disabled');
        container.style.opacity = '';
        container.style.pointerEvents = '';
    }
};

// Update the upload area text (for protocol and experimental uploads)
CMPortal.benchmark.updateUploadAreaText = function(area, filename) {
    const textElement = area.querySelector('p');
    if (textElement) {
        if (filename) {
            textElement.innerHTML = `Selected file: <strong>${filename}</strong>`;
        } else {
            // Reset text to default
            if (area.closest('.search-ui-container:nth-of-type(1)')) {
                textElement.innerHTML = 'Drag and drop your protocol file here';
            } else {
                textElement.innerHTML = '<strong>Required:</strong> Upload your experimental measurements';
            }
        }
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

// Update the selection summary display
CMPortal.benchmark.updateSelectionSummary = function(type) {
    const summaryEl = document.getElementById(`benchmark-selection-summary-${type}`);
    if (!summaryEl) return;
    summaryEl.innerHTML = '';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';

    if (type === 'own-protocol') {
        const text = document.createElement('span');
        text.textContent = CMPortal.benchmark.selectedOwnProtocolId ? 
            `Protocol ID: ${CMPortal.benchmark.selectedOwnProtocolId} selected` : '';
        container.appendChild(text);

        if (CMPortal.benchmark.selectedOwnProtocolId) {
            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'search-ui-reset-button';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                CMPortal.benchmark.resetOwnProtocolSelection();
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

// NEW: Reset own protocol ID selection
CMPortal.benchmark.resetOwnProtocolSelection = function() {
    CMPortal.benchmark.selectedOwnProtocolId = null;
    const container = document.getElementById('own-protocol-id-container');
    if (container) {
        container.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    }
    
    // Update the selection summary
    CMPortal.benchmark.updateSelectionSummary('own-protocol');
    
    // Re-enable the file upload option
    const protocolFile = document.getElementById('protocol-file');
    if (protocolFile) protocolFile.disabled = false;
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.classList.remove('disabled');
        uploadArea.style.opacity = '';
        uploadArea.style.pointerEvents = '';
    }
    const browseButton = document.getElementById('browse-button');
    if (browseButton) browseButton.disabled = false;
    
    // Re-enable experimental data upload (no longer auto-loading)
    CMPortal.benchmark.handleAutoExperimentalData(false);
    
    // Update submit button state
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
    CMPortal.benchmark.updateSubmitButton();
};

// Update the submit button state
CMPortal.benchmark.updateSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;

    const protocolFile = document.getElementById('protocol-file');
    const experimentalFile = document.getElementById('experimental-file');

    const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
    const hasOwnProtocolId = CMPortal.benchmark.selectedOwnProtocolId !== null;
    const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
    const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;

    // Check if any reference pair is incomplete (protocol OR data missing)
    const incompleteReferencePair = CMPortal.benchmark.referencePairs.some(p => 
        (p.protocolFile && !p.dataFile) || (!p.protocolFile && p.dataFile)
    );

    // Enable submit only if:
    // - Protocol file OR own protocol ID is provided
    // - (Experimental file is uploaded OR a protocol ID is selected) - NEW LOGIC
    // - Purpose is selected
    // - NO incomplete reference pair
    const experimentalDataValid = hasExperimentalFile || hasOwnProtocolId; // NEW LOGIC
    submitBtn.disabled = !((hasProtocolFile || hasOwnProtocolId) && experimentalDataValid && hasPurpose && !incompleteReferencePair);
    
    CMPortal.benchmark.updateUIState();
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
    
    // Add protocol file or selected protocol ID
    const protocolFile = document.getElementById('protocol-file');
    if (protocolFile && protocolFile.files && protocolFile.files.length > 0) {
        formData.append('protocol_file', protocolFile.files[0]);
    } else if (CMPortal.benchmark.selectedOwnProtocolId) {
        // If using a protocol from the database, add it as selected_own_protocol_id
        formData.append('selected_own_protocol_id', CMPortal.benchmark.selectedOwnProtocolId);
    } else {
        CMPortal.benchmark.showStatusMessage('❌ Error: You must either upload a protocol or select one from the database', false);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Benchmark Protocol';
        return;
    }
    
    // Add experimental file (only if using own protocol file, not needed if protocol ID is selected)
    const experimentalFile = document.getElementById('experimental-file');
    if (!CMPortal.benchmark.selectedOwnProtocolId) {
        // Only require experimental file if not using a protocol from the database
        if (experimentalFile && experimentalFile.files && experimentalFile.files.length > 0) {
            formData.append('experimental_file', experimentalFile.files[0]);
        } else {
            CMPortal.benchmark.showStatusMessage('❌ Error: Experimental data file is required when using your own protocol', false);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Benchmark Protocol';
            return;
        }
    }
    
    // Add selected purpose (required)
    if (CMPortal.benchmark.selectedPurpose) {
        formData.append('selected_purpose', CMPortal.benchmark.selectedPurpose);
    } else {
        CMPortal.benchmark.showStatusMessage('❌ Error: Protocol purpose selection is required', false);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Benchmark Protocol';
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
                
                // Scroll to the results container after a short delay to ensure rendering is complete
                setTimeout(() => {
                    const resultsContainer = document.getElementById('benchmark-results-container');
                    if (resultsContainer) {
                        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
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

// Update UI state based on selections
CMPortal.benchmark.updateUIState = function() {
    const protocolFile = document.getElementById('protocol-file');
    const experimentalFile = document.getElementById('experimental-file');

    const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
    const hasOwnProtocolId = CMPortal.benchmark.selectedOwnProtocolId !== null;
    const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
    const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;

    // Update protocol step
    if (hasProtocolFile || hasOwnProtocolId) {
        document.getElementById('protocol-progress').classList.add('complete');
    } else {
        document.getElementById('protocol-progress').classList.remove('complete');
    }

    // Update experimental step - consider it complete if either file is uploaded or protocol ID is selected
    if (hasExperimentalFile || hasOwnProtocolId) {
        document.getElementById('experimental-progress').classList.add('complete');
    } else {
        document.getElementById('experimental-progress').classList.remove('complete');
    }

    // Update purpose step
    if (hasPurpose) {
        document.getElementById('purpose-progress').classList.add('complete');
    } else {
        document.getElementById('purpose-progress').classList.remove('complete');
    }

    // Update protocol status text
    const protocolStatus = document.getElementById('protocol-step-status');
    if (protocolStatus) {
        if (hasProtocolFile || hasOwnProtocolId) {
            protocolStatus.textContent = 'Complete';
            protocolStatus.classList.add('complete');
        } else {
            protocolStatus.textContent = 'Incomplete';
            protocolStatus.classList.remove('complete');
        }
    }

    // Update experiment status text - if protocol ID selected, show "Auto-Loaded"
    const experimentStatus = document.getElementById('experiment-step-status');
    if (experimentStatus) {
        if (hasOwnProtocolId) {
            experimentStatus.textContent = 'Auto-Loaded';
            experimentStatus.classList.add('complete');
        } else if (hasExperimentalFile) {
            experimentStatus.textContent = 'Complete';
            experimentStatus.classList.add('complete');
        } else {
            experimentStatus.textContent = 'Incomplete';
            experimentStatus.classList.remove('complete');
        }
    }

    // Update purpose status text
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

    // Update experimental marker
    const experimentalMarker = document.getElementById('experimental-file-marker');
    if (experimentalMarker) {
        if (hasExperimentalFile || hasOwnProtocolId) {
            experimentalMarker.classList.add('complete');
        } else {
            experimentalMarker.classList.remove('complete');
        }
    }

    // Update purpose marker
    const purposeMarker = document.getElementById('purpose-marker');
    if (purposeMarker) {
        if (hasPurpose) {
            purposeMarker.classList.add('complete');
        } else {
            purposeMarker.classList.remove('complete');
        }
    }
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
        const updateUIState = CMPortal.benchmark.updateUIState;
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