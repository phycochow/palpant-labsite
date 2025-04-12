/**
 * DataTable viewer functionality for CMPortal
 */

// Extend CMPortal namespace
CMPortal = CMPortal || {};
CMPortal.viewer = {};

// Flag to track initialization
CMPortal.viewer.initialized = false;

// Variable to store the category row
CMPortal.viewer.categoryRow = null;

// Initialize the data viewer
CMPortal.viewer.init = function() {
    if (CMPortal.viewer.initialized) return;
    
    // Load data from API
    $.ajax({
        url: '/api/viewer',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if (response.data && response.data.length > 0) {
                // Extract the category row (first row)
                CMPortal.viewer.categoryRow = response.data[0];
                
                // Create data without the category row
                const dataWithoutCategory = [...response.data];
                dataWithoutCategory.splice(0, 1);
                
                CMPortal.viewer.initializeTable(dataWithoutCategory, response.columns);
                $('#loading-indicator').addClass('d-none');
                $('#table-container').removeClass('d-none');
            } else {
                CMPortal.viewer.showError('No data available');
            }
        },
        error: function(xhr, status, error) {
            CMPortal.viewer.showError('Error loading data: ' + error);
        }
    });
    
    CMPortal.viewer.initialized = true;
};

// Initialize the DataTable
CMPortal.viewer.initializeTable = function(data, columnNames) {
    // Group columns by category with a defined order
    const columnsByCategory = {};
    
    // Define the preferred order of categories
    const categoryOrder = [
        'Study Characteristic',
        'Protocol Variable', 
        'Cell Profile', 
        'Analysis Method', 
        'Measured Endpoint', 
    ];
    
    // Initialize each category in the defined order
    categoryOrder.forEach(category => {
        columnsByCategory[category] = [];
    });
    
    // Now assign columns to the appropriate category
    columnNames.forEach(key => {
        const category = CMPortal.viewer.categoryRow[key] || 'Other';
        
        let columnWidth = '10%';
        let className = 'dt-head-center';
        
        if (key.toLowerCase().includes('reference') || key.toLowerCase().includes('title')) {
            columnWidth = '15%';
            className += ' dt-body-left';
        } else if (key.toLowerCase().includes('doi') || key.toLowerCase().includes('url')) {
            columnWidth = '12%';
            className += ' dt-body-left';
        } else if (key.toLowerCase().includes('year') || key.toLowerCase().includes('number')) {
            columnWidth = '7%';
            className += ' dt-body-center';
        } else if (key.toLowerCase().includes('sex') || key.toLowerCase().includes('line')) {
            columnWidth = '7%';
            className += ' dt-body-center';
        }
        
        // Check if the category exists in our predefined order
        if (columnsByCategory[category]) {
            columnsByCategory[category].push({
                data: key,
                title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                width: columnWidth,
                className: className,
                render: (function() {
                    if (key.toLowerCase().includes('doi')) {
                        return function(data, type, row) {
                            if (type === 'display' && data && data !== 'NaN' && data.trim() !== '') {
                                let url = data;
                                if (!url.startsWith('http')) {
                                    url = 'https://doi.org/' + data.replace(/^doi:?\s*/i, '');
                                }
                                return '<a href="' + url + '" target="_blank">' + data + '</a>';
                            }
                            return data;
                        };
                    } else if (key.toLowerCase().includes('url')) {
                        return function(data, type, row) {
                            if (type === 'display' && data && data !== 'NaN' && data.trim() !== '') {
                                return '<a href="' + data + '" target="_blank">' + data + '</a>';
                            }
                            return data;
                        };
                    }
                    return null;
                })()
            });
        } else {
            // If we find a category that's not in our predefined list, add it to "Other"
            columnsByCategory['Other'] = columnsByCategory['Other'] || [];
            columnsByCategory['Other'].push({
                data: key,
                title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                width: columnWidth,
                className: className,
                render: (function() {
                    if (key.toLowerCase().includes('doi')) {
                        return function(data, type, row) {
                            if (type === 'display' && data && data !== 'NaN' && data.trim() !== '') {
                                let url = data;
                                if (!url.startsWith('http')) {
                                    url = 'https://doi.org/' + data.replace(/^doi:?\s*/i, '');
                                }
                                return '<a href="' + url + '" target="_blank">' + data + '</a>';
                            }
                            return data;
                        };
                    } else if (key.toLowerCase().includes('url')) {
                        return function(data, type, row) {
                            if (type === 'display' && data && data !== 'NaN' && data.trim() !== '') {
                                return '<a href="' + data + '" target="_blank">' + data + '</a>';
                            }
                            return data;
                        };
                    }
                    return null;
                })()
            });
        }
    });
    
    // Prepare DataTable buttons array
    const buttons = [
        {
            extend: 'csv',
            className: 'btn btn-sm btn-secondary mr-2',
            text: 'Install'
        }
    ];
    
    // Flatten the grouped columns back to a single array for DataTables
    const flattenedColumns = [];
    // Track the mapping between original column names and their indices in the flattened array
    const columnToFlattenedIndex = {};
    
    // Flatten columns and track indices in the predefined category order
    categoryOrder.forEach(category => {
        if (columnsByCategory[category]) {
            columnsByCategory[category].forEach(column => {
                // Store the mapping of original column name to its index in the flattened array
                columnToFlattenedIndex[column.data] = flattenedColumns.length;
                flattenedColumns.push(column);
            });
        }
    });
    
    // Now add a button for each category using the correct flattened indices
    categoryOrder.forEach(category => {
        if (category !== 'Other' && columnsByCategory[category] && columnsByCategory[category].length > 0) {
            buttons.push({
                extend: 'colvis',
                className: `btn btn-sm btn-primary category-toggle-${category.toLowerCase().replace(/\s+/g, '-')} mr-2`,
                text: `${category}`,
                columns: columnsByCategory[category].map(col => {
                    // Use the tracked flattened index instead of the original index
                    return columnToFlattenedIndex[col.data];
                })
            });
        }
    });
    
    // Initialize DataTable with the flattened columns
    const table = $('#data-table').DataTable({
        data: data,
        columns: flattenedColumns,
        scrollX: true,
        scrollY: '60vh',
        scrollCollapse: true,
        pageLength: 10,
        lengthChange: false,
        autoWidth: false,
        dom: '<"row mb-3"<"col-sm-8"B><"col-sm-4"f>>rtip',
        buttons: buttons,
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Filter records..."
        },
        initComplete: function() {
            CMPortal.viewer.customizeColumnVisibilityDropdowns();
            setTimeout(function() {
                table.on('draw', function() {
                    $('.category-row').remove();
                    CMPortal.viewer.addCategoryRow(table, CMPortal.viewer.categoryRow, columnNames, columnToFlattenedIndex);
                    CMPortal.viewer.synchronizeColumnWidths();
                });
                
                table.on('column-visibility.dt', function(e, settings, column, state) {
                    $('.category-row').remove();
                    CMPortal.viewer.addCategoryRow(table, CMPortal.viewer.categoryRow, columnNames, columnToFlattenedIndex);
                    CMPortal.viewer.synchronizeColumnWidths();
                });
                
                table.order([0, 'asc']).draw();
                $(window).trigger('resize');
                CMPortal.viewer.setupCategoryToggleButtons();
            }, 100);
        }
    });
    
    return table;
};

