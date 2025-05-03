// tab-enrichment.js
window.CMPortal = window.CMPortal || {};
CMPortal.enrichment = {};

(function() {
  let isInitialized = false;
  let enrichmentTable = null;

  function initializeParameterForm() {
    const keyDropdown       = document.getElementById('parameter-dropdown');
    const checkboxContainer = document.getElementById('parameter-container');
    const selectionSummary  = document.getElementById('parameter-summary');
    const submitButton      = document.getElementById('enrichment-submit-button');

    if (!keyDropdown || !checkboxContainer || !selectionSummary || !submitButton) {
      console.error('Required elements not found for enrichment form');
      return;
    }

    keyDropdown.addEventListener('change', function() {
      checkboxContainer.innerHTML = '';
      checkboxContainer.classList.add('enrichment-hidden');
      updateSelectionSummary();
      updateSubmitButton();

      const selectedKey = this.value;
      if (!selectedKey) return;

      checkboxContainer.classList.remove('enrichment-hidden');
      checkboxContainer.innerHTML = `<p>Loading parameters…</p>`;

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

    submitButton.addEventListener('click', function(e) {
      e.preventDefault();
      submitSelection();
    });
  }

  function getSelectedParameterFromDOM() {
    const radio = document.querySelector('#parameter-container input[type="radio"]:checked');
    return radio ? radio.value : '';
  }

  function updateSelectionSummary() {
    const summary = document.getElementById('parameter-summary');
    if (!summary) return;

    summary.innerHTML = '';
    const selectedValue = getSelectedParameterFromDOM();
    const span = document.createElement('span');
    span.textContent = selectedValue ? `${selectedValue} selected` : '';
    summary.appendChild(span);
  }

  function updateSubmitButton() {
    const btn = document.getElementById('enrichment-submit-button');
    if (!btn) return;

    const hasSelection = !!getSelectedParameterFromDOM();
    btn.disabled = !hasSelection;
  }

  function submitSelection() {
    const submitButton     = document.getElementById('enrichment-submit-button');
    const resultDisplay    = document.getElementById('enrichment-result-display');
    const submissionResult = document.getElementById('enrichment-submission-result');

    if (!submitButton || !submissionResult || !resultDisplay) return;

    const selectedValue = getSelectedParameterFromDOM();

    const payload = new URLSearchParams();
    payload.append('parameter', selectedValue);

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
      resultDisplay.classList.remove('enrichment-hidden');

      if (data.status !== 'success' || !data.data?.parameter) {
        submissionResult.textContent = `❌ Search failed: ${data.message} Server is busy. Please reclick and try again to fetch the correct data.`;
      } else {
        submissionResult.textContent = '✅ Search success: 1 parameter submitted. Dataset is fetched correctly.';
        loadEnrichmentTable(selectedValue);
      }

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

    try {
      if ($.fn.dataTable.isDataTable(tableEl)) {
        $(tableEl).DataTable().destroy();
        tableEl.innerHTML = '';
      }
    } catch (e) {
      console.warn('Error while checking/destroying existing table:', e);
    }

    fetch(`/api/enrichment_data?parameter=${encodeURIComponent(label)}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);

        tableContainer.classList.remove('enrichment-hidden');

        const columns = json.columns.map(col => ({
          data: col,
          title: col.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()),
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
            searchPlaceholder: "Filter..."
          },
          initComplete() {
            setTimeout(() => {
              $(tableEl).DataTable().columns.adjust().draw();
            }, 100);
          },
          drawCallback() {
            $(tableEl).DataTable().columns.adjust();
          }
        });
      })
      .catch(err => {
        console.error('Error loading enrichment data:', err);
        submissionResult.textContent = `❌ Error loading dataset: ${err.message}`;
      });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!isInitialized) {
      initializeParameterForm();
      isInitialized = true;
    }
  });
})();
