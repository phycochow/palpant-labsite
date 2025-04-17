window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

/**
 * tab-search.js - Dual-Form Variable Search with Aggregated Submission and Error Handling
 * - Left panel uses TargetParameterFindings data
 * - Right panel uses FeatureCategories data
 */
(function() {
    let isInitialized = false;
    let selectedFeaturesLeft = [];
    let selectedFeaturesRight = [];

    function initializeForm(side) {
        const keyDropdown = document.getElementById(`search-ui-key-dropdown-${side}`);
        const checkboxContainer = document.getElementById(`search-ui-checkbox-container-${side}`);
        const selectionSummary = document.getElementById(`search-ui-selection-summary-${side}`);

        if (!keyDropdown) {
            console.error(`Dropdown element for side '${side}' not found.`);
            return;
        }
        if (!checkboxContainer) {
            console.error(`Checkbox container element for side '${side}' not found.`);
            return;
        }

        keyDropdown.addEventListener('change', function() {
            // Clear previous UI elements for this side, but keep selections for right panel
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');
            
            // Only clear selections for left panel (target parameter)
            if (side === 'left') {
                selectedFeaturesLeft = [];
            }
            // Right panel selections persist across category changes
            
            updateSelectionSummary(side);
            updateGlobalSubmitButton();

            const selectedKey = this.value;
            if (selectedKey) {
                checkboxContainer.classList.remove('search-ui-hidden');
                checkboxContainer.innerHTML = `<p id="search-ui-loading-message-${side}">Loading features...</p>`;
                const formData = new FormData();
                formData.append('selected_key', selectedKey);

                // Use different endpoint based on which side we're loading for
                const endpoint = side === 'left' 
                    ? '/api/get_TargetParameters'  // New endpoint for target parameters
                    : '/api/get_ProtocolFeatures'; // Original endpoint for protocol features

                fetch(endpoint, {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    checkboxContainer.innerHTML = '';
                    const validValues = data.values.filter(value => value && value.trim() !== '');
                    if (validValues.length === 0) {
                        const noItems = document.createElement('p');
                        noItems.textContent = 'No features available for this category.';
                        checkboxContainer.appendChild(noItems);
                        return;
                    }
                    
                    // Determine if we should use radio buttons (left side) or checkboxes (right side)
                    const inputType = side === 'left' ? 'radio' : 'checkbox';
                    
                    validValues.forEach((value, index) => {
                        const checkboxItem = document.createElement('div');
                        checkboxItem.className = 'search-ui-checkbox-item';

                        const input = document.createElement('input');
                        input.type = inputType;
                        input.id = `search-ui-feature-${side}-${index}`;
                        input.value = value;
                        input.name = side === 'left' ? 'selected_feature_left' : 'selected_features';
                        
                        // For right panel, check the box if this value is already selected
                        if (side === 'right' && selectedFeaturesRight.includes(value)) {
                            input.checked = true;
                        }

                        const label = document.createElement('label');
                        label.htmlFor = `search-ui-feature-${side}-${index}`;
                        label.textContent = value;

                        input.addEventListener('change', function() {
                            if (side === 'left') {
                                // For left side (radio buttons) - clear previous and add the new selection
                                selectedFeaturesLeft = [this.value];
                            } else {
                                // For right side (checkboxes) - add/remove as before
                                if (this.checked) {
                                    selectedFeaturesRight.push(this.value);
                                } else {
                                    const idx = selectedFeaturesRight.indexOf(this.value);
                                    if (idx > -1) selectedFeaturesRight.splice(idx, 1);
                                }
                            }
                            updateSelectionSummary(side);
                            updateGlobalSubmitButton();
                        });

                        checkboxItem.appendChild(input);
                        checkboxItem.appendChild(label);
                        checkboxContainer.appendChild(checkboxItem);
                    });
                })
                .catch(error => {
                    console.error('Error:', error);
                    checkboxContainer.innerHTML = '<p>Error loading features. Please try again.</p>';
                });
            }
        });
    }

    function updateSelectionSummary(side) {
        const selectionSummary = document.getElementById(`search-ui-selection-summary-${side}`);
        let selectedFeatures = side === 'left' ? selectedFeaturesLeft : selectedFeaturesRight;
        if (selectionSummary) {
            // Clear any existing reset button and create a new container
            selectionSummary.innerHTML = '';
            
            // Create a div to hold the text and possibly the button
            const summaryDiv = document.createElement('div');
            summaryDiv.style.display = 'flex';
            summaryDiv.style.alignItems = 'center';
            
            // Create text span
            const textSpan = document.createElement('span');
            if (side === 'left') {
                // For left panel, show the selected parameter name
                textSpan.textContent = selectedFeatures.length ? `${selectedFeatures[0]} selected` : '';
            } else {
                // For right panel, show the count as before
                textSpan.textContent = selectedFeatures.length ? `Selected ${selectedFeatures.length} feature(s)` : '';
            }
            summaryDiv.appendChild(textSpan);
            
            // If right panel and there are selected features, add reset button
            if (side === 'right' && selectedFeatures.length > 0) {
                const resetButton = document.createElement('button');
                resetButton.type = 'button';
                resetButton.className = 'search-ui-reset-button';
                resetButton.textContent = 'Reset';
                resetButton.style.marginLeft = '10px';
                resetButton.style.padding = '2px 8px';
                resetButton.style.fontSize = '12px';
                resetButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    resetRightPanelSelections();
                });
                summaryDiv.appendChild(resetButton);
            }
            
            selectionSummary.appendChild(summaryDiv);
        }
    }
    
    function resetRightPanelSelections() {
        // Clear all right panel selections
        selectedFeaturesRight = [];
        
        // Uncheck all checkboxes in the right panel
        const checkboxContainer = document.getElementById('search-ui-checkbox-container-right');
        if (checkboxContainer) {
            const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // Update the selection summary
        updateSelectionSummary('right');
        updateGlobalSubmitButton();
    }

    function updateGlobalSubmitButton() {
        // Enable the global submit button if either form has at least one selected feature.
        const submitButton = document.getElementById('search-ui-submit-button');
        if (!submitButton) {
            console.error('Global submit button with id "search-ui-submit-button" not found.');
            return;
        }
        submitButton.disabled = !(selectedFeaturesLeft.length > 0 || selectedFeaturesRight.length > 0);
    }

    function submitAllSelections() {
        const keyDropdownLeft = document.getElementById('search-ui-key-dropdown-left');
        const keyDropdownRight = document.getElementById('search-ui-key-dropdown-right');
        const submitButton = document.getElementById('search-ui-submit-button');
        const resultDisplay = document.getElementById('search-ui-result-display');
        const submissionResult = document.getElementById('search-ui-submission-result');

        if (!submitButton) {
            console.error('Global submit button with id "search-ui-submit-button" not found.');
            return;
        }

        const formData = new FormData();
        
        // Simplified format: Just add the parameter from left panel
        if (selectedFeaturesLeft.length > 0) {
            formData.append('parameter', selectedFeaturesLeft[0]);
        } else {
            formData.append('parameter', '');
        }
        
        // Add features from right panel
        selectedFeaturesRight.forEach(feature => {
            formData.append('selected_features[]', feature);
        });

        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        fetch('/api/submit_features', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (resultDisplay) {
                resultDisplay.classList.remove('search-ui-hidden');
            }
            if (submissionResult) {
                submissionResult.textContent = JSON.stringify(data, null, 2);
            }
            updateVisualizations(data);
            submitButton.disabled = false;
            submitButton.textContent = 'Find Protocols';
        })
        .catch(error => {
            console.error('Error:', error);
            if (resultDisplay) {
                resultDisplay.classList.remove('search-ui-hidden');
            }
            if (submissionResult) {
                submissionResult.textContent = 'Error submitting selection. Please try again.';
            }
            submitButton.disabled = false;
            submitButton.textContent = 'Find Protocols';
        });
    }

    function updateVisualizations(data) {
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<p>Feature distribution for selected protocols</p>';
        }
        const umapContainer = document.getElementById('umap-container');
        if (umapContainer) {
            umapContainer.innerHTML = '<p>UMAP visualization for selected protocols</p>';
        }
        const umapContainer2 = document.getElementById('umap-container-2');
        if (umapContainer2) {
            umapContainer2.innerHTML = '<p>Alternative UMAP visualization for selected protocols</p>';
        }
        if (data && data.data) {
            populateSearchResults(data.data);
        }
    }

    function populateSearchResults(data) {
        const tableContainer = document.getElementById('table-search-container');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';
        
        // Use the new simplified format
        const parameter = data.parameter || 'None';
        const featureCount = data.selected_features ? data.selected_features.length : 0;
        
        let resultText = '';
        if (parameter !== 'None' && parameter !== '') {
            resultText += `Parameter: ${parameter}<br>`;
        }
        resultText += `Features: ${featureCount} selected`;
        
        tableContainer.innerHTML = `<p>${resultText}</p>`;
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Initialize both left and right forms.
        initializeForm('left');
        initializeForm('right');

        // Attach the global submit event for the single submission button.
        const submitButton = document.getElementById('search-ui-submit-button');
        if (submitButton) {
            submitButton.addEventListener('click', function(event) {
                event.preventDefault();
                submitAllSelections();
            });
        } else {
            console.error('Global submit button with id "search-ui-submit-button" not found on DOMContentLoaded.');
        }

        isInitialized = true;
    });
})();