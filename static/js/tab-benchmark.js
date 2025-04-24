/**
 * Benchmark functionality for CMPortal
 */

// Extend CMPortal namespace
window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

// Flag to track initialization
CMPortal.benchmark.initialized = false;

// Arrays to store selected features for both forms
CMPortal.benchmark.selectedFeaturesRight = [];
CMPortal.benchmark.selectedParameterLeft = null;

// Initialize the benchmark functionality
CMPortal.benchmark.init = function() {
    if (CMPortal.benchmark.initialized) return;
    
    // Initialize form components
    CMPortal.benchmark.initializeForm('left');
    CMPortal.benchmark.initializeForm('right');
    CMPortal.benchmark.initializeUploadArea();
    CMPortal.benchmark.initializeSubmitButton();
    
    CMPortal.benchmark.initialized = true;
};

// Initialize a form (left or right)
CMPortal.benchmark.initializeForm = function(side) {
    const keyDropdown = document.getElementById(`benchmark-key-dropdown-${side}`);
    const checkboxContainer = document.getElementById(`benchmark-checkbox-container-${side}`);
    
    if (!keyDropdown || !checkboxContainer) {
        console.error(`Required elements not found for benchmark form ${side}`);
        return;
    }
    
    keyDropdown.addEventListener('change', function() {
        checkboxContainer.innerHTML = '';
        checkboxContainer.classList.add('search-ui-hidden');
        
        if (side === 'left') {
            CMPortal.benchmark.selectedParameterLeft = null;
        }
        
        CMPortal.benchmark.updateSelectionSummary(side);
        CMPortal.benchmark.updateSubmitButton();
        
        const selectedKey = this.value;
        if (!selectedKey) return;
        
        checkboxContainer.classList.remove('search-ui-hidden');
        checkboxContainer.innerHTML = `<p id="benchmark-loading-message-${side}">Loading features...</p>`;
        
        const payload = new URLSearchParams();
        payload.append('selected_key', selectedKey);
        
        // Different endpoints for left and right forms
        const endpoint = side === 'left'
            ? '/api/get_TargetParameters'
            : '/api/get_ProtocolFeatures';
        
        fetch(endpoint, {
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
            
            // Different input types for left and right forms
            const inputType = side === 'left' ? 'radio' : 'checkbox';
            
            validValues.forEach((value, idx) => {
                const item = document.createElement('div');
                item.className = 'search-ui-checkbox-item';
                
                const input = document.createElement('input');
                input.type = inputType;
                input.id = `benchmark-feature-${side}-${idx}`;
                input.value = value;
                input.name = side === 'left' ? 'selected_feature_left' : 'selected_features_right';
                
                if (side === 'right' && CMPortal.benchmark.selectedFeaturesRight.includes(value)) {
                    input.checked = true;
                }
                
                input.addEventListener('change', function() {
                    if (side === 'left') {
                        if (this.checked) {
                            CMPortal.benchmark.selectedParameterLeft = value;
                        }
                    } else { // right side
                        if (this.checked) {
                            if (!CMPortal.benchmark.selectedFeaturesRight.includes(value)) {
                                CMPortal.benchmark.selectedFeaturesRight.push(value);
                            }
                        } else {
                            CMPortal.benchmark.selectedFeaturesRight = CMPortal.benchmark.selectedFeaturesRight.filter(f => f !== value);
                        }
                    }
                    
                    CMPortal.benchmark.updateSelectionSummary(side);
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
            console.error(`Error loading features for ${side} form:`, err);
            checkboxContainer.innerHTML = '<p>Error loading features. Please try again.</p>';
        });
    });
};

// Initialize the file upload area
CMPortal.benchmark.initializeUploadArea = function() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('protocol-file');
    const browseButton = document.getElementById('browse-button');
    
    if (!uploadArea || !fileInput || !browseButton) {
        console.error('Upload area elements not found');
        return;
    }
    
    // File upload via drag and drop
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
            CMPortal.benchmark.updateUploadAreaText(e.dataTransfer.files[0].name);
            CMPortal.benchmark.updateSubmitButton();
        }
    });
    
    // File upload via browse button
    browseButton.addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });
    
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            CMPortal.benchmark.updateUploadAreaText(this.files[0].name);
            CMPortal.benchmark.updateSubmitButton();
        }
    });
};

// Update the upload area text to show selected file
CMPortal.benchmark.updateUploadAreaText = function(filename) {
    const uploadArea = document.querySelector('.upload-area p');
    if (uploadArea) {
        uploadArea.textContent = `Selected file: ${filename}`;
    }
};

// Update the selection summary for either form
CMPortal.benchmark.updateSelectionSummary = function(side) {
    const summaryEl = document.getElementById(`benchmark-selection-summary-${side}`);
    if (!summaryEl) return;
    summaryEl.innerHTML = '';
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    
    if (side === 'left') {
        const text = document.createElement('span');
        text.textContent = CMPortal.benchmark.selectedParameterLeft ? 
            `${CMPortal.benchmark.selectedParameterLeft} selected` : '';
        container.appendChild(text);
    } else { // right side
        const count = CMPortal.benchmark.selectedFeaturesRight.length;
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
                CMPortal.benchmark.resetFeatureSelections('right');
            });
            container.appendChild(resetBtn);
        }
    }
    
    summaryEl.appendChild(container);
};

