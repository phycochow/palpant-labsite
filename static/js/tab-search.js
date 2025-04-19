window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

/**
 * tab-search.js - Enhanced version with:
 * - Left panel: Target Parameters from 0_TargetParameterFindings_12Apr25.csv
 * - Right panel: Original FeatureCategories from 0_FeatureCategories_01Mar25.csv
 * - Full-width filter form: Using new LabelCategories from 0_LabelCategories_17Apr25.csv
 */
(function() {
    let isInitialized = false;
    let selectedFeaturesLeft = [];
    let selectedFeaturesRight = [];
    let selectedFeaturesFilter = [];

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
            // Clear previous UI elements for this side
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
                let endpoint;
                if (side === 'left') {
                    endpoint = '/api/get_TargetParameters';  // Left panel: target parameters
                } else if (side === 'right') {
                    endpoint = '/api/get_ProtocolFeatures';  // Right panel: original protocol features
                }

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

    function initializeFilterForm() {
        const keyDropdown = document.getElementById('search-ui-key-dropdown-filter');
        const checkboxContainer = document.getElementById('search-ui-checkbox-container-filter');
        const selectionSummary = document.getElementById('search-ui-selection-summary-filter');
        const submitButton = document.getElementById('filter-submit-button');

        if (!keyDropdown || !checkboxContainer || !selectionSummary || !submitButton) {
            console.error('One or more elements not found for filter form.');
            return;
        }

        keyDropdown.addEventListener('change', function() {
            // Clear previous UI elements but keep selections
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');
            
            updateFilterSelectionSummary();
            updateFilterSubmitButton();

            const selectedKey = this.value;
            if (selectedKey) {
                checkboxContainer.classList.remove('search-ui-hidden');
                checkboxContainer.innerHTML = `<p id="search-ui-loading-message-filter">Loading features...</p>`;
                const formData = new FormData();
                formData.append('selected_key', selectedKey);

                fetch('/api/get_LabelCategories', {
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
                    
                    validValues.forEach((value, index) => {
                        const checkboxItem = document.createElement('div');
                        checkboxItem.className = 'search-ui-checkbox-item';

                        const input = document.createElement('input');
                        input.type = 'checkbox';
                        input.id = `search-ui-feature-filter-${index}`;
                        input.value = value;
                        input.name = 'filter_features';
                        
                        // Check the box if this value is already selected
                        if (selectedFeaturesFilter.includes(value)) {
                            input.checked = true;
                        }

                        const label = document.createElement('label');
                        label.htmlFor = `search-ui-feature-filter-${index}`;
                        label.textContent = value;

                        input.addEventListener('change', function() {
                            if (this.checked) {
                                selectedFeaturesFilter.push(this.value);
                            } else {
                                const idx = selectedFeaturesFilter.indexOf(this.value);
                                if (idx > -1) selectedFeaturesFilter.splice(idx, 1);
                            }
                            updateFilterSelectionSummary();
                            updateFilterSubmitButton();
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

        // Add event listener for filter form
        submitButton.addEventListener('click', function(e) {
            e.preventDefault();
            submitFilterSelection();
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
                resetButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    resetRightPanelSelections();
                });
                summaryDiv.appendChild(resetButton);
            }
            
            selectionSummary.appendChild(summaryDiv);
        }
    }
    
    function updateFilterSelectionSummary() {
        const selectionSummary = document.getElementById('search-ui-selection-summary-filter');
        if (!selectionSummary) return;
        
        // Clear any existing content
        selectionSummary.innerHTML = '';
        
        // Create a div to hold the text and possibly the button
        const summaryDiv = document.createElement('div');
        summaryDiv.style.display = 'flex';
        summaryDiv.style.alignItems = 'center';
        
        // Create text span for feature count
        const textSpan = document.createElement('span');
        textSpan.textContent = selectedFeaturesFilter.length ? `Selected ${selectedFeaturesFilter.length} feature(s)` : '';
        summaryDiv.appendChild(textSpan);
        
        // Add reset button if there are selected features
        if (selectedFeaturesFilter.length > 0) {
            const resetButton = document.createElement('button');
            resetButton.type = 'button';
            resetButton.className = 'search-ui-reset-button';
            resetButton.textContent = 'Reset';
            resetButton.addEventListener('click', function(e) {
                e.preventDefault();
                resetFilterSelections();
            });
            summaryDiv.appendChild(resetButton);
        }
        
        selectionSummary.appendChild(summaryDiv);
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
    
    function updateFilterSubmitButton() {
        const submitButton = document.getElementById('filter-submit-button');
        if (!submitButton) return;
        
        // Enable button only if there are selected features
        submitButton.disabled = selectedFeaturesFilter.length === 0;
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
    
    function resetFilterSelections() {
        // Clear all filter selections
        selectedFeaturesFilter = [];
        
        // Uncheck all checkboxes in the filter form
        const checkboxContainer = document.getElementById('search-ui-checkbox-container-filter');
        if (checkboxContainer) {
            const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // Update the selection summary and button
        updateFilterSelectionSummary();
        updateFilterSubmitButton();
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
    
    function submitFilterSelection() {
        const submitButton = document.getElementById('filter-submit-button');
        const resultDisplay = document.getElementById('filter-result-display');
        const submissionResult = document.getElementById('filter-submission-result');
        
        if (!submitButton) return;
        
        const formData = new FormData();
        
        // Add all selected filter features
        selectedFeaturesFilter.forEach(feature => {
            formData.append('filter_features[]', feature);
        });
        
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
        
        fetch('/api/filter_features', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Show results in the dedicated result display
            if (resultDisplay) {
                resultDisplay.classList.remove('search-ui-hidden');
            }
            if (submissionResult) {
                submissionResult.textContent = JSON.stringify(data, null, 2);
            }
            
            // Also log to console (but don't update row 4)
            showFilterResults(data);
            
            submitButton.disabled = false;
            submitButton.textContent = 'Filter Features';
        })
        .catch(error => {
            console.error('Error:', error);
            
            if (resultDisplay) {
                resultDisplay.classList.remove('search-ui-hidden');
            }
            if (submissionResult) {
                submissionResult.textContent = 'Error filtering features. Please try again.';
            }
            
            submitButton.disabled = false;
            submitButton.textContent = 'Filter Features';
        });
    }

    function updateVisualizations(data) {
        const chartContainer = document.getElementById('table-search-container-row1');
        if (chartContainer) {
            chartContainer.innerHTML = '<p>Feature distribution for selected protocols</p>';
        }
        const umapContainer = document.getElementById('table-search-container-row2');
        if (umapContainer) {
            umapContainer.innerHTML = '<p>UMAP visualization for selected protocols</p>';
        }
        const umapContainer2 = document.getElementById('table-search-container-row3');
        if (umapContainer2) {
            umapContainer2.innerHTML = '<p>Alternative UMAP visualization for selected protocols</p>';
        }
        
        // Removed any code that would modify row 4
    }
    
    function showFilterResults(data) {
        // Since we don't want to modify row 4 yet, we'll just log the data to console
        console.log('Filter results received:', data);
        
        // This will be implemented later when we're ready to update row 4
        // For now we'll just show the response in the console
        if (data && data.data) {
            console.log(`Received ${data.data.count} filtered features`);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (!isInitialized) {
            // Initialize both left and right forms
            initializeForm('left');
            initializeForm('right');
            
            // Initialize the filter form
            initializeFilterForm();

            // Attach the global submit event for the single submission button
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
        }
    });
})();