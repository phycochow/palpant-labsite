window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

/**
 * tab-search.js - Dual-Form Variable Search with Aggregated Submission and Error Handling
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
            // Clear previous selections and UI elements for this side.
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');
            if (side === 'left') {
                selectedFeaturesLeft = [];
            } else {
                selectedFeaturesRight = [];
            }
            updateSelectionSummary(side);
            updateGlobalSubmitButton();

            const selectedKey = this.value;
            if (selectedKey) {
                checkboxContainer.classList.remove('search-ui-hidden');
                checkboxContainer.innerHTML = `<p id="search-ui-loading-message-${side}">Loading features...</p>`;
                const formData = new FormData();
                formData.append('selected_key', selectedKey);

                fetch('/api/get_ProtocolFeatures', {
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

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `search-ui-feature-${side}-${index}`;
                        checkbox.value = value;
                        checkbox.name = 'selected_features';

                        const label = document.createElement('label');
                        label.htmlFor = `search-ui-feature-${side}-${index}`;
                        label.textContent = value;

                        checkbox.addEventListener('change', function() {
                            if (this.checked) {
                                if (side === 'left') {
                                    selectedFeaturesLeft.push(this.value);
                                } else {
                                    selectedFeaturesRight.push(this.value);
                                }
                            } else {
                                if (side === 'left') {
                                    const idx = selectedFeaturesLeft.indexOf(this.value);
                                    if (idx > -1) selectedFeaturesLeft.splice(idx, 1);
                                } else {
                                    const idx = selectedFeaturesRight.indexOf(this.value);
                                    if (idx > -1) selectedFeaturesRight.splice(idx, 1);
                                }
                            }
                            updateSelectionSummary(side);
                            updateGlobalSubmitButton();
                        });

                        checkboxItem.appendChild(checkbox);
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
            selectionSummary.textContent = selectedFeatures.length ? `Selected ${selectedFeatures.length} feature(s)` : '';
        }
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
        // Combine category selections from both forms into a JSON string.
        const combinedCategory = JSON.stringify({
            left: keyDropdownLeft ? keyDropdownLeft.value : "",
            right: keyDropdownRight ? keyDropdownRight.value : ""
        });
        formData.append('category', combinedCategory);

        // Merge the selected features from both forms.
        const combinedFeatures = selectedFeaturesLeft.concat(selectedFeaturesRight);
        combinedFeatures.forEach(feature => {
            formData.append('features[]', feature);
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
        const featureCount = data.selected_features ? data.selected_features.length : 0;
        tableContainer.innerHTML = `<p>Found protocols matching ${featureCount} selected feature(s) in category ${data.category}</p>`;
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

