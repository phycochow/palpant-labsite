/**
 * Base JavaScript functionality for CMPortal
 */

// Create global namespace first before using it
window.CMPortal = {};

// Define the initTabs function in the CMPortal namespace
CMPortal.initTabs = function() {
    // Configure tab navigation
    $('.tab-link').click(function() {
        const tabId = $(this).attr('data-tab');
        $('.tab-content, .tab-link').removeClass('active');
        $('#' + tabId).addClass('active');
        $(this).addClass('active');
        
        // Dispatch tab activation event
        $(document).trigger('tab-activated', [tabId]);
    });
};

// Initialize the application
$(document).ready(function() {
    // Initialize tabs
    CMPortal.initTabs();
    
    // Trigger event for the initially active tab
    const initialActiveTab = $('.tab-link.active').attr('data-tab');
    $(document).trigger('tab-activated', [initialActiveTab]);
});