// Reset feature selections for a specific form
CMPortal.benchmark.resetFeatureSelections = function(side) {
    if (side === 'left') {
        CMPortal.benchmark.selectedParameterLeft = null;
        const container = document.getElementById('benchmark-checkbox-container-left');
        if (container) {
            container.querySelectorAll('input[type="radio"]').forEach(rb => rb.checked = false);
        }
    } else { // right side
        CMPortal.benchmark.selectedFeaturesRight = [];
        const container = document.getElementById('benchmark-checkbox-container-right');
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
    }
    
    CMPortal.benchmark.updateSelectionSummary(side);
    CMPortal.benchmark.updateSubmitButton();
};

// Initialize the submit button
CMPortal.benchmark.initializeSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;
    
    // Initially disable the button
    submitBtn.disabled = true;
    
    submitBtn.addEventListener('click', function(e) {
        e.preventDefault();
        CMPortal.benchmark.submitBenchmark();
    });
    
    // Also add event listener to the protocol purpose dropdown
    const purposeSelect = document.getElementById('protocol-purpose');
    if (purposeSelect) {
        purposeSelect.addEventListener('change', function() {
            CMPortal.benchmark.updateSubmitButton();
        });
    }
};

// Update the submit button state
CMPortal.benchmark.updateSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;
    
    const fileInput = document.getElementById('protocol-file');
    const purposeSelect = document.getElementById('protocol-purpose');
    
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    const hasRightFeatures = CMPortal.benchmark.selectedFeaturesRight.length > 0;
    const hasLeftParameter = CMPortal.benchmark.selectedParameterLeft !== null;
    const hasPurpose = purposeSelect && purposeSelect.value;
    
    // Enable button if:
    // 1. Protocol purpose is selected AND
    // 2. EITHER a file is uploaded OR at least one feature is selected from either form
    submitBtn.disabled = !(hasPurpose && (hasFile || hasRightFeatures || hasLeftParameter));
};

// Submit the benchmark request
CMPortal.benchmark.submitBenchmark = function() {
    const fileInput = document.getElementById('protocol-file');
    const purposeSelect = document.getElementById('protocol-purpose');
    const resultDisplay = document.getElementById('benchmark-result-display');
    const submissionResult = document.getElementById('benchmark-submission-result');
    
    if (!purposeSelect || !resultDisplay || !submissionResult) {
        console.error('Required elements not found for submission');
        return;
    }
    
    // Check if we have a file or selections from either form
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    const hasRightFeatures = CMPortal.benchmark.selectedFeaturesRight.length > 0;
    const hasLeftParameter = CMPortal.benchmark.selectedParameterLeft !== null;
    
    // Validate that we have at least one selection method
    if (!hasFile && !hasRightFeatures && !hasLeftParameter) {
        alert('Please either upload a file or select features/parameters to benchmark.');
        return;
    }
    
    const formData = new FormData();
    formData.append('protocol_purpose', purposeSelect.value);
    
    if (hasFile) {
        formData.append('protocol_file', fileInput.files[0]);
    }
    
    if (hasLeftParameter) {
        formData.append('target_parameter', CMPortal.benchmark.selectedParameterLeft);
    }
    
    CMPortal.benchmark.selectedFeaturesRight.forEach(feature => {
        formData.append('selected_features[]', feature);
    });
    
    // For demo purposes, display the submission data instead of sending
    const submissionData = {
        purpose: purposeSelect.value,
        useUploadedFile: hasFile,
        useLeftParameter: hasLeftParameter,
        useRightFeatures: hasRightFeatures
    };
    
    // Add file information only if a file was uploaded
    if (hasFile) {
        submissionData.fileName = fileInput.files[0].name;
        submissionData.fileSize = fileInput.files[0].size;
        submissionData.fileType = fileInput.files[0].type;
    }
    
    // Add parameter information if selected
    if (hasLeftParameter) {
        submissionData.targetParameter = CMPortal.benchmark.selectedParameterLeft;
    }
    
    // Add right features if selected
    if (hasRightFeatures) {
        submissionData.selectedFeatures = CMPortal.benchmark.selectedFeaturesRight;
    }
    
    // Display the submission data
    resultDisplay.style.display = 'block';
    submissionResult.textContent = JSON.stringify(submissionData, null, 2);
    
    // Scroll to the result display
    resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // In a real implementation, this would be a fetch call to the server
    /*
    fetch('/api/benchmark', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        // Handle response and update visualization
    })
    .catch(err => {
        console.error('Error submitting benchmark:', err);
    });
    */
};

// Set up event handler for tab activation
$(document).on('tab-activated', function(event, tabId) {
    if (tabId === 'tab-benchmark') {
        CMPortal.benchmark.init();
    }
});