// tab-enrichment.js - Dual search mode enrichment browser
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

    // Remove all mode classes
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
    
    updateSubmitButton();
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
    container.innerHTML = features.map((f, idx) => `
      <div class="search-ui-checkbox-item">
        <label for="feature-${idx}">${f}</label>
        <input type="checkbox" id="feature-${idx}" value="${f}" class="feature-checkbox">
      </div>
    `).join('');

    container.querySelectorAll('.feature-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        updateFeatureSummary();
        updateSubmitButton();
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

  // Update feature summary
  function updateFeatureSummary() {
    const summary = document.getElementById('feature-summary');
    if (!summary) return;
    const count = document.querySelectorAll('.feature-checkbox:checked').length;
    summary.textContent = count > 0 ? `${count} feature(s) selected` : '';
  }

  // Initialize target parameter form
  function initializeParameterForm() {
    const dropdown = document.getElementById('parameter-dropdown');
    const container = document.getElementById('parameter-container');
    if (!dropdown || !container) return;

    dropdown.addEventListener('change', function() {
      container.innerHTML = '';
      container.classList.add('search-ui-hidden');
      updateSelectionSummary();
      updateSubmitButton();

      const selectedKey = this.value;
      if (!selectedKey) return;

      container.classList.remove('search-ui-hidden');
      container.innerHTML = '<p>Loading parameters...</p>';

      const payload = new URLSearchParams();
      payload.append('selected_key', selectedKey);

      fetch('/api/get_TargetParameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: payload.toString()
      })
      .then(res => res.json())
      .then(data => {
        const vals = (data.values || []).filter(v => v && v.trim());
        if (!vals.length) {
          container.innerHTML = '<p>No parameters available.</p>';
          return;
        }

        container.innerHTML = vals.map((v, idx) => `
          <div class="search-ui-checkbox-item">
            <label for="param-${idx}">${v}</label>
            <input type="checkbox" id="param-${idx}" name="parameter" value="${v}">
          </div>
        `).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.addEventListener('change', () => {
            updateSelectionSummary();
            updateSubmitButton();
          });
        });
      })
      .catch(err => {
        console.error('Error loading parameters:', err);
        container.innerHTML = '<p class="text-danger">Error loading parameters.</p>';
      });
    });
  }

  // Update target parameter summary
  function updateSelectionSummary() {
    const summary = document.getElementById('parameter-summary');
    if (!summary) return;
    const count = document.querySelectorAll('#parameter-container input[type="checkbox"]:checked').length;
    summary.textContent = count > 0 ? `${count} parameter(s) selected` : '';
  }

  // Update submit button
  function updateSubmitButton() {
    const btn = document.getElementById('enrichment-submit-button');
    if (!btn) return;
    
    let hasSelection = false;

    if (currentMode === 'target') {
      hasSelection = document.querySelectorAll('#parameter-container input[type="checkbox"]:checked').length > 0;
    } else if (currentMode === 'features') {
      hasSelection = document.querySelectorAll('.feature-checkbox:checked').length > 0;
    }

    btn.disabled = !hasSelection;
  }

  // Submit handler
  function initializeSubmit() {
    const btn = document.getElementById('enrichment-submit-button');
    if (!btn) return;
    
    btn.addEventListener('click', function(e) {
      e.preventDefault();

      let url = '/api/enrichment_data?search_mode=' + currentMode;
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

      loadEnrichmentTable(url, count, type);
    });
  }

  // Load enrichment table
  function loadEnrichmentTable(url, count, type) {
    const tableContainer = document.getElementById('enrichment-table-container');
    const tableEl = document.getElementById('enrichment-data-table');
    const resultDisplay = document.getElementById('enrichment-result-display');
    const submissionResult = document.getElementById('enrichment-submission-result');

    if (resultDisplay && submissionResult) {
      resultDisplay.classList.remove('enrichment-hidden');
      submissionResult.textContent = `🔍 Fetching enrichment data for ${count} ${type}...`;
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
          submissionResult.textContent = `✅ Success! Found ${json.data.length} enriched protocol characteristics.`;
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