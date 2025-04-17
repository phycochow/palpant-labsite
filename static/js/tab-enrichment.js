// tab-enrichment.js
window.CMPortal = window.CMPortal || {};
CMPortal.enrichment = {};

(function() {
  // Initialize variables
  let selectedParameter = [];
  let isInitialized = false;
  
  function initializeParameterForm() {
    const keyDropdown = document.getElementById('parameter-dropdown');
    const checkboxContainer = document.getElementById('parameter-container');
    const selectionSummary = document.getElementById('parameter-summary');
    const submitButton = document.getElementById('enrichment-submit-button');

    if (!keyDropdown || !checkboxContainer || !selectionSummary) {
      console.error('One or more required elements not found for parameter form');
      return;
    }

    keyDropdown.addEventListener('change', function() {
      // Clear previous selections and UI elements
      checkboxContainer.innerHTML = '';
      checkboxContainer.classList.add('enrichment-hidden');
      selectedParameter = [];
      updateSelectionSummary();
      updateSubmitButton();

      const selectedKey = this.value;
      if (selectedKey) {
        checkboxContainer.classList.remove('enrichment-hidden');
        checkboxContainer.innerHTML = `<p>Loading parameters...</p>`;
        const formData = new FormData();
        formData.append('selected_key', selectedKey);

        fetch('/api/get_TargetParameters', {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          checkboxContainer.innerHTML = '';
          const validValues = data.values.filter(value => value && value.trim() !== '');
          if (validValues.length === 0) {
            const noItems = document.createElement('p');
            noItems.textContent = 'No parameters available for this category.';
            checkboxContainer.appendChild(noItems);
            return;
          }
          
          // Create radio buttons for parameters (single selection)
          validValues.forEach((value, index) => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'enrichment-checkbox-item';

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `parameter-feature-${index}`;
            input.value = value;
            input.name = 'selected_feature_parameter'; // Use same name for all radio buttons

            const label = document.createElement('label');
            label.htmlFor = `parameter-feature-${index}`;
            label.textContent = value;

            input.addEventListener('change', function() {
              if (this.checked) {
                // For radio buttons - clear previous and add the new selection
                selectedParameter = [this.value];
              }
              updateSelectionSummary();
              updateSubmitButton();
            });

            checkboxItem.appendChild(input);
            checkboxItem.appendChild(label);
            checkboxContainer.appendChild(checkboxItem);
          });
        })
        .catch(error => {
          console.error('Error:', error);
          checkboxContainer.innerHTML = '<p>Error loading parameters. Please try again.</p>';
        });
      }
    });
    
    // Submit button functionality
    if (submitButton) {
      submitButton.addEventListener('click', function(e) {
        e.preventDefault();
        submitSelection();
      });
    }
  }

  function updateSelectionSummary() {
    const selectionSummary = document.getElementById('parameter-summary');
    if (!selectionSummary) return;
    
    // Clear existing content
    selectionSummary.innerHTML = '';
    
    // Create text showing the selected parameter
    const textSpan = document.createElement('span');
    textSpan.textContent = selectedParameter.length ? `${selectedParameter[0]} selected` : '';
    selectionSummary.appendChild(textSpan);
  }
  
  function updateSubmitButton() {
    const submitButton = document.getElementById('enrichment-submit-button');
    if (!submitButton) return;
    
    // Enable button only if a parameter is selected
    submitButton.disabled = selectedParameter.length === 0;
  }
  
  function submitSelection() {
    const submitButton = document.getElementById('enrichment-submit-button');
    if (!submitButton) return;
    
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    const formData = new FormData();
    if (selectedParameter.length > 0) {
      formData.append('parameter', selectedParameter[0]);
    } else {
      formData.append('parameter', '');
    }
    
    fetch('/api/submit_features', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      showResults(data);
      submitButton.disabled = false;
      submitButton.textContent = 'Find Protocols';
    })
    .catch(error => {
      console.error('Error:', error);
      submitButton.disabled = false;
      submitButton.textContent = 'Find Protocols';
    });
  }
  
  function showResults(data) {
    const tableContainer = document.getElementById('enrichment-table-container');
    if (!tableContainer) return;
    
    // Use the response data to populate the results
    if (data && data.data) {
      const parameter = data.data.parameter || 'None';
      
      let resultHTML = '<div class="enrichment-results">';
      resultHTML += `<h3>Enrichment Results for: ${parameter}</h3>`;
      resultHTML += '<table class="enrichment-table">';
      resultHTML += '<thead><tr><th>Enrichment ID</th><th>Description</th><th>Score</th></tr></thead>';
      resultHTML += '<tbody>';
      
      // Example rows - in real implementation, these would be populated from the API response
      resultHTML += '<tr><td>E001</td><td>Cell Viability</td><td>0.85</td></tr>';
      resultHTML += '<tr><td>E002</td><td>Calcium Handling</td><td>0.72</td></tr>';
      resultHTML += '<tr><td>E003</td><td>Sarcomere Organization</td><td>0.68</td></tr>';
      
      resultHTML += '</tbody></table>';
      resultHTML += '</div>';
      
      tableContainer.innerHTML = resultHTML;
    }
  }

  // Initialize when the document is ready
  document.addEventListener('DOMContentLoaded', function() {
    if (!isInitialized) {
      initializeParameterForm();
      isInitialized = true;
    }
  });
})();