// Update the addCategoryRow function to use the correct indices
CMPortal.viewer.addCategoryRow = function(table, categoryRow, columnNames, columnToFlattenedIndex) {
    if (!categoryRow) return;
    
    const categoryRowHtml = $('<tr class="category-row"></tr>');
    const visibleColumns = table.columns().visible().toArray();
    
    // For each column in the flattened order
    Object.keys(columnToFlattenedIndex).forEach(function(columnKey) {
        const flattenedIndex = columnToFlattenedIndex[columnKey];
        const categoryValue = categoryRow[columnKey] || '';
        const cell = $('<td></td>').text(categoryValue);
        
        if (categoryValue === 'Protocol Variable') {
            cell.addClass('category-variable');
        } else if (categoryValue === 'Analysis Method') {
            cell.addClass('category-analysis');
        } else if (categoryValue === 'Cell Profile') {
            cell.addClass('category-cell');
        } else if (categoryValue === 'Study Characteristic') {
            cell.addClass('category-study');
        } else if (categoryValue === 'Measured Endpoint') {
            cell.addClass('category-endpoint');
        }
        
        if (!visibleColumns[flattenedIndex]) {
            cell.css('display', 'none');
        }
        
        categoryRowHtml.append(cell);
    });
    
    $('#data-table tbody').prepend(categoryRowHtml);
};

