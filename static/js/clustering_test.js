// Clustering Test JavaScript

// Global variables
let currentStep = 0;
let totalSteps = 0;
let countdownStarted = false;
let activationChecker = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the questionnaire page
    if (document.getElementById('questionnaire-form')) {
        initializeQuestionnaire();
    }
    
    // Check if we're on the results page
    if (window.USER_ID) {
        initializeResults();
    }
});

// === QUESTIONNAIRE FUNCTIONALITY ===

function initializeQuestionnaire() {
    const questionCards = document.querySelectorAll('.question-card');
    totalSteps = questionCards.length;
    
    // Set up navigation
    setupNavigation();
    updateProgress();
    
    // Form submission
    document.getElementById('questionnaire-form').addEventListener('submit', handleFormSubmission);
}

function setupNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', previousStep);
    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    
    // Remove auto-advance - let users manually click Next
    // This prevents the toggle issues you experienced
}

function nextStep() {
    if (!validateCurrentStep()) {
        return;
    }
    
    if (currentStep < totalSteps - 1) {
        currentStep++;
        showStep(currentStep);
        updateProgress();
    }
}

function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
        updateProgress();
    }
}

function validateCurrentStep() {
    const currentCard = document.querySelector(`.question-card[data-step="${currentStep}"]`);
    
    if (!currentCard) {
        console.error('Current card not found for step:', currentStep);
        return false;
    }
    
    if (currentStep === 0) {
        // Validate name
        const nameInput = document.getElementById('name');
        if (!nameInput || !nameInput.value.trim()) {
            if (nameInput) nameInput.focus();
            showError('Please enter your name');
            return false;
        }
    } else {
        // Validate radio button selection
        const radios = currentCard.querySelectorAll('input[type="radio"]');
        const checked = currentCard.querySelector('input[type="radio"]:checked');
        
        if (radios.length > 0 && !checked) {
            showError('Please select an answer before continuing');
            return false;
        }
    }
    
    return true;
}

function showStep(stepNumber) {
    // Hide all cards
    document.querySelectorAll('.question-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Show current card
    const currentCard = document.querySelector(`.question-card[data-step="${stepNumber}"]`);
    if (currentCard) {
        currentCard.classList.add('active');
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (prevBtn) {
        prevBtn.style.display = stepNumber > 0 ? 'inline-block' : 'none';
    }
    
    if (stepNumber === totalSteps - 1) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'inline-block';
    } else {
        if (nextBtn) nextBtn.style.display = 'inline-block';
        if (submitBtn) submitBtn.style.display = 'none';
    }
}

function updateProgress() {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    const progressBar = document.getElementById('progress-bar');
    const currentQuestion = document.getElementById('current-question');
    
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
    if (currentQuestion) {
        currentQuestion.textContent = currentStep + 1;
    }
}

function handleFormSubmission(event) {
    event.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    // Show loading state
    const form = document.getElementById('questionnaire-form');
    const loadingState = document.getElementById('loading-state');
    
    if (form) form.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';
    
    // Prepare form data
    const formData = new FormData();
    const nameInput = document.getElementById('name');
    if (nameInput) {
        formData.append('name', nameInput.value.trim());
    }
    
    // Add all question answers
    document.querySelectorAll('.question-card[data-step]').forEach((card, index) => {
        if (index > 0) { // Skip name step
            const radio = card.querySelector('input[type="radio"]:checked');
            if (radio) {
                formData.append(radio.name, radio.value);
            }
        }
    });
    
    // Submit to server
    fetch('/clustering-test/submit', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Redirect to results page
            window.location.href = `/clustering-test/results/${data.user_id}`;
        } else {
            showError(data.message || 'Error submitting form');
            // Show form again
            if (form) form.style.display = 'block';
            if (loadingState) loadingState.style.display = 'none';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Network error. Please try again.');
        if (form) form.style.display = 'block';
        if (loadingState) loadingState.style.display = 'none';
    });
}

function showError(message) {
    // Try multiple approaches for showing errors
    
    // First, try to find existing error containers
    let errorContainer = document.getElementById('error-message');
    if (!errorContainer) {
        errorContainer = document.querySelector('.error-message');
    }
    
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
        return;
    }
    
    // Try to show in an alert div
    const alertContainer = document.querySelector('.alert-danger');
    if (alertContainer) {
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertContainer.style.display = 'none';
        }, 5000);
        return;
    }
    
    // Create a temporary error message element
    const tempError = document.createElement('div');
    tempError.className = 'alert alert-danger mt-3';
    tempError.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 90%; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
    tempError.innerHTML = `
        <strong>⚠️ Error:</strong> ${message}
        <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(tempError);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (tempError.parentElement) {
            tempError.remove();
        }
    }, 5000);
    
    // Fallback to browser alert if all else fails
    setTimeout(() => {
        if (document.body.contains(tempError)) {
            alert(message);
        }
    }, 100);
}

// === RESULTS PAGE FUNCTIONALITY ===

function initializeResults() {
    startActivationWatcher();
    updateParticipantCount();
}

function startActivationWatcher() {
    // Check immediately
    checkActivationStatus();
    
    // Then check every 3 seconds
    activationChecker = setInterval(() => {
        if (!countdownStarted) {
            checkActivationStatus();
        }
    }, 3000);
}

function checkActivationStatus() {
    fetch('/api/clustering/check-activation')
        .then(response => response.json())
        .then(data => {
            if (data.activated && !countdownStarted) {
                clearInterval(activationChecker);
                startCountdown();
            } else if (!data.activated && countdownStarted) {
                // Handle deactivation - reset to waiting state
                resetToWaitingState();
            }
            
            // Update participant count if available
            const participantCount = document.getElementById('participant-count');
            if (data.user_count && participantCount) {
                participantCount.textContent = data.user_count;
            }
        })
        .catch(error => {
            console.log('Checking activation status...');
        });
}

function resetToWaitingState() {
    // Reset all states
    countdownStarted = false;
    
    // Show waiting section, hide others
    const waitingSection = document.getElementById('waiting-section');
    const countdownSection = document.getElementById('countdown-section');
    const resultsSection = document.getElementById('results-section');
    const errorSection = document.getElementById('error-section');
    
    if (waitingSection) waitingSection.style.display = 'block';
    if (countdownSection) countdownSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'none';
    
    // Restart activation watcher
    startActivationWatcher();
}

function updateParticipantCount() {
    // Update participant count immediately and then periodically
    const updateCount = () => {
        fetch('/api/clustering/check-activation')
            .then(response => response.json())
            .then(data => {
                const participantCount = document.getElementById('participant-count');
                if (data.user_count && participantCount) {
                    participantCount.textContent = data.user_count;
                }
            })
            .catch(() => {
                const participantCount = document.getElementById('participant-count');
                if (participantCount) {
                    participantCount.textContent = '...';
                }
            });
    };
    
    updateCount();
    setInterval(updateCount, 10000); // Update every 10 seconds
}

function startCountdown() {
    countdownStarted = true;
    
    // Hide waiting section, show countdown section
    const waitingSection = document.getElementById('waiting-section');
    const countdownSection = document.getElementById('countdown-section');
    
    if (waitingSection) waitingSection.style.display = 'none';
    if (countdownSection) countdownSection.style.display = 'block';
    
    let timeLeft = 10;
    const countdownDisplay = document.getElementById('countdown-display');
    
    const countdownTimer = setInterval(() => {
        if (countdownDisplay) {
            countdownDisplay.textContent = timeLeft;
        }
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(countdownTimer);
            fetchMatches();
        }
    }, 1000);
}

function fetchMatches() {
    fetch(`/api/clustering/get-matches/${window.USER_ID}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showResultsError(data.error);
            } else {
                displayMatches(data);
            }
        })
        .catch(error => {
            console.error('Error fetching matches:', error);
            showResultsError('Unable to load matches. Please refresh the page.');
        });
}

function displayMatches(matchData) {
    // Hide countdown, show results
    const countdownSection = document.getElementById('countdown-section');
    const resultsSection = document.getElementById('results-section');
    
    if (countdownSection) countdownSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    
    // Display matches
    const matchesList = document.getElementById('matches-list');
    if (matchesList && matchData.matches) {
        const matchesHTML = matchData.matches.map((name, index) => {
            const initial = name.charAt(0).toUpperCase();
            return `
                <div class="match-item">
                    <div class="match-avatar">${initial}</div>
                    <div class="match-name">${name}</div>
                </div>
            `;
        }).join('');
        
        matchesList.innerHTML = matchesHTML;
    }
    
    // Display compatibility reasons
    const reasonsContainer = document.getElementById('compatibility-reasons');
    if (reasonsContainer && matchData.reasons) {
        const reasonsHTML = matchData.reasons.map(reason => `
            <div class="reason-item">
                <div class="reason-icon">✓</div>
                <div class="reason-text">${reason}</div>
            </div>
        `).join('');
        
        reasonsContainer.innerHTML = reasonsHTML;
    }
}

function showResultsError(message) {
    const waitingSection = document.getElementById('waiting-section');
    const countdownSection = document.getElementById('countdown-section');
    const resultsSection = document.getElementById('results-section');
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');
    
    if (waitingSection) waitingSection.style.display = 'none';
    if (countdownSection) countdownSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'block';
    if (errorMessage) errorMessage.textContent = message;
}

// === DEBUG FUNCTIONS (for admin use) ===

function showDebugInfo() {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        if (debugInfo.style.display === 'none') {
            debugInfo.style.display = 'block';
            debugInfo.innerHTML = `
                <div class="mt-3 p-3 bg-light border rounded">
                    <strong>Debug Information:</strong><br>
                    User ID: ${window.USER_ID || 'Not set'}<br>
                    User Name: ${window.USER_NAME || 'Not set'}<br>
                    Countdown Started: ${countdownStarted}<br>
                    Current Time: ${new Date().toLocaleString()}<br>
                    <small class="text-muted">This information helps with troubleshooting.</small>
                </div>
            `;
        } else {
            debugInfo.style.display = 'none';
        }
    }
}

// Make checkActivationStatus available globally for debug button
window.checkActivationStatus = checkActivationStatus;
window.showDebugInfo = showDebugInfo;

// === UTILITY FUNCTIONS ===

// Add some visual feedback for better UX
function addClickFeedback() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('choice-label')) {
            e.target.style.transform = 'scale(0.98)';
            setTimeout(() => {
                e.target.style.transform = '';
            }, 150);
        }
    });
}

// Initialize click feedback
document.addEventListener('DOMContentLoaded', addClickFeedback);

// Handle page visibility changes (pause timers when tab is not active)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden - could pause timers here if needed
        console.log('Page hidden');
    } else {
        // Page is visible - resume normal operation
        console.log('Page visible');
        
        // If on results page and waiting, check activation status immediately
        if (window.USER_ID && !countdownStarted) {
            checkActivationStatus();
        }
    }
});

// Add some nice touch interactions for mobile
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function(e) {
        if (e.target.classList.contains('choice-label')) {
            e.target.style.transform = 'scale(0.98)';
        }
    });
    
    document.addEventListener('touchend', function(e) {
        if (e.target.classList.contains('choice-label')) {
            setTimeout(() => {
                e.target.style.transform = '';
            }, 150);
        }
    });
}