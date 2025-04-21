// tab-enrichment.js
window.CMPortal = window.CMPortal || {};
CMPortal.enrichment = {};

(function() {
  let selectedParameter = [];
  let isInitialized = false;
  let enrichmentTable = null;

  function initializeParameterForm() {
    const keyDropdown       = document.getElementById('parameter-dropdown');
    const checkboxContainer = document.getElementById('parameter-container');
    const selectionSummary  = document.getElementById('parameter-summary');
    const submitButton      = document.getElementById('enrichment-submit-button');

    if (!keyDropdown || !checkboxContainer || !selectionSummary) {
      console.error('Required elements not found for enrichment form');
      return;
    }

    keyDropdown.addEventListener('change', function() {
      // reset UI
      checkboxContainer.innerHTML = '';
      checkboxContainer.classList.add('enrichment-hidden');
      selectedParameter = [];
      updateSelectionSummary();
      updateSubmitButton();

      const selectedKey = this.value;
      if (!selectedKey) return;

      // show loading
      checkboxContainer.classList.remove('enrichment-hidden');
      checkboxContainer.innerHTML = `<p>Loading parameters…</p>`;

      // build URL‑encoded payload
      const payload = new URLSearchParams();
      payload.append('selected_key', selectedKey);

      fetch('/api/get_TargetParameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: payload.toString()
      })
      .then(res => res.json())
      .then(data => {
        checkboxContainer.innerHTML = '';
        const vals = (data.values || []).filter(v => v && v.trim());
        if (!vals.length) {
          checkboxContainer.textContent = 'No parameters available for this category.';
          return;
        }
        vals.forEach((value, idx) => {
          const item = document.createElement('div');
          item.className = 'enrichment-checkbox-item';

          const input = document.createElement('input');
          input.type  = 'radio';
          input.id    = `parameter-feature-${idx}`;
          input.name  = 'selected_feature_parameter';
          input.value = value;

          input.addEventListener('change', () => {
            selectedParameter = [value];
            updateSelectionSummary();
            updateSubmitButton();
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

    if (submitButton) {
      submitButton.addEventListener('click', function(e) {
        e.preventDefault();
        submitSelection();
      });
    }
  }

  function updateSelectionSummary() {
    const summary = document.getElementById('parameter-summary');
    if (!summary) return;
    summary.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = selectedParameter[0]
      ? `${selectedParameter[0]} selected`
      : '';
    summary.appendChild(span);
  }

  function updateSubmitButton() {
    const btn = document.getElementById('enrichment-submit-button');
    if (!btn) return;
    btn.disabled = selectedParameter.length === 0;
  }

  function submitSelection() {
    const submitButton     = document.getElementById('enrichment-submit-button');
    const resultDisplay    = document.getElementById('enrichment-result-display');
    const submissionResult = document.getElementById('enrichment-submission-result');
    if (!submitButton || !submissionResult || !resultDisplay) return;

    // build URL-encoded payload
    const payload = new URLSearchParams();
    payload.append('parameter', selectedParameter[0] || '');

    // UI state
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    resultDisplay.classList.add('enrichment-hidden');

    fetch('/api/submit_features', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: payload.toString()
    })
    .then(res => res.json())
    .then(data => {
      // treat an empty-success as failure
      if (data.status === 'success' && !data.data.parameter) {
        data.status = 'failed';
      }

      resultDisplay.classList.remove('enrichment-hidden');

      if (data.status !== 'success') {
        submissionResult.textContent = '❌ Search failed: Server is busy. Please reclick and try again to fetch the correct data.';
      } else {
        submissionResult.textContent = '✅ Search success: 1 parameter submitted. Dataset is fetched correctly..';
        // **NEW**: load and render the enrichment table
        loadEnrichmentTable(selectedParameter[0]);
      }

      // restore button
      submitButton.disabled = false;
      submitButton.textContent = 'Find Protocols';
    })
    .catch(error => {
      console.error('Error submitting enrichment:', error);
      resultDisplay.classList.remove('enrichment-hidden');
      submissionResult.textContent = `❌ Network error: ${error.message}`;
      submitButton.disabled = false;
      submitButton.textContent = 'Find Protocols';
    });
  }

  function loadEnrichmentTable(label) {
    const tableContainer = document.getElementById('enrichment-table-container');
    const tableEl = document.getElementById('enrichment-data-table');
    const submissionResult = document.getElementById('enrichment-submission-result');
    
    if (!tableContainer || !tableEl) {
      console.error('Table container or element not found');
      return;
    }

    // First, properly check if DataTable already exists and destroy it
    try {
      // Use DataTables API to check if table is already initialized
      const existingTable = $.fn.dataTable.isDataTable(tableEl);
      if (existingTable) {
        // Get the DataTable instance and destroy it properly
        $(tableEl).DataTable().destroy();
        // Clear the HTML after destroying
        tableEl.innerHTML = '';
      }
    } catch (e) {
      console.warn('Error while checking/destroying existing table:', e);
    }

    fetch(`/api/enrichment_data?parameter=${encodeURIComponent(label)}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          throw new Error(json.error);
        }

        // Make sure container is visible before initializing DataTable
        tableContainer.classList.remove('enrichment-hidden');

        // build columns array for DataTables
        const columns = json.columns.map(col => ({
          data: col,
          title: col.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()),
        }));

        // initialize DataTable with improved configuration
        enrichmentTable = $(tableEl).DataTable({
          data: json.data,
          columns: columns,
          scrollX: true,
          scrollY: '50vh',
          scrollCollapse: true,
          pageLength: 10,
          lengthChange: false,
          autoWidth: true, // Let DataTables calculate the width initially
          responsive: true, // Add responsive behavior
          destroy: true, // Allow table to be destroyed and recreated
          dom: '<"row mb-3"<"col-sm-8"B><"col-sm-4"f>>rtip',
          buttons: [
            { extend: 'csv', className: 'btn btn-sm btn-secondary', text: 'Export CSV' },
            { extend: 'colvis', className: 'btn btn-sm btn-primary', text: 'Columns' }
          ],
          language: {
            search: "_INPUT_",
            searchPlaceholder: "Filter..."
          },
          // Add these callbacks to handle column sizing
          initComplete: function() {
            // Adjust column widths after table is fully initialized
            setTimeout(() => {
              $(tableEl).DataTable().columns.adjust().draw();
            }, 100);
          },
          drawCallback: function() {
            // Re-adjust when pages change
            $(tableEl).DataTable().columns.adjust();
          }
        });
      })
      .catch(err => {
        console.error('Error loading enrichment data:', err);
        submissionResult.textContent = `❌ Error loading dataset: ${err.message}`;
      });
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!isInitialized) {
      initializeParameterForm();
      isInitialized = true;
    }
  });
})();
