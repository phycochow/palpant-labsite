window.CMPortal = window.CMPortal || {};
CMPortal.benchmark = {};

// Initialize variables at the top of your script
let selectedFeaturesLeft = [];

function initializeParameterForm(dropdownId, containerId, summaryId) {
  const keyDropdown = document.getElementById(dropdownId);
  const checkboxContainer = document.getElementById(containerId);
  const selectionSummary = document.getElementById(summaryId);

  if (!keyDropdown) {
    console.error(`Dropdown element not found: ${dropdownId}`);
    return;
  }
  if (!checkboxContainer) {
    console.error(`Checkbox container element not found: ${containerId}`);
    return;
  }
  if (!selectionSummary) {
    console.error(`Selection summary element not found: ${summaryId}`);
    return;
  }

  keyDropdown.addEventListener('change', function() {
    // Clear previous selections and UI elements
    checkboxContainer.innerHTML = '';
    checkboxContainer.classList.add('search-ui-hidden');
    selectedFeaturesLeft = [];
    updateSelectionSummary(selectionSummary);

    const selectedKey = this.value;
    if (selectedKey) {
      checkboxContainer.classList.remove('search-ui-hidden');
      checkboxContainer.innerHTML = `<p>Loading features...</p>`;
      const formData = new FormData();
      formData.append('selected_key', selectedKey);

      // API endpoint for target parameters
      const endpoint = '/api/get_TargetParameters';

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
        
        // Create radio buttons for parameters (single selection)
        validValues.forEach((value, index) => {
          const checkboxItem = document.createElement('div');
          checkboxItem.className = 'search-ui-checkbox-item';

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
              selectedFeaturesLeft = [this.value];
            }
            updateSelectionSummary(selectionSummary);
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

function updateSelectionSummary(summaryElement) {
  if (!summaryElement) return;
  
  // Clear existing content
  summaryElement.innerHTML = '';
  
  // Create a div to hold the text
  const summaryDiv = document.createElement('div');
  summaryDiv.style.display = 'flex';
  summaryDiv.style.alignItems = 'center';
  
  // Create text span showing the selected parameter
  const textSpan = document.createElement('span');
  textSpan.textContent = selectedFeaturesLeft.length ? `${selectedFeaturesLeft[0]} selected` : '';
  summaryDiv.appendChild(textSpan);
  
  summaryElement.appendChild(summaryDiv);
}

// Call this in your document ready function
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the parameter form
  initializeParameterForm(
    'parameter-dropdown',    // Dropdown ID
    'parameter-container',   // Container ID for radio buttons
    'parameter-summary'      // Summary ID
  );
});