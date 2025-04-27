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
CMPortal.benchmark.referenceFiles = [];

// Initialize the benchmark functionality
CMPortal.benchmark.init = function() {
    if (CMPortal.benchmark.initialized) return;
    
    // Initialize form components
    CMPortal.benchmark.initializeFeatureForm();
    CMPortal.benchmark.initializePurposeForm();
    CMPortal.benchmark.initializeProtocolIdSelection();
    CMPortal.benchmark.initializeFileUploads();
    CMPortal.benchmark.initializeSubmitButton();
    
    CMPortal.benchmark.initialized = true;
};

// Initialize the feature selection form (left panel)
CMPortal.benchmark.initializeFeatureForm = function() {
    const keyDropdown = document.getElementById('benchmark-key-dropdown-features');
    const checkboxContainer = document.getElementById('benchmark-checkbox-container-features');
    
    if (!keyDropdown || !checkboxContainer) {
        console.error('Required elements not found for feature form');
        return;
    }
    
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
        
        fetch('/api/get_ProtocolFeatures', {
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
                
                if (CMPortal.benchmark.selectedFeatures.includes(value)) {
                    input.checked = true;
                }
                
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
    
    // Disable feature form when protocol file is uploaded
    const protocolFile = document.getElementById('protocol-file');
    if (protocolFile) {
        protocolFile.addEventListener('change', function() {
            const hasFile = this.files && this.files.length > 0;
            const featureForm = document.getElementById('benchmark-form-features');
            
            if (featureForm) {
                if (hasFile) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    
                    // Reset feature selections
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
    
    if (!keyDropdown || !checkboxContainer) {
        console.error('Required elements not found for purpose form');
        return;
    }
    
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
    
    // Generate protocol IDs from 001 to 322
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
                // Limit to 5 selections
                if (CMPortal.benchmark.selectedProtocolIds.length >= 5) {
                    this.checked = false;
                    alert('You can select a maximum of 5 protocols from the database.');
                    return;
                }
                
                if (!CMPortal.benchmark.selectedProtocolIds.includes(id)) {
                    CMPortal.benchmark.selectedProtocolIds.push(id);
                }
            } else {
                CMPortal.benchmark.selectedProtocolIds = CMPortal.benchmark.selectedProtocolIds.filter(pid => pid !== id);
            }
            
            CMPortal.benchmark.updateSelectionSummary('protocols');
        });
        
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = `Protocol ID: ${id}`;
        
        item.append(input, label);
        container.appendChild(item);
    }
};

// Initialize file uploads
CMPortal.benchmark.initializeFileUploads = function() {
    // Protocol file upload (left panel)
    CMPortal.benchmark.initializeFileUpload(
        document.querySelector('.search-ui-container:nth-of-type(1) .upload-area'),
        document.getElementById('protocol-file'),
        document.getElementById('browse-button'),
        'protocol'
    );
    
    // Experimental file upload (middle panel)
    CMPortal.benchmark.initializeFileUpload(
        document.querySelector('.search-ui-container:nth-of-type(2) .upload-area'),
        document.getElementById('experimental-file'),
        document.getElementById('experimental-browse-button'),
        'experimental'
    );
    
    // Reference files upload (right panel)
    const referenceFilesInput = document.getElementById('reference-files');
    const referenceBrowseButton = document.getElementById('reference-browse-button');
    const referenceUploadArea = document.querySelector('.search-ui-container:nth-of-type(3) .upload-area');
    const referenceFilesList = document.getElementById('reference-files-list');
    
    if (referenceFilesInput && referenceBrowseButton && referenceUploadArea) {
        // File upload via drag and drop
        referenceUploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '#2E7D32';
            this.style.backgroundColor = '#E8F5E9';
        });
        
        referenceUploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '';
            this.style.backgroundColor = '';
        });
        
        referenceUploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '';
            this.style.backgroundColor = '';
            
            if (e.dataTransfer.files.length) {
                CMPortal.benchmark.handleReferenceFiles(e.dataTransfer.files);
            }
        });
        
        // File upload via browse button
        referenceBrowseButton.addEventListener('click', function(e) {
            e.preventDefault();
            referenceFilesInput.click();
        });
        
        referenceFilesInput.addEventListener('change', function() {
            if (this.files.length) {
                CMPortal.benchmark.handleReferenceFiles(this.files);
            }
        });
    }
};

// Handle reference files upload
CMPortal.benchmark.handleReferenceFiles = function(files) {
    const referenceFilesList = document.getElementById('reference-files-list');
    if (!referenceFilesList) return;
    
    // Convert FileList to Array for easier handling
    const newFiles = Array.from(files);
    
    // Check if adding these files would exceed the limit
    if (CMPortal.benchmark.referenceFiles.length + newFiles.length > 3) {
        alert('You can upload a maximum of 3 reference protocol files.');
        return;
    }
    
    // Add new files to our tracking array
    newFiles.forEach(file => {
        if (file.type === 'application/pdf') {
            CMPortal.benchmark.referenceFiles.push(file);
        } else {
            alert(`File "${file.name}" is not a PDF. Only PDF files are accepted.`);
        }
    });
    
    // Update the display
    CMPortal.benchmark.updateReferenceFilesList();
};

