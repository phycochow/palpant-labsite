// tab-search.js
window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

/**
 * tab-search.js - Enhanced version with URL‑encoded POSTs to handle special characters
 * - Left panel: Target Parameters
 * - Right panel: Protocol Features
 * - Full-width filter form: Label Categories
 * - Five toggle buttons that only become active once a left‐panel choice is made
 * - Submission result now includes toggle button states
 * - Global submit enabled if either left or right has a selection
 */
(function() {
    let isInitialized = false;
    let selectedFeaturesLeft = [];
    let selectedFeaturesRight = [];
    let selectedFeaturesFilter = [];
    const toggleStates = [false, false, false, false, false];
    let toggleButtons = [];

    function initializeForm(side) {
        const keyDropdown       = document.getElementById(`search-ui-key-dropdown-${side}`);
        const checkboxContainer = document.getElementById(`search-ui-checkbox-container-${side}`);

        if (!keyDropdown || !checkboxContainer) {
            console.error(`Missing elements for side '${side}'`);
            return;
        }

        keyDropdown.addEventListener('change', function() {
            // Reset UI
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');
            if (side === 'left') {
                selectedFeaturesLeft = [];
                updateToggleButtons();
            }
            updateSelectionSummary(side);
            updateGlobalSubmitButton();

            const selectedKey = this.value;
            if (!selectedKey) return;

            // Show loading
            checkboxContainer.classList.remove('search-ui-hidden');
            checkboxContainer.innerHTML = `<p id="search-ui-loading-message-${side}">Loading features...</p>`;

            const payload = new URLSearchParams();
            payload.append('selected_key', selectedKey);

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
                const inputType = side === 'left' ? 'radio' : 'checkbox';
                validValues.forEach((value, idx) => {
                    const item = document.createElement('div');
                    item.className = 'search-ui-checkbox-item';

                    const input = document.createElement('input');
                    input.type  = inputType;
                    input.id    = `search-ui-feature-${side}-${idx}`;
                    input.value = value;
                    input.name  = side === 'left' ? 'selected_feature_left' : 'selected_features';
                    if (side === 'right' && selectedFeaturesRight.includes(value)) {
                        input.checked = true;
                    }

                    input.addEventListener('change', function() {
                        if (side === 'left') {
                            selectedFeaturesLeft = [this.value];
                            updateToggleButtons();
                        } else {
                            if (this.checked) {
                                selectedFeaturesRight.push(value);
                            } else {
                                selectedFeaturesRight = selectedFeaturesRight.filter(f => f !== value);
                            }
                        }
                        updateSelectionSummary(side);
                        updateGlobalSubmitButton();
                    });

                    const label = document.createElement('label');
                    label.htmlFor   = input.id;
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
    }

    function initializeFilterForm() {
        const keyDropdown       = document.getElementById('search-ui-key-dropdown-filter');
        const checkboxContainer = document.getElementById('search-ui-checkbox-container-filter');
        const submitButton      = document.getElementById('filter-submit-button');

        if (!keyDropdown || !checkboxContainer || !submitButton) {
            console.error('Missing filter form elements');
            return;
        }

        keyDropdown.addEventListener('change', function() {
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');
            updateFilterSelectionSummary();
            updateFilterSubmitButton();

            const selectedKey = this.value;
            if (!selectedKey) return;

            checkboxContainer.classList.remove('search-ui-hidden');
            checkboxContainer.innerHTML = `<p id="search-ui-loading-message-filter">Loading features...</p>`;

            const payload = new URLSearchParams();
            payload.append('selected_key', selectedKey);

            fetch('/api/get_LabelCategories', {
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
                    input.type  = 'checkbox';
                    input.id    = `search-ui-feature-filter-${idx}`;
                    input.value = value;
                    input.name  = 'filter_features';
                    if (selectedFeaturesFilter.includes(value)) {
                        input.checked = true;
                    }

                    input.addEventListener('change', function() {
                        if (this.checked) selectedFeaturesFilter.push(value);
                        else selectedFeaturesFilter = selectedFeaturesFilter.filter(f => f !== value);
                        updateFilterSelectionSummary();
                        updateFilterSubmitButton();
                    });

                    const label = document.createElement('label');
                    label.htmlFor   = input.id;
                    label.textContent = value;

                    item.append(input, label);
                    checkboxContainer.appendChild(item);
                });
            })
            .catch(err => {
                console.error('Error loading filter features:', err);
                checkboxContainer.innerHTML = '<p>Error loading features. Please try again.</p>';
            });
        });

        submitButton.addEventListener('click', function(e) {
            e.preventDefault();
            submitFilterSelection();
        });
    }

    function updateSelectionSummary(side) {
        const summaryEl = document.getElementById(`search-ui-selection-summary-${side}`);
        const selected  = side === 'left' ? selectedFeaturesLeft : selectedFeaturesRight;
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        const text = document.createElement('span');
        text.textContent = side === 'left'
            ? (selected[0] ? `${selected[0]} selected` : '')
            : (selected.length ? `Selected ${selected.length} feature(s)` : '');
        container.appendChild(text);

        if (side === 'right' && selected.length) {
            const resetBtn = document.createElement('button');
            resetBtn.type        = 'button';
            resetBtn.className   = 'search-ui-reset-button';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', e => {
                e.preventDefault();
                resetRightPanelSelections();
            });
            container.appendChild(resetBtn);
        }

        summaryEl.appendChild(container);
    }

    function updateFilterSelectionSummary() {
        const summaryEl = document.getElementById('search-ui-selection-summary-filter');
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        const text = document.createElement('span');
        text.textContent = selectedFeaturesFilter.length
            ? `Selected ${selectedFeaturesFilter.length} feature(s)`
            : '';
        container.appendChild(text);

        if (selectedFeaturesFilter.length) {
            const resetBtn = document.createElement('button');
            resetBtn.type        = 'button';
            resetBtn.className   = 'search-ui-reset-button';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', e => {
                e.preventDefault();
                resetFilterSelections();
            });
            container.appendChild(resetBtn);
        }

        summaryEl.appendChild(container);
    }

    function updateGlobalSubmitButton() {
        const btn = document.getElementById('search-ui-submit-button');
        if (!btn) return;
        // enable if there's any left or any right selection
        btn.disabled = !(selectedFeaturesLeft.length > 0 || selectedFeaturesRight.length > 0);
    }

    function updateFilterSubmitButton() {
        const btn = document.getElementById('filter-submit-button');
        if (!btn) return;
        btn.disabled = selectedFeaturesFilter.length === 0;
    }

    function resetRightPanelSelections() {
        selectedFeaturesRight = [];
        const container = document.getElementById('search-ui-checkbox-container-right');
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        updateSelectionSummary('right');
        updateGlobalSubmitButton();
    }

    function resetFilterSelections() {
        selectedFeaturesFilter = [];
        const container = document.getElementById('search-ui-checkbox-container-filter');
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        updateFilterSelectionSummary();
        updateFilterSubmitButton();
    }

    // --- toggle buttons setup ---
    function initToggleButtons() {
        toggleButtons = Array.from(document.querySelectorAll('.toggle-button'));
        toggleButtons.forEach((btn, idx) => {
            btn.disabled = true;
            btn.classList.remove('active');
            btn.addEventListener('click', e => {
                e.preventDefault();
                if (!btn.disabled) {
                    toggleStates[idx] = !toggleStates[idx];
                    btn.classList.toggle('active', toggleStates[idx]);
                }
            });
        });
    }

    function updateToggleButtons() {
        const enable = selectedFeaturesLeft.length > 0;
        toggleButtons.forEach(btn => btn.disabled = !enable);
        if (!enable) {
            toggleButtons.forEach((btn, idx) => {
                toggleStates[idx] = false;
                btn.classList.remove('active');
            });
        }
    }
    // --- end toggle setup ---

    function submitAllSelections() {
        const submitButton     = document.getElementById('search-ui-submit-button');
        const resultDisplay    = document.getElementById('search-ui-result-display');
        const submissionResult = document.getElementById('search-ui-submission-result');
        if (!submitButton) return;

        const payload = new URLSearchParams();
        payload.append('parameter', selectedFeaturesLeft[0] || '');
        selectedFeaturesRight.forEach(f => payload.append('selected_features[]', f));
        toggleStates.forEach(state => payload.append('toggle_states[]', state));

        submitButton.disabled = true;
        submitButton.textContent = 'Processing…';
        resultDisplay.classList.add('search-ui-hidden');

        fetch('/api/submit_features', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
            body: payload.toString()
        })
        .then(res => res.json())
        .then(data => {
            const noParam    = !data.data.parameter;
            const noFeatures = !data.data.selected_features ||
                               data.data.selected_features.length === 0;
            if (data.status === 'success' && noParam && noFeatures) {
                data.status = 'failed';
            }

            resultDisplay.classList.remove('search-ui-hidden');
            if (data.status !== 'success') {
                submissionResult.textContent = '❌ Search failed: Server is busy. Please try again.';
            } else {
                const displayObj = {
                    status: data.status,
                    data: data.data,
                    toggle_states: toggleStates
                };
                submissionResult.textContent = JSON.stringify(displayObj, null, 2);
                updateVisualizations(data);
            }

            submitButton.disabled = false;
            submitButton.textContent = 'Find Protocols';
        })
        .catch(err => {
            console.error('Error submitting selection:', err);
            resultDisplay.classList.remove('search-ui-hidden');
            submissionResult.textContent = `❌ Network error: ${err.message}`;
            submitButton.disabled = false;
            submitButton.textContent = 'Find Protocols';
        });
    }

    function submitFilterSelection() {
        const submitButton     = document.getElementById('filter-submit-button');
        const resultDisplay    = document.getElementById('filter-result-display');
        const submissionResult = document.getElementById('filter-submission-result');
        if (!submitButton) return;

        const payload = new URLSearchParams();
        selectedFeaturesFilter.forEach(f => payload.append('filter_features[]', f));

        submitButton.disabled = true;
        submitButton.textContent = 'Processing…';

        fetch('/api/filter_features', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
            body: payload.toString()
        })
        .then(res => res.json())
        .then(data => {
            submissionResult.textContent = JSON.stringify(data, null, 2);
            resultDisplay.classList.remove('search-ui-hidden');
            submitButton.disabled = false;
            submitButton.textContent = 'Filter Features';
        })
        .catch(err => {
            console.error('Error filtering features:', err);
            submissionResult.textContent = `Error: ${err.message}`;
            resultDisplay.classList.remove('search-ui-hidden');
            submitButton.disabled = false;
            submitButton.textContent = 'Filter Features';
        });
    }

    function updateVisualizations(data) {
        const c1 = document.getElementById('table-search-container-row1');
        if (c1) c1.innerHTML = '<p>Feature distribution for selected protocols</p>';
        const c2 = document.getElementById('table-search-container-row2');
        if (c2) c2.innerHTML = '<p>UMAP visualization for selected protocols</p>';
        const c3 = document.getElementById('table-search-container-row3');
        if (c3) c3.innerHTML = '<p>Alternative UMAP visualization for selected protocols</p>';
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!isInitialized) {
            initializeForm('left');
            initializeForm('right');
            initializeFilterForm();
            initToggleButtons();
            const submitBtn = document.getElementById('search-ui-submit-button');
            if (submitBtn) {
                submitBtn.addEventListener('click', e => {
                    e.preventDefault();
                    submitAllSelections();
                });
            }
            isInitialized = true;
        }
    });
})();
