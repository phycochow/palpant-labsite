// tab-search.js
window.CMPortal = window.CMPortal || {};
CMPortal.search = {};

(function() {
    let isInitialized = false;
    const toggleStates = [false, false, false, false, false];
    let toggleButtons = [];
    let searchResultsTable = null;

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
                // Whenever left panel changes, also clear right selections
                resetRightPanelSelections();
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

                    // No need to pre-check, we'll read the actual DOM on submit

                    input.addEventListener('change', function() {
                        // Update summaries and button enables
                        updateSelectionSummary(side);
                        updateGlobalSubmitButton();
                        if (side === 'left') {
                            updateToggleButtons();
                        }
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

    function updateSelectionSummary(side) {
        const summaryEl = document.getElementById(`search-ui-selection-summary-${side}`);
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        if (side === 'left') {
            const checked = document.querySelector(
              '#search-ui-checkbox-container-left input[type="radio"]:checked'
            );
            const text = document.createElement('span');
            text.textContent = checked ? `${checked.value} selected` : '';
            container.appendChild(text);
        } else {
            const checkedBoxes = document.querySelectorAll(
              '#search-ui-checkbox-container-right input[type="checkbox"]:checked'
            );
            const count = checkedBoxes.length;
            const text = document.createElement('span');
            text.textContent = count ? `Selected ${count} feature(s)` : '';
            container.appendChild(text);

            if (count) {
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
        }

        summaryEl.appendChild(container);
    }

    function updateGlobalSubmitButton() {
        const btn = document.getElementById('search-ui-submit-button');
        if (!btn) return;

        const leftChecked   = !!document.querySelector(
          '#search-ui-checkbox-container-left input[type="radio"]:checked'
        );
        const rightChecked  = !!document.querySelector(
          '#search-ui-checkbox-container-right input[type="checkbox"]:checked'
        );

        btn.disabled = !(leftChecked || rightChecked);
    }

    function resetRightPanelSelections() {
        const container = document.getElementById('search-ui-checkbox-container-right');
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        updateSelectionSummary('right');
        updateGlobalSubmitButton();
    }

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
        const leftChecked = !!document.querySelector(
          '#search-ui-checkbox-container-left input[type="radio"]:checked'
        );
        toggleButtons.forEach(btn => btn.disabled = !leftChecked);
        if (!leftChecked) {
            toggleButtons.forEach((btn, idx) => {
                toggleStates[idx] = false;
                btn.classList.remove('active');
            });
        }
    }

    function initSearchResultsTable() {
        if (!document.getElementById('search-results-container')) {
            const well = document.querySelector('#tab-search .well:last-of-type');
            if (well) {
                well.innerHTML = '<h3>Search Results</h3><div id="search-results-container"></div>';
            }
        }
        const container = document.getElementById('search-results-container');
        if (container && !document.getElementById('search-results-table')) {
            container.innerHTML = '<table id="search-results-table" class="table table-striped table-bordered table-compact" style="width:100%"></table>';
        }
    }

    function displaySearchResults(results) {
        if (!results || !results.data || !results.columns) {
            console.error('Invalid search results data');
            return;
        }

        initSearchResultsTable();
        const tableEl = document.getElementById('search-results-table');
        if (!tableEl) return;

        if ($.fn.dataTable.isDataTable('#search-results-table')) {
            $('#search-results-table').DataTable().destroy();
        }

        const columns = results.columns.map(col => ({
            data: col,
            title: col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            className: 'dt-center',
            render: (data, type) => {
                if (data == null || (typeof data === 'number' && isNaN(data))) return '';
                if (type === 'display' && col.toLowerCase() === 'doi') {
                    let url = data.startsWith('http') ? data : 'https://doi.org/' + data.replace(/^doi:?\s*/i, '');
                    return `<a href="${url}" target="_blank">${data}</a>`;
                }
                return data;
            }
        }));

        const cleanData = results.data.map(row => {
            const out = {};
            for (let key in row) {
                let v = row[key];
                out[key] = (v == null || (typeof v === 'number' && isNaN(v))) ? '' : v;
            }
            return out;
        });

        try {
            $(tableEl).DataTable({
                data: cleanData,
                columns,
                scrollX: true,
                scrollY: '50vh',
                scrollCollapse: true,
                pageLength: 10,
                lengthChange: false,
                autoWidth: false,
                dom: '<"row mb-3"<"col-sm-8"B><"col-sm-4"f>>rtip',
                buttons: [
                    { extend: 'csv', className: 'btn btn-sm btn-secondary', text: 'Export CSV' },
                    { extend: 'colvis', className: 'btn btn-sm btn-primary', text: 'Columns' }
                ],
                language: {
                    search: "_INPUT_",
                    searchPlaceholder: "Filter records..."
                },
                ordering: false,
                initComplete() {
                    setTimeout(() => $(tableEl).DataTable().columns.adjust().draw(), 100);
                }
            });
            document.getElementById('search-results-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error('Error initializing DataTable:', error);
            document.getElementById('search-results-container').innerHTML = '<div class="alert alert-danger">Error displaying results. Please try again.</div>';
        }
    }

    function submitAllSelections() {
        const submitBtn = document.getElementById('search-ui-submit-button');
        const resultDisplay = document.getElementById('search-ui-result-display');
        const submissionResult = document.getElementById('search-ui-submission-result');
        if (!submitBtn) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing…';
        if (resultDisplay) resultDisplay.classList.add('search-ui-hidden');

        // Read current selections from the DOM
        const leftRadio = document.querySelector(
          '#search-ui-checkbox-container-left input[type="radio"]:checked'
        );
        const parameter = leftRadio ? leftRadio.value : '';

        const rightChecks = Array.from(
          document.querySelectorAll('#search-ui-checkbox-container-right input[type="checkbox"]:checked')
        );
        const features = rightChecks.map(cb => cb.value);

        const toggles = Array.from(toggleButtons).map(btn => btn.classList.contains('active'));

        const payload = new URLSearchParams();
        payload.append('parameter', parameter);
        features.forEach(f => payload.append('selected_features[]', f));
        toggles.forEach(state => payload.append('toggle_states[]', state));

        fetch('/api/submit_features', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
            body: payload.toString()
        })
        .then(res => {
            if (!res.ok) throw new Error(`Server response: ${res.status} ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Find Protocols';
            if (resultDisplay) resultDisplay.classList.remove('search-ui-hidden');

            submissionResult.textContent = JSON.stringify({
                status: data.status,
                data: data.data,
                toggle_states: toggles
            }, null, 2);

            if (data.status !== 'success') {
                submissionResult.textContent = `❌ Search failed: ${data.message || 'Server is busy. Please try again.'}`;
                return;
            }

            if (data.search_results?.data?.length > 0 && (parameter || features.length)) {
                submissionResult.textContent += `\n\n✅ Found ${data.search_results.data.length} matching protocols.`;
                displaySearchResults(data.search_results);
            } else {
                submissionResult.textContent = '❌ Search failed: Server is busy. Please reclick and try again to fetch the correct data.';
            }
        })
        .catch(err => {
            console.error('Error submitting selection:', err);
            if (resultDisplay) resultDisplay.classList.remove('search-ui-hidden');
            submissionResult.textContent = `❌ Network error: ${err.message}`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Find Protocols';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!isInitialized) {
            initializeForm('left');
            initializeForm('right');
            initToggleButtons();
            initSearchResultsTable();

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

    // Re-adjust DataTable when the tab becomes active
    $(document).on('tab-activated', (event, tabId) => {
        if (tabId === 'tab-search' && searchResultsTable) {
            setTimeout(() => {
                searchResultsTable.columns.adjust().draw();
            }, 100);
        }
    });
})();
