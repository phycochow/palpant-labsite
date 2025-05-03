// tab-search.js - Updated for side-by-side layout with mode selection
window.CMPortal = window.CMPortal || {};
CMPortal.search = {};

(function() {
    // Global variables
    let isInitialized = false;
    let selectedFeaturesRight = []; // Remember selections across right panel categories
    const toggleStates = [false, false, false, false, false];
    let toggleButtons = [];
    let searchResultsTable = null;
    let currentMode = null; // Will be 'normal', 'enrichment', or 'combined'

    // 1. Reset functions
    function resetRightPanelSelections() {
        selectedFeaturesRight = [];
        const container = document.getElementById('search-ui-checkbox-container-right');
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        updateSelectionSummary('right');
        updateGlobalSubmitButton();
    }
    
    function resetLeftPanelSelection() {
        // Uncheck all radio buttons in the left panel
        const container = document.getElementById('search-ui-checkbox-container-left');
        if (container) {
            container.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
        }
        
        // Update the toggle buttons (disabling them)
        updateToggleButtons();
        
        // Update summary
        updateSelectionSummary('left');
        
        // Update submit button state
        updateGlobalSubmitButton();
    }
    
    // 2. Update UI functions
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
    
    function updateGlobalSubmitButton() {
        const btn = document.getElementById('search-ui-submit-button');
        if (!btn) return;

        // Check if we have a mode selected
        if (!currentMode) {
            btn.disabled = true;
            return;
        }

        // Get selections
        const leftSelected = !!document.querySelector('#search-ui-checkbox-container-left input[type="radio"]:checked');
        const rightSelected = selectedFeaturesRight.length > 0;
        
        // Enable button based on mode requirements
        switch (currentMode) {
            case 'normal':
                // In normal mode, we need at least one feature selected
                btn.disabled = !rightSelected;
                break;
            case 'enrichment':
                // In enrichment mode, we need a target topic selected
                btn.disabled = !leftSelected;
                break;
            case 'combined':
                // In combined mode, we need both target and at least one feature
                btn.disabled = !(leftSelected && rightSelected);
                break;
            default:
                btn.disabled = true;
        }
    }
    
    function updateSelectionSummary(side) {
        const summaryEl = document.getElementById(`search-ui-selection-summary-${side}`);
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        if (side === 'left') {
            const checked = document.querySelector('#search-ui-checkbox-container-left input[type="radio"]:checked');
            const text = document.createElement('span');
            text.textContent = checked ? `${checked.value} selected` : '';
            container.appendChild(text);
            
            // Add reset button for left panel if there's a selection
            if (checked) {
                const resetBtn = document.createElement('button');
                resetBtn.type = 'button';
                resetBtn.className = 'search-ui-reset-button';
                resetBtn.textContent = 'Reset';
                resetBtn.addEventListener('click', e => {
                    e.preventDefault();
                    resetLeftPanelSelection();
                });
                container.appendChild(resetBtn);
            }
        } else {
            const count = selectedFeaturesRight.length;
            const text = document.createElement('span');
            text.textContent = count ? `Selected ${count} feature(s)` : '';
            container.appendChild(text);

            if (count) {
                const resetBtn = document.createElement('button');
                resetBtn.type = 'button';
                resetBtn.className = 'search-ui-reset-button';
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
    
    // 3. Mode selection functions
    function updatePanelRequirements() {
        const leftReq = document.getElementById('left-panel-requirement');
        const rightReq = document.getElementById('right-panel-requirement');
        
        // Reset classes
        leftReq.classList.remove('panel-required', 'panel-optional', 'panel-disabled');
        rightReq.classList.remove('panel-required', 'panel-optional', 'panel-disabled');
        
        // Update text and classes based on mode
        if (currentMode === 'normal') {
            leftReq.textContent = 'Not used in Normal mode';
            leftReq.classList.add('panel-disabled');
            
            rightReq.textContent = 'Required';
            rightReq.classList.add('panel-required');
        } 
        else if (currentMode === 'enrichment') {
            leftReq.textContent = 'Required';
            leftReq.classList.add('panel-required');
            
            rightReq.textContent = 'Not used in Enrichment mode';
            rightReq.classList.add('panel-disabled');
        }
        else if (currentMode === 'combined') {
            leftReq.textContent = 'Required';
            leftReq.classList.add('panel-required');
            
            rightReq.textContent = 'Required';
            rightReq.classList.add('panel-required');
        }
        else {
            leftReq.textContent = '';
            rightReq.textContent = '';
        }
    }
    
    function setSearchMode(mode) {
        currentMode = mode;
        
        // Update current mode display
        const modeInfoBox = document.getElementById('current-mode-info');
        const modeValueEl = modeInfoBox.querySelector('.current-mode-value');
        
        // Remove existing mode classes
        modeInfoBox.classList.remove('mode-normal', 'mode-enrichment', 'mode-combined');
        
        // Update mode text and add appropriate class
        if (mode === 'normal') {
            modeValueEl.textContent = 'Normal Mode - Find protocols with all selected features';
            modeInfoBox.classList.add('mode-normal');
        } else if (mode === 'enrichment') {
            modeValueEl.textContent = 'Enrichment Mode - Find protocols by target topic characteristics';
            modeInfoBox.classList.add('mode-enrichment');
        } else if (mode === 'combined') {
            modeValueEl.textContent = 'Combined Mode - Find protocols by topic and filter by features';
            modeInfoBox.classList.add('mode-combined');
        } else {
            modeValueEl.textContent = 'Please select a search mode';
        }
        
        // Update panel requirements text
        updatePanelRequirements();
        
        // Update panel and filter visibility based on mode
        const leftPanel = document.getElementById('search-ui-container-left');
        const rightPanel = document.getElementById('search-ui-container-right');
        const filtersContainer = document.getElementById('enrichment-filters-container');
        
        // Reset all containers
        leftPanel.classList.remove('disabled');
        rightPanel.classList.remove('disabled');
        filtersContainer.classList.remove('disabled');
        
        // Set appropriate disabled state
        if (mode === 'normal') {
            leftPanel.classList.add('disabled');
            filtersContainer.classList.add('disabled');
        } else if (mode === 'enrichment') {
            rightPanel.classList.add('disabled');
        }
        
        // Update submit button state
        updateGlobalSubmitButton();
    }
    
    function initModeSelection() {
        const modeOptions = document.querySelectorAll('.search-mode-option');
        
        modeOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            const mode = option.dataset.mode;
            
            // Add click handler to the whole option div
            option.addEventListener('click', () => {
                radio.checked = true;
                
                // Remove active class from all options
                modeOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to selected option
                option.classList.add('active');
                
                // Set the mode
                setSearchMode(mode);
            });
            
            // Also handle direct radio changes
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    // Remove active class from all options
                    modeOptions.forEach(opt => opt.classList.remove('active'));
                    
                    // Add active class to selected option
                    option.classList.add('active');
                    
                    // Set the mode
                    setSearchMode(mode);
                }
            });
        });
    }
    
    // 4. Initialization functions
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
    
    function initializeForm(side) {
        const keyDropdown = document.getElementById(`search-ui-key-dropdown-${side}`);
        const checkboxContainer = document.getElementById(`search-ui-checkbox-container-${side}`);

        if (!keyDropdown || !checkboxContainer) {
            console.error(`Missing elements for side '${side}'`);
            return;
        }

        keyDropdown.addEventListener('change', function () {
            checkboxContainer.innerHTML = '';
            checkboxContainer.classList.add('search-ui-hidden');

            if (side === 'left') {
                resetRightPanelSelections(); // Clear right on left change
                updateToggleButtons();
            }

            updateSelectionSummary(side);
            updateGlobalSubmitButton();

            const selectedKey = this.value;
            if (!selectedKey) return;

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
                    input.type = inputType;
                    input.id = `search-ui-feature-${side}-${idx}`;
                    input.value = value;
                    input.name = side === 'left' ? 'selected_feature_left' : 'selected_features';

                    if (side === 'right' && selectedFeaturesRight.includes(value)) {
                        input.checked = true;
                    }

                    input.addEventListener('change', function () {
                        if (side === 'right') {
                            if (this.checked) {
                                if (!selectedFeaturesRight.includes(value)) {
                                    selectedFeaturesRight.push(value);
                                }
                            } else {
                                selectedFeaturesRight = selectedFeaturesRight.filter(f => f !== value);
                            }
                        }

                        updateSelectionSummary(side);
                        updateGlobalSubmitButton();
                        if (side === 'left') updateToggleButtons();
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
    }
    
    // 5. Results and submission functions
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
      const submitBtn         = document.getElementById('search-ui-submit-button');
      const resultDisplay     = document.getElementById('search-ui-result-display');
      const submissionResult  = document.getElementById('search-ui-submission-result');
      if (!submitBtn || !submissionResult || !resultDisplay) return;

      // Step 1: Get selected parameter (left form)
      const leftRadio = document.querySelector('#search-ui-checkbox-container-left input[type="radio"]:checked');
      const parameter = leftRadio ? leftRadio.value : '';
      
      // Step 2: Get selected features (right form memory)
      const features = selectedFeaturesRight.slice(); // clone memory array
      
      // Validate mode-specific requirements
      if (currentMode === 'normal' && features.length === 0) {
        submissionResult.textContent = '⚠️ Normal Mode requires at least one feature to be selected.';
        resultDisplay.classList.remove('search-ui-hidden');
        return;
      }
      
      if (currentMode === 'enrichment' && !parameter) {
        submissionResult.textContent = '⚠️ Enrichment Mode requires a target topic to be selected.';
        resultDisplay.classList.remove('search-ui-hidden');
        return;
      }
      
      if (currentMode === 'combined' && (!parameter || features.length === 0)) {
        submissionResult.textContent = '⚠️ Combined Mode requires both a target topic and at least one feature.';
        resultDisplay.classList.remove('search-ui-hidden');
        return;
      }

      // Step 3: Get toggle states (only relevant in enrichment mode with left panel selection)
      const toggles = Array.from(toggleButtons).map(btn => btn.classList.contains('active'));

      // Step 4: Construct payload
      const payload = new URLSearchParams();
      payload.append('parameter', parameter);
      payload.append('mode', currentMode); // Add mode to payload
      features.forEach(f => payload.append('selected_features[]', f));
      toggles.forEach(state => payload.append('toggle_states[]', state));

      // Step 5: Submit
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing…';
      resultDisplay.classList.add('search-ui-hidden');

      fetch('/api/submit_features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: payload.toString()
      })
      .then(res => {
        if (!res.ok) throw new Error(`Server response: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Search Protocols';
        resultDisplay.classList.remove('search-ui-hidden');

        if (data.status !== 'success') {
          submissionResult.textContent = `❌ Search failed: ${data.message || 'Please try again.'}`;
          return;
        }

        if (data.search_results?.data?.length > 0) {
          // Show success message with mode and result count
          let modeText = '';
          switch (currentMode) {
            case 'normal':
              modeText = 'Normal Mode (selected features)';
              break;
            case 'enrichment':
              modeText = 'Enrichment Mode (target topic)';
              break;
            case 'combined':
              modeText = 'Combined Mode (topic + features)';
              break;
          }
          
          submissionResult.textContent = `✅ Success! Found ${data.search_results.data.length} matching protocols using ${modeText}.`;
          displaySearchResults(data.search_results);
        } else {
          submissionResult.textContent = '❌ Search failed: No results found. Please refine your selection and try again.';
        }
      })
      .catch(err => {
        console.error('Submission error:', err);
        resultDisplay.classList.remove('search-ui-hidden');
        submissionResult.textContent = `❌ Network error: ${err.message}`;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Search Protocols';
      });
    }

    // 6. Event handlers for initialization
    document.addEventListener('DOMContentLoaded', () => {
        if (!isInitialized) {
            // Initialize mode selection
            initModeSelection();
            
            // Initialize form controls
            initializeForm('left');
            initializeForm('right');
            initToggleButtons();
            initSearchResultsTable();

            // Initialize submit button
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

    $(document).on('tab-activated', (event, tabId) => {
        if (tabId === 'tab-search' && searchResultsTable) {
            setTimeout(() => {
                searchResultsTable.columns.adjust().draw();
            }, 100);
        }
    });
})();