// Update the reference files list display
CMPortal.benchmark.updateReferenceFilesList = function() {
    const referenceFilesList = document.getElementById('reference-files-list');
    if (!referenceFilesList) return;
    
    referenceFilesList.innerHTML = '';
    
    CMPortal.benchmark.referenceFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = document.createElement('span');
        fileName.textContent = file.name;
        
        const removeButton = document.createElement('span');
        removeButton.className = 'remove-file';
        removeButton.textContent = '×';
        removeButton.title = 'Remove file';
        removeButton.addEventListener('click', function() {
            CMPortal.benchmark.referenceFiles.splice(index, 1);
            CMPortal.benchmark.updateReferenceFilesList();
        });
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(removeButton);
        referenceFilesList.appendChild(fileItem);
    });
};

// Initialize a file upload area
CMPortal.benchmark.initializeFileUpload = function(uploadArea, fileInput, browseButton, type) {
    if (!uploadArea || !fileInput || !browseButton) {
        console.error(`Required elements not found for ${type} file upload`);
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
            CMPortal.benchmark.updateUploadAreaText(uploadArea, e.dataTransfer.files[0].name);
            
            // If protocol file, disable the feature form
            if (type === 'protocol') {
                const featureForm = document.getElementById('benchmark-form-features');
                if (featureForm) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    
                    // Reset feature selections
                    CMPortal.benchmark.selectedFeatures = [];
                    CMPortal.benchmark.updateSelectionSummary('features');
                }
            }
            
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
            // Validate file type (PDF only)
            const file = this.files[0];
            if (file.type !== 'application/pdf') {
                alert('Only PDF files are accepted. Please select a PDF file.');
                this.value = ''; // Clear the selection
                return;
            }
            
            CMPortal.benchmark.updateUploadAreaText(uploadArea, this.files[0].name);
            
            // If protocol file, disable the feature form
            if (type === 'protocol') {
                const featureForm = document.getElementById('benchmark-form-features');
                if (featureForm) {
                    featureForm.classList.add('disabled');
                    featureForm.querySelectorAll('select, input').forEach(el => el.disabled = true);
                    
                    // Reset feature selections
                    CMPortal.benchmark.selectedFeatures = [];
                    CMPortal.benchmark.updateSelectionSummary('features');
                }
            }
            
            CMPortal.benchmark.updateSubmitButton();
        }
    });
};

// Update the upload area text to show selected file
CMPortal.benchmark.updateUploadAreaText = function(area, filename) {
    const textElement = area.querySelector('p');
    if (textElement) {
        textElement.innerHTML = `Selected file: <strong>${filename}</strong>`;
    }
};

// Update the selection summary for various forms
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
};

// Update the submit button state
CMPortal.benchmark.updateSubmitButton = function() {
    const submitBtn = document.getElementById('benchmark-submit-button');
    if (!submitBtn) return;
    
    const protocolFile = document.getElementById('protocol-file');
    const experimentalFile = document.getElementById('experimental-file');
    
    const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
    const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
    const hasFeatures = CMPortal.benchmark.selectedFeatures.length > 0;
    const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;
    
    // Enable button if:
    // 1. Experimental file is uploaded (required) AND
    // 2. Protocol purpose is selected (required) AND
    // 3. EITHER a protocol file is uploaded OR features are selected
    submitBtn.disabled = !(hasExperimentalFile && hasPurpose && (hasProtocolFile || hasFeatures));
};

