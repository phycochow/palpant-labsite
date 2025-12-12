// tab-enrichment.js - Dual search mode enrichment browser with filtered option
(function() {
  'use strict';
  
  let isInitialized = false;
  let enrichmentTable = null;
  let currentMode = 'target';
  let allFeatures = [];

  // Mode switching
  function initializeModeSelector() {
    const options = document.querySelectorAll('.search-mode-option');
    
    options.forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      const mode = option.dataset.mode;
      
      option.addEventListener('click', () => {
        radio.checked = true;
        options.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        setMode(mode);
      });
      
      radio.addEventListener('change', () => {
        if (radio.checked) {
          options.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          setMode(mode);
        }
      });
    });
  }

  function setMode(mode) {
    currentMode = mode;
    const targetPanel = document.getElementById('target-panel');
    const featuresPanel = document.getElementById('features-panel');
    const modeInfo = document.getElementById('current-mode-info');
    const modeValue = modeInfo.querySelector('.current-mode-value');

    modeInfo.classList.remove('mode-target', 'mode-features');
    
    if (mode === 'target') {
      targetPanel.classList.remove('search-ui-hidden');
      featuresPanel.classList.add('search-ui-hidden');
      modeValue.textContent = 'Target Mode - Search by physiological endpoints and study applications';
      modeInfo.classList.add('mode-target');
    } else if (mode === 'features') {
      targetPanel.classList.add('search-ui-hidden');
      featuresPanel.classList.remove('search-ui-hidden');
      modeValue.textContent = 'Features Mode - Search by protocol features';
      modeInfo.classList.add('mode-features');
    }
    
    updateSubmitButtons();
  }

  // Load protocol features
  function loadProtocolFeatures() {
    fetch('/api/protocol_features')
      .then(res => res.json())
      .then(data => {
        allFeatures = data.features || [];
        renderFeatureCheckboxes(allFeatures);
      })
      .catch(err => {
        console.error('Error loading protocol features:', err);
        document.getElementById('feature-container').innerHTML = '<p class="text-danger">Error loading features.</p>';
      });
  }

  // Render feature checkboxes
  function renderFeatureCheckboxes(features) {
    const container = document.getElementById('feature-container');
    if (!container || features.length === 0) return;
    
    container.innerHTML = features.map(f => `
      <div class="search-ui-checkbox-item">
        <label for="feature-${f.replace(/\s+/g, '_')}">${f}</label>
        <input type="checkbox" class="feature-checkbox" id="feature-${f.replace(/\s+/g, '_')}" value="${f}">
      </div>
    `).join('');
    
    container.querySelectorAll('.feature-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        updateFeatureSummary();
        updateSubmitButtons();
      });
    });
  }

  // Feature search filter
  function initializeFeatureSearch() {
    const searchInput = document.getElementById('feature-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = allFeatures.filter(f => f.toLowerCase().includes(query));
      renderFeatureCheckboxes(filtered);
    });
  }

  // Parameter form
  function initializeParameterForm() {
    const dropdown = document.getElementById('parameter-dropdown');
    const container = document.getElementById('parameter-container');
    
    if (!dropdown || !container) return;
    
    dropdown.addEventListener('change', function() {
      const category = this.value;
      if (!category) {
        container.innerHTML = '<p>Please select a category first...</p>';
        container.classList.add('search-ui-hidden');
        return;
      }
      
      fetch(`/api/target_parameters?category=${encodeURIComponent(category)}`)
        .then(res => res.json())
        .then(data => {
          if (data.parameters && data.parameters.length > 0) {
            container.innerHTML = data.parameters.map(p => `
              <div class="search-ui-checkbox-item">
                <label for="param-${p.replace(/\s+/g, '_')}">${p}</label>
                <input type="checkbox" name="parameter" value="${p}" id="param-${p.replace(/\s+/g, '_')}">
              </div>
            `).join('');
            container.classList.remove('search-ui-hidden');
            
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
              cb.addEventListener('change', () => {
                updateParameterSummary();
                updateSubmitButtons();
              });
            });
          } else {
            container.innerHTML = '<p>No parameters found.</p>';
            container.classList.remove('search-ui-hidden');
          }
        })
        .catch(err => {
          console.error('Error loading parameters:', err);
          container.innerHTML = '<p class="text-danger">Error loading parameters.</p>';
        });
    });
  }

  // Update summaries
  function updateParameterSummary() {
    const summary = document.getElementById('parameter-summary');
    if (!summary) return;
    const count = document.querySelectorAll('#parameter-container input[type="checkbox"]:checked').length;
    summary.textContent = count > 0 ? `${count} parameter(s) selected` : '';
  }

  function updateFeatureSummary() {
    const summary = document.getElementById('feature-summary');
    if (!summary) return;
    const count = document.querySelectorAll('.feature-checkbox:checked').length;
    summary.textContent = count > 0 ? `${count} feature(s) selected` : '';
  }

  // Update submit buttons
  function updateSubmitButtons() {
    const btnRegular = document.getElementById('enrichment-submit-button');
    const btnFiltered = document.getElementById('enrichment-submit-filtered-button');
    if (!btnRegular || !btnFiltered) return;
    
    let hasSelection = false;

    if (currentMode === 'target') {
      hasSelection = document.querySelectorAll('#parameter-container input[type="checkbox"]:checked').length > 0;
      btnRegular.disabled = !hasSelection;
      btnFiltered.disabled = !hasSelection;  // Enable in target mode
    } else if (currentMode === 'features') {
      hasSelection = document.querySelectorAll('.feature-checkbox:checked').length > 0;
      btnRegular.disabled = !hasSelection;
      btnFiltered.disabled = true;  // Always disabled in features mode
    }
  }

  // Submit handlers
  function initializeSubmit() {
    const btnRegular = document.getElementById('enrichment-submit-button');
    const btnFiltered = document.getElementById('enrichment-submit-filtered-button');
    
    if (btnRegular) {
      btnRegular.addEventListener('click', function(e) {
        e.preventDefault();
        submitEnrichment(false);  // Regular search
      });
    }
    
    if (btnFiltered) {
      btnFiltered.addEventListener('click', function(e) {
        e.preventDefault();
        submitEnrichment(true);  // Filtered search
      });
    }
  }

  function submitEnrichment(useFilter) {
    let endpoint = useFilter ? '/api/enrichment_data_filtered' : '/api/enrichment_data';
    let url = endpoint + '?search_mode=' + currentMode;
    let count = 0;
    let type = '';

    if (currentMode === 'target') {
      const selected = Array.from(document.querySelectorAll('#parameter-container input[type="checkbox"]:checked')).map(cb => cb.value);
      selected.forEach(p => url += '&parameter[]=' + encodeURIComponent(p));
      count = selected.length;
      type = 'target parameter(s)';
    } else if (currentMode === 'features') {
      const selected = Array.from(document.querySelectorAll('.feature-checkbox:checked')).map(cb => cb.value);
      selected.forEach(f => url += '&protocol_features[]=' + encodeURIComponent(f));
      count = selected.length;
      type = 'protocol feature(s)';
    }

    loadEnrichmentTable(url, count, type, useFilter);
  }

  // Load enrichment table
  function loadEnrichmentTable(url, count, type, isFiltered) {
    const tableContainer = document.getElementById('enrichment-table-container');
    const tableEl = document.getElementById('enrichment-data-table');
    const resultDisplay = document.getElementById('enrichment-result-display');
    const submissionResult = document.getElementById('enrichment-submission-result');

    if (resultDisplay && submissionResult) {
      resultDisplay.classList.remove('enrichment-hidden');
      const filterMsg = isFiltered ? ' (filtered to protocol variables)' : '';
      submissionResult.textContent = `🔍 Fetching enrichment data for ${count} ${type}${filterMsg}...`;
    }

    if ($.fn.dataTable.isDataTable(tableEl)) {
      $(tableEl).DataTable().destroy();
      tableEl.innerHTML = '';
    }

    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);

        if (submissionResult) {
          const filterMsg = isFiltered ? ` (${json.filtered_count} protocol variables)` : '';
          submissionResult.textContent = `✅ Success! Found ${json.data.length} enriched protocol characteristics${filterMsg}.`;
        }

        tableContainer.classList.remove('enrichment-hidden');

        const columns = json.columns.map(col => ({
          data: col,
          title: col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          className: col.toLowerCase().includes('importance') ? 'dt-body-right' : ''
        }));

        enrichmentTable = $(tableEl).DataTable({
          data: json.data,
          columns,
          scrollX: true,
          scrollY: '50vh',
          scrollCollapse: true,
          pageLength: 10,
          lengthChange: false,
          autoWidth: true,
          responsive: true,
          destroy: true,
          dom: '<"row mb-3"<"col-sm-8"B><"col-sm-4"f>>rtip',
          buttons: [
            { extend: 'csv', className: 'btn btn-sm btn-secondary', text: 'Export CSV' },
            { extend: 'colvis', className: 'btn btn-sm btn-primary', text: 'Columns' }
          ],
          language: {
            search: "_INPUT_",
            searchPlaceholder: "Filter records..."
          },
          initComplete() {
            setTimeout(() => $(tableEl).DataTable().columns.adjust().draw(), 100);
          },
          drawCallback() {
            $(tableEl).DataTable().columns.adjust();
          }
        });
      })
      .catch(err => {
        console.error('Error loading enrichment data:', err);
        if (submissionResult) {
          submissionResult.textContent = `❌ Error: ${err.message}`;
        }
      });
  }

  // Tab activation
  $(document).on('tab-activated', function(event, tabId) {
    if (tabId === 'tab-enrichment' && enrichmentTable) {
      setTimeout(() => enrichmentTable.columns.adjust().draw(), 100);
    }
  });

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    if (!isInitialized) {
      initializeModeSelector();
      initializeParameterForm();
      loadProtocolFeatures();
      initializeFeatureSearch();
      initializeSubmit();
      isInitialized = true;
    }
  });
})();