CMPortal.viewer.synchronizeColumnWidths = function() {
    // Synchronize header and body column widths based on the maximum of each
    const headerCells = $('#data-table_wrapper .dataTables_scrollHead thead th');
    const bodyRows = $('#data-table_wrapper .dataTables_scrollBody tbody tr');
    
    headerCells.each(function(index) {
        let maxWidth = $(this).outerWidth();
        bodyRows.each(function() {
            const cell = $(this).find('td').eq(index);
            if (cell.length > 0) {
                maxWidth = Math.max(maxWidth, cell.outerWidth());
            }
        });
        $(this).css('width', maxWidth);
        bodyRows.each(function() {
            $(this).find('td').eq(index).css('width', maxWidth);
        });
    });
};

CMPortal.viewer.setupCategoryToggleButtons = function() {
    $('.category-toggle-protocol-variable, .category-toggle-analysis-method, .category-toggle-cell-profile, .category-toggle-study-characteristic, .category-toggle-measured-endpoint, .category-toggle-other').on('click', function() {
        setTimeout(function() {
            CMPortal.viewer.centerToggleMenu();
        }, 10);
    });
};

CMPortal.viewer.centerToggleMenu = function() {
    const collection = $('.dt-button-collection');
    if (collection.length > 0) {
        collection.css({
            'position': 'fixed',
            'top': '50%',
            'left': '50%',
            'transform': 'translate(-50%, -50%)',
            'max-height': '80vh',
            'overflow-y': 'auto',
            'z-index': '1001'
        });
        collection[0].offsetHeight;
    }
};

CMPortal.viewer.customizeColumnVisibilityDropdowns = function() {
    $('head').append(`
        <style>
            /* DataTable top section with buttons and search */
            .row.mb-3 {
                display: flex;
                align-items: center;
                margin-right: 0;
                margin-left: 0;
            }
            
            .col-sm-8 {
                flex: 0 0 66.67%;
                max-width: 66.67%;
                padding-left: 0;
            }
            
            .col-sm-4 {
                flex: 0 0 33.33%;
                max-width: 33.33%;
                padding-right: 0;
            }
            
            /* Smaller toggle buttons */
            .dt-buttons .btn-sm {
                padding: 0.25rem 0.5rem;
                font-size: 0.85rem;
            }
            
            /* Search box styling for right alignment */
            .dataTables_filter {
                text-align: right;
                width: 100%;
            }
            
            .dataTables_filter label {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                width: 100%;
                margin-bottom: 0;
            }
            
            .dataTables_filter input {
                margin-left: 0 !important;
                width: 200px;
                padding: 4px 8px;
                border: 1px solid var(--border);
                border-radius: 4px;
                height: calc(1.5em + 0.5rem + 2px);
            }
            
            /* Button collection dropdown styling */
            div.dt-button-collection {
                width: 1000px !important;
                max-width: 95vw !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                max-height: 80vh !important;
                overflow-y: auto !important;
                margin-top: 0 !important;
                margin-left: 0 !important;
                z-index: 1001 !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
                border-radius: 6px !important;
            }
            
            div.dt-button-collection button.dt-button {
                display: inline-block !important;
                width: 30% !important;
                box-sizing: border-box !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                margin: 0 !important;
                padding: 0.7em 1.2em !important;
                font-size: 1.05em !important;
            }
            
            /* Ensure that the header container scrolls horizontally */
            .dataTables_scrollHead {
                overflow: hidden !important;
            }
            
            div.dt-button-background {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 1000 !important;
                background: rgba(0, 0, 0, 0.6) !important;
            }
            
            /* Added grid line styles for the table header and body */
            #data-table {
                border-collapse: collapse;
            }
            #data-table th, #data-table td {
                border: 1px solid #dee2e6;
            }
            
            /* Responsive adjustment for smaller screens */
            @media (max-width: 768px) {
                .row.mb-3 {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .col-sm-8, .col-sm-4 {
                    flex: 0 0 100%;
                    max-width: 100%;
                    padding-left: 0;
                    padding-right: 0;
                }
                
                .dataTables_filter {
                    margin-top: 10px;
                    justify-content: flex-start;
                    text-align: left;
                }
                
                .dataTables_filter input {
                    width: 100%;
                    max-width: none;
                }
            }
        </style>
    `);
    
    $(document).on('click', '.dt-button', function() {
        setTimeout(CMPortal.viewer.centerToggleMenu, 10);
    });
    
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.classList && node.classList.contains('dt-button-collection')) {
                        CMPortal.viewer.centerToggleMenu();
                    }
                }
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
};

CMPortal.viewer.showError = function(message) {
    $('#loading-indicator').addClass('d-none');
    $('#error-message').removeClass('d-none').text(message);
};

// Set up event handlers for tab activation
$(document).on('tab-activated', function(event, tabId) {
    if (tabId === 'tab-viewer') {
        CMPortal.viewer.init();
    }
});