// Submit the benchmark request
CMPortal.benchmark.submitBenchmark = function() {
    const protocolFile = document.getElementById('protocol-file');
    const experimentalFile = document.getElementById('experimental-file');
    const resultDisplay = document.getElementById('benchmark-result-display');
    const submissionResult = document.getElementById('benchmark-submission-result');
    
    if (!resultDisplay || !submissionResult) {
        console.error('Result display elements not found');
        return;
    }
    
    // Check if experimental file is uploaded (required)
    const hasExperimentalFile = experimentalFile && experimentalFile.files && experimentalFile.files.length > 0;
    if (!hasExperimentalFile) {
        // Display error in status message instead of alert
        resultDisplay.style.display = 'block';
        const statusMessage = document.getElementById('benchmark-status-message');
        if (statusMessage) {
            statusMessage.className = 'benchmark-status benchmark-status-error';
            statusMessage.textContent = '❌ Benchmark failed: Please upload your experimental measurements file.';
        }
        resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    
    // Check if protocol purpose is selected (required)
    const hasPurpose = CMPortal.benchmark.selectedPurpose !== null;
    if (!hasPurpose) {
        // Display error in status message
        resultDisplay.style.display = 'block';
        const statusMessage = document.getElementById('benchmark-status-message');
        if (statusMessage) {
            statusMessage.className = 'benchmark-status benchmark-status-error';
            statusMessage.textContent = '❌ Benchmark failed: Please select a protocol purpose.';
        }
        resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    
    // Check if we have either a protocol file or feature selections
    const hasProtocolFile = protocolFile && protocolFile.files && protocolFile.files.length > 0;
    const hasFeatures = CMPortal.benchmark.selectedFeatures.length > 0;
    
    if (!hasProtocolFile && !hasFeatures) {
        // Display error in status message instead of alert
        resultDisplay.style.display = 'block';
        const statusMessage = document.getElementById('benchmark-status-message');
        if (statusMessage) {
            statusMessage.className = 'benchmark-status benchmark-status-error';
            statusMessage.textContent = '❌ Benchmark failed: Please either upload your protocol file or select protocol features.';
        }
        resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    
    // Create the submission data object
    const submissionData = {
        // Left panel
        useProtocolFile: hasProtocolFile,
        
        // Middle panel
        useExperimentalFile: hasExperimentalFile,
        
        // Right panel
        useReferenceFiles: CMPortal.benchmark.referenceFiles.length > 0,
        useProtocolIds: CMPortal.benchmark.selectedProtocolIds.length > 0
    };
    
    // Add protocol file information if uploaded
    if (hasProtocolFile) {
        submissionData.protocolFileName = protocolFile.files[0].name;
        submissionData.protocolFileSize = protocolFile.files[0].size;
        submissionData.protocolFileType = protocolFile.files[0].type;
    }
    
    // Add feature selections if applicable
    if (hasFeatures) {
        submissionData.selectedFeatures = CMPortal.benchmark.selectedFeatures;
    }
    
    // Add experimental file information
    submissionData.experimentalFileName = experimentalFile.files[0].name;
    submissionData.experimentalFileSize = experimentalFile.files[0].size;
    submissionData.experimentalFileType = experimentalFile.files[0].type;
    
    // Add purpose information if selected
    if (hasPurpose) {
        submissionData.selectedPurpose = CMPortal.benchmark.selectedPurpose;
    }
    
    // Add reference files information if uploaded
    if (CMPortal.benchmark.referenceFiles.length > 0) {
        submissionData.referenceFiles = CMPortal.benchmark.referenceFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));
    }
    
    // Add protocol IDs if selected
    if (CMPortal.benchmark.selectedProtocolIds.length > 0) {
        submissionData.selectedProtocolIds = CMPortal.benchmark.selectedProtocolIds;
    }
    
    // Display the submission data in the results area
    resultDisplay.style.display = 'block';
    
    // Show success message
    const statusMessage = document.getElementById('benchmark-status-message');
    if (statusMessage) {
        statusMessage.className = 'benchmark-status benchmark-status-success';
        statusMessage.textContent = '✅ Benchmark success: Graphs configuring below.';
    }
    
    // Display the JSON data
    submissionResult.textContent = JSON.stringify(submissionData, null, 2);
    
    // Force visibility with a slight delay to ensure DOM update
    setTimeout(function() {
        resultDisplay.style.display = 'block';
        resultDisplay.style.visibility = 'visible';
        resultDisplay.style.opacity = '1';
    }, 100);
    
    // Log to console for debugging
    console.log("Benchmark submission data:", submissionData);
    
    // In a real implementation, this would create a FormData object and submit to server
    /*
    const formData = new FormData();
    
    // Add protocol file or features
    if (hasProtocolFile) {
        formData.append('protocol_file', protocolFile.files[0]);
    } else {
        CMPortal.benchmark.selectedFeatures.forEach(feature => {
            formData.append('selected_features[]', feature);
        });
    }
    
    // Add experimental file (required)
    formData.append('experimental_file', experimentalFile.files[0]);
    
    // Add purpose if selected
    if (hasPurpose) {
        formData.append('purpose', CMPortal.benchmark.selectedPurpose);
    }
    
    // Add reference files if any
    CMPortal.benchmark.referenceFiles.forEach((file, index) => {
        formData.append(`reference_file_${index}`, file);
    });
    
    // Add protocol IDs if any
    CMPortal.benchmark.selectedProtocolIds.forEach(id => {
        formData.append('protocol_ids[]', id);
    });
    
    // Submit the form data to the server
    fetch('/api/benchmark', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        // Handle the response
        resultDisplay.style.display = 'block';
        submissionResult.textContent = JSON.stringify(data, null, 2);
    })
    .catch(error => {
        console.error('Error submitting benchmark data:', error);
        resultDisplay.style.display = 'block';
        submissionResult.textContent = `Error: ${error.message}`;
    });
    */
    
    // Scroll to the result display
    resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Set up event handler for tab activation
$(document).on('tab-activated', function(event, tabId) {
    if (tabId === 'tab-benchmark') {
        CMPortal.benchmark.init();
    }
});