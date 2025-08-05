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
    
    prevBtn.addEventListener('click', previousStep);
    nextBtn.addEventListener('click', nextStep);
    
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
    
    if (currentStep === 0) {
        // Validate name
        const nameInput = document.getElementById('name');
        if (!nameInput.value.trim()) {
            nameInput.focus();
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
    
    prevBtn.style.display = stepNumber > 0 ? 'inline-block' : 'none';
    
    if (stepNumber === totalSteps - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

function updateProgress() {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('current-question').textContent = currentStep + 1;
}

function handleFormSubmission(event) {
    event.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    // Show loading state
    document.getElementById('questionnaire-form').style.display = 'none';
    document.getElementById('loading-state').style.display = 'block';
    
    // Prepare form data
    const formData = new FormData();
    formData.append('name', document.getElementById('name').value.trim());
    
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
            document.getElementById('questionnaire-form').style.display = 'block';
            document.getElementById('loading-state').style.display = 'none';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Network error. Please try again.');
        document.getElementById('questionnaire-form').style.display = 'block';
        document.getElementById('loading-state').style.display = 'none';
    });
}

function showError(message) {
    // Simple error display - you can enhance this with better UI
    alert(message);
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
            if (data.user_count) {
                document.getElementById('participant-count').textContent = data.user_count;
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
    document.getElementById('waiting-section').style.display = 'block';
    document.getElementById('countdown-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('error-section').style.display = 'none';
    
    // Restart activation watcher
    startActivationWatcher();
}

function updateParticipantCount() {
    // Update participant count immediately and then periodically
    const updateCount = () => {
        fetch('/api/clustering/check-activation')
            .then(response => response.json())
            .then(data => {
                if (data.user_count) {
                    document.getElementById('participant-count').textContent = data.user_count;
                }
            })
            .catch(() => {
                document.getElementById('participant-count').textContent = '...';
            });
    };
    
    updateCount();
    setInterval(updateCount, 10000); // Update every 10 seconds
}

function startCountdown() {
    countdownStarted = true;
    
    // Hide waiting section, show countdown section
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('countdown-section').style.display = 'block';
    
    let timeLeft = 15;
    const countdownDisplay = document.getElementById('countdown-display');
    
    const countdownTimer = setInterval(() => {
        countdownDisplay.textContent = timeLeft;
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
                showError(data.error);
            } else {
                displayMatches(data);
            }
        })
        .catch(error => {
            console.error('Error fetching matches:', error);
            showError('Unable to load matches. Please refresh the page.');
        });
}

function displayMatches(matchData) {
    // Hide countdown, show results
    document.getElementById('countdown-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    // Display matches
    const matchesList = document.getElementById('matches-list');
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
    
    // Display compatibility reasons
    const reasonsContainer = document.getElementById('compatibility-reasons');
    const reasonsHTML = matchData.reasons.map(reason => `
        <div class="reason-item">
            <div class="reason-icon">✓</div>
            <div class="reason-text">${reason}</div>
        </div>
    `).join('');
    
    reasonsContainer.innerHTML = reasonsHTML;
}

function showError(message) {
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('countdown-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('error-section').style.display = 'block';
    document.getElementById('error-message').textContent = message;
}

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