// === MOBILE-RESPONSIVE CLUSTERING TEST JAVASCRIPT ===

// Global variables
let currentStep = 0;
let totalSteps = 0;
let countdownStarted = false;
let checkStatusInterval = null;
let questions = [];

// Mobile detection and configuration
const MOBILE_CONFIG = {
    isMobile: window.innerWidth <= 768,
    isTouch: 'ontouchstart' in window,
    hasHapticFeedback: navigator.vibrate !== undefined,
    autoRefresh: window.innerWidth <= 768 ? 8000 : 10000, // Faster refresh on mobile
    maxRetries: 3,
    retryDelay: 2000
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('Clustering test initialized');
    
    // Initialize mobile-specific features
    initializeMobile();
    
    // Initialize questionnaire if on signup page
    if (document.getElementById('questionnaire-form')) {
        initializeQuestionnaire();
    }
    
    // Initialize results page if on results page
    if (window.USER_ID) {
        initializeResults();
    }
    
    // Add global error handling
    setupErrorHandling();
});

// === MOBILE INITIALIZATION ===
function initializeMobile() {
    // Add mobile-specific CSS classes
    if (MOBILE_CONFIG.isMobile) {
        document.body.classList.add('mobile-device');
    }
    
    if (MOBILE_CONFIG.isTouch) {
        document.body.classList.add('touch-device');
    }
    
    // Enhanced touch feedback
    addTouchFeedback();
    
    // Optimize viewport for mobile
    optimizeViewport();
    
    // Add swipe gestures for navigation
    addSwipeGestures();
    
    // Handle orientation changes
    handleOrientationChange();
}

// === QUESTIONNAIRE FUNCTIONALITY ===
function initializeQuestionnaire() {
    const form = document.getElementById('questionnaire-form');
    const questionCards = document.querySelectorAll('.question-card');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const progressBar = document.getElementById('progress-bar');
    
    if (!form || questionCards.length === 0) return;
    
    totalSteps = questionCards.length;
    questions = Array.from(questionCards);
    
    // Initialize progress
    updateProgress();
    
    // Add event listeners with mobile optimization
    nextBtn.addEventListener('click', handleNext);
    prevBtn.addEventListener('click', handlePrevious);
    form.addEventListener('submit', handleSubmit);
    
    // Add input validation with real-time feedback
    addInputValidation();
    
    // Auto-save progress on mobile (localStorage if available)
    if (MOBILE_CONFIG.isMobile) {
        addAutoSave();
    }
    
    console.log(`Questionnaire initialized with ${totalSteps} steps`);
}

function handleNext() {
    if (!validateCurrentStep()) {
        showValidationError();
        return;
    }
    
    // Haptic feedback on mobile
    triggerHapticFeedback();
    
    if (currentStep < totalSteps - 1) {
        currentStep++;
        showStep(currentStep);
        updateProgress();
        updateNavigation();
        
        // Smooth scroll to top on mobile
        if (MOBILE_CONFIG.isMobile) {
            smoothScrollToTop();
        }
    }
}

function handlePrevious() {
    triggerHapticFeedback();
    
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
        updateProgress();
        updateNavigation();
        
        if (MOBILE_CONFIG.isMobile) {
            smoothScrollToTop();
        }
    }
}

function validateCurrentStep() {
    const currentCard = questions[currentStep];
    
    if (currentStep === 0) {
        // Validate name field
        const nameInput = currentCard.querySelector('#name');
        const name = nameInput.value.trim();
        
        if (name.length < 2) {
            nameInput.classList.add('is-invalid');
            return false;
        } else {
            nameInput.classList.remove('is-invalid');
            return true;
        }
    } else {
        // Validate radio button selection
        const radioButtons = currentCard.querySelectorAll('input[type="radio"]');
        const isSelected = Array.from(radioButtons).some(radio => radio.checked);
        
        if (!isSelected) {
            // Show visual feedback
            const choicesContainer = currentCard.querySelector('.choices-container');
            choicesContainer.classList.add('shake-animation');
            setTimeout(() => choicesContainer.classList.remove('shake-animation'), 500);
            return false;
        }
        
        return true;
    }
}

function showValidationError() {
    if (MOBILE_CONFIG.isMobile) {
        // Use toast notification on mobile
        showToast('Please complete this step before continuing', 'warning');
        triggerHapticFeedback('error');
    } else {
        // Desktop validation styling
        const currentCard = questions[currentStep];
        currentCard.classList.add('validation-error');
        setTimeout(() => currentCard.classList.remove('validation-error'), 2000);
    }
}

function showStep(stepIndex) {
    // Hide all cards
    questions.forEach(card => {
        card.classList.remove('active');
        card.style.display = 'none';
    });
    
    // Show current card with animation
    const currentCard = questions[stepIndex];
    currentCard.style.display = 'block';
    
    // Small delay for smooth transition
    setTimeout(() => {
        currentCard.classList.add('active');
    }, 50);
    
    // Update question counter
    const questionCounter = document.getElementById('current-question');
    if (questionCounter) {
        questionCounter.textContent = stepIndex + 1;
    }
}

function updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const percentage = ((currentStep + 1) / totalSteps) * 100;
        progressBar.style.width = percentage + '%';
        progressBar.setAttribute('aria-valuenow', percentage);
    }
}

function updateNavigation() {
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    // Show/hide previous button
    if (currentStep === 0) {
        prevBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'block';
    }
    
    // Show submit button on last step
    if (currentStep === totalSteps - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
    } else {
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    
    if (!validateCurrentStep()) {
        showValidationError();
        return;
    }
    
    // Show loading state
    showLoadingState();
    
    try {
        const formData = new FormData(event.target);
        
        // Add mobile device info for analytics
        if (MOBILE_CONFIG.isMobile) {
            formData.append('device_type', 'mobile');
            formData.append('screen_width', window.innerWidth);
        }
        
        const response = await fetch('/clustering-test/submit', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            triggerHapticFeedback('success');
            // Redirect to results page
            window.location.href = `/clustering-test/results/${result.user_id}`;
        } else {
            throw new Error(result.message || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        showError(error.message || 'Something went wrong. Please try again.');
        hideLoadingState();
        triggerHapticFeedback('error');
    }
}

// === RESULTS PAGE FUNCTIONALITY ===
function initializeResults() {
    console.log('Initializing results for user:', window.USER_ID);
    
    // Start checking activation status
    checkActivationStatus();
    
    // Set up periodic checking with mobile-optimized intervals
    const interval = MOBILE_CONFIG.isMobile ? 8000 : 10000;
    checkStatusInterval = setInterval(checkActivationStatus, interval);
    
    // Add visibility change handler for mobile battery optimization
    if (MOBILE_CONFIG.isMobile) {
        handleVisibilityChange();
    }
}

async function checkActivationStatus() {
    try {
        const response = await fetch('/api/clustering/check-activation');
        const data = await response.json();
        
        updateParticipantCounter(data.total_responses);
        
        if (data.activated && !countdownStarted) {
            startCountdown();
        }
    } catch (error) {
        console.error('Error checking activation:', error);
        
        // Retry logic for mobile networks
        if (MOBILE_CONFIG.isMobile) {
            retryActivationCheck();
        }
    }
}

function updateParticipantCounter(count) {
    const counter = document.getElementById('participant-counter');
    if (counter && count !== undefined) {
        counter.innerHTML = `
            <div class="d-flex align-items-center justify-content-center">
                <span class="me-2">👥</span>
                <span><strong>${count}</strong> participants ready</span>
            </div>
        `;
    }
}

function startCountdown() {
    if (countdownStarted) return;
    
    countdownStarted = true;
    clearInterval(checkStatusInterval);
    
    // Hide waiting section, show countdown
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('countdown-section').style.display = 'block';
    
    let count = 5;
    const countdownDisplay = document.getElementById('countdown-number');
    
    triggerHapticFeedback('success');
    
    const countdownInterval = setInterval(() => {
        countdownDisplay.textContent = count;
        
        // Haptic feedback for each countdown tick on mobile
        if (MOBILE_CONFIG.isMobile && count <= 3) {
            triggerHapticFeedback();
        }
        
        if (count <= 0) {
            clearInterval(countdownInterval);
            showResults();
        }
        count--;
    }, 1000);
}

async function showResults() {
    try {
        // Show loading overlay on mobile
        if (MOBILE_CONFIG.isMobile) {
            showLoadingOverlay();
        }
        
        const response = await fetch(`/api/clustering/matches/${window.USER_ID}`);
        const data = await response.json();
        
        if (data.matches && data.matches.length > 0) {
            displayMatches(data.matches);
            displayReasons(data.reasons || []);
            
            // Hide countdown, show results
            document.getElementById('countdown-section').style.display = 'none';
            document.getElementById('results-section').style.display = 'block';
            
            triggerHapticFeedback('success');
            
            if (MOBILE_CONFIG.isMobile) {
                showToast('🎉 Your matches are ready!', 'success');
            }
        } else {
            throw new Error('No matches found');
        }
    } catch (error) {
        console.error('Error loading results:', error);
        showError('Could not load your matches. Please refresh the page.');
    } finally {
        if (MOBILE_CONFIG.isMobile) {
            hideLoadingOverlay();
        }
    }
}

function displayMatches(matches) {
    const container = document.getElementById('matches-container');
    if (!container) return;
    
    const matchesHTML = matches.map((match, index) => `
        <div class="card mb-3" style="animation-delay: ${index * 0.1}s">
            <div class="card-header bg-success text-white">
                <h5 class="mb-0">🎯 Match ${index + 1}</h5>
            </div>
            <div class="card-body">
                <div class="match-item">
                    <div class="match-avatar">
                        ${match.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="match-info">
                        <div class="match-name">${match.name}</div>
                        <small class="text-muted">Compatibility: ${match.score}%</small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = matchesHTML;
}

function displayReasons(reasons) {
    const container = document.getElementById('reasons-container');
    if (!container || !reasons.length) return;
    
    const reasonsHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">💡 Why These Matches?</h5>
            </div>
            <div class="card-body">
                ${reasons.map(reason => `
                    <div class="reason-item">
                        <div class="reason-icon">✓</div>
                        <div class="reason-text">${reason}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = reasonsHTML;
}

// === MOBILE-SPECIFIC ENHANCEMENTS ===

function addTouchFeedback() {
    if (!MOBILE_CONFIG.isTouch) return;
    
    // Enhanced touch feedback for all interactive elements
    document.addEventListener('touchstart', function(e) {
        const target = e.target.closest('.choice-label, .btn, .card');
        if (target) {
            target.style.transform = 'scale(0.95)';
            target.style.opacity = '0.8';
        }
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        const target = e.target.closest('.choice-label, .btn, .card');
        if (target) {
            setTimeout(() => {
                target.style.transform = '';
                target.style.opacity = '';
            }, 150);
        }
    }, { passive: true });
}

function addSwipeGestures() {
    if (!MOBILE_CONFIG.isTouch || !document.getElementById('questionnaire-form')) return;
    
    let startX = 0;
    let startY = 0;
    let isScrolling = false;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;
        isScrolling = false;
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        if (!isScrolling) {
            const diffX = Math.abs(e.touches[0].pageX - startX);
            const diffY = Math.abs(e.touches[0].pageY - startY);
            isScrolling = diffY > diffX;
        }
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        if (isScrolling) return;
        
        const diffX = e.changedTouches[0].pageX - startX;
        const threshold = 100;
        
        if (Math.abs(diffX) > threshold) {
            if (diffX > 0 && currentStep > 0) {
                // Swipe right - go back
                handlePrevious();
            } else if (diffX < 0 && currentStep < totalSteps - 1) {
                // Swipe left - go forward
                if (validateCurrentStep()) {
                    handleNext();
                }
            }
        }
    }, { passive: true });
}

function triggerHapticFeedback(type = 'light') {
    if (!MOBILE_CONFIG.hasHapticFeedback) return;
    
    const patterns = {
        light: 10,
        medium: 20,
        heavy: 50,
        success: [10, 50, 10],
        error: [50, 100, 50]
    };
    
    const pattern = patterns[type] || patterns.light;
    navigator.vibrate(pattern);
}

function optimizeViewport() {
    // Prevent zoom on input focus (iOS)
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport && MOBILE_CONFIG.isMobile) {
        metaViewport.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
    }
}

function handleOrientationChange() {
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            // Force a repaint to fix layout issues
            document.body.style.height = '100.1%';
            setTimeout(() => {
                document.body.style.height = '';
            }, 100);
            
            // Scroll to top
            window.scrollTo(0, 0);
        }, 300);
    });
}

function handleVisibilityChange() {
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Page is hidden - pause timers to save battery
            if (checkStatusInterval) {
                clearInterval(checkStatusInterval);
            }
        } else {
            // Page is visible - resume normal operation
            if (window.USER_ID && !countdownStarted) {
                checkActivationStatus();
                const interval = MOBILE_CONFIG.isMobile ? 8000 : 10000;
                checkStatusInterval = setInterval(checkActivationStatus, interval);
            }
        }
    });
}

function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function addAutoSave() {
    // Auto-save form progress on mobile
    const form = document.getElementById('questionnaire-form');
    if (!form) return;
    
    // Save progress on input change
    form.addEventListener('input', function(e) {
        if (e.target.type === 'radio' || e.target.type === 'text') {
            saveFormProgress();
        }
    });
    
    // Restore progress on load
    restoreFormProgress();
}

function saveFormProgress() {
    try {
        const formData = {
            currentStep: currentStep,
            answers: {}
        };
        
        // Save name
        const nameInput = document.getElementById('name');
        if (nameInput) {
            formData.answers.name = nameInput.value;
        }
        
        // Save radio button selections
        const radioButtons = document.querySelectorAll('input[type="radio"]:checked');
        radioButtons.forEach(radio => {
            formData.answers[radio.name] = radio.value;
        });
        
        localStorage.setItem('clustering_test_progress', JSON.stringify(formData));
    } catch (error) {
        console.warn('Could not save progress:', error);
    }
}

function restoreFormProgress() {
    try {
        const saved = localStorage.getItem('clustering_test_progress');
        if (!saved) return;
        
        const formData = JSON.parse(saved);
        
        // Restore name
        if (formData.answers.name) {
            const nameInput = document.getElementById('name');
            if (nameInput) {
                nameInput.value = formData.answers.name;
            }
        }
        
        // Restore radio selections
        Object.keys(formData.answers).forEach(name => {
            if (name !== 'name') {
                const radio = document.querySelector(`input[name="${name}"][value="${formData.answers[name]}"]`);
                if (radio) {
                    radio.checked = true;
                }
            }
        });
        
        // Restore current step (but don't go beyond what's valid)
        if (formData.currentStep && formData.currentStep <= currentStep) {
            // Only restore if we haven't progressed further
            currentStep = formData.currentStep;
            showStep(currentStep);
            updateProgress();
            updateNavigation();
        }
        
    } catch (error) {
        console.warn('Could not restore progress:', error);
    }
}

function clearFormProgress() {
    try {
        localStorage.removeItem('clustering_test_progress');
    } catch (error) {
        console.warn('Could not clear progress:', error);
    }
}

// === UTILITY FUNCTIONS ===

function showLoadingState() {
    const form = document.getElementById('questionnaire-form');
    const loadingState = document.getElementById('loading-state');
    
    if (form) form.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';
}

function hideLoadingState() {
    const form = document.getElementById('questionnaire-form');
    const loadingState = document.getElementById('loading-state');
    
    if (form) form.style.display = 'block';
    if (loadingState) loadingState.style.display = 'none';
}

function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showError(message) {
    // Hide other sections
    const sections = ['waiting-section', 'countdown-section', 'results-section'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Show error section
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');
    
    if (errorSection) {
        errorSection.style.display = 'block';
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }
    
    // Show toast on mobile
    if (MOBILE_CONFIG.isMobile) {
        showToast(message, 'danger');
    }
}

function showToast(message, type = 'info') {
    // Create toast if it doesn't exist
    let toast = document.getElementById('mobile-toast');
    if (!toast) {
        toast = createToastElement();
    }
    
    const toastBody = toast.querySelector('.toast-body');
    const toastHeader = toast.querySelector('.toast-header');
    
    // Update content
    if (toastBody) toastBody.textContent = message;
    
    // Update style
    const typeClasses = {
        success: 'bg-success',
        danger: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    if (toastHeader) {
        toastHeader.className = `toast-header ${typeClasses[type] || typeClasses.info} text-white`;
    }
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
}

function createToastElement() {
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1050';
    
    const toast = document.createElement('div');
    toast.id = 'mobile-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="toast-header bg-info text-white">
            <strong class="me-auto">ℹ️ Info</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            Message
        </div>
    `;
    
    toastContainer.appendChild(toast);
    document.body.appendChild(toastContainer);
    
    return toast;
}

function addInputValidation() {
    // Real-time validation for name input
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            if (this.value.trim().length >= 2) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                this.classList.remove('is-valid');
            }
        });
        
        nameInput.addEventListener('blur', function() {
            if (this.value.trim().length < 2) {
                this.classList.add('is-invalid');
            }
        });
    }
    
    // Add validation for radio buttons
    const radioGroups = document.querySelectorAll('input[type="radio"]');
    radioGroups.forEach(radio => {
        radio.addEventListener('change', function() {
            // Remove any validation errors when selection is made
            const questionCard = this.closest('.question-card');
            if (questionCard) {
                questionCard.classList.remove('validation-error');
                
                const choicesContainer = questionCard.querySelector('.choices-container');
                if (choicesContainer) {
                    choicesContainer.classList.remove('shake-animation');
                }
            }
            
            // Save progress on mobile
            if (MOBILE_CONFIG.isMobile) {
                saveFormProgress();
            }
            
            // Haptic feedback
            triggerHapticFeedback();
        });
    });
}

function retryActivationCheck() {
    let retryCount = 0;
    const maxRetries = MOBILE_CONFIG.maxRetries;
    
    const retryInterval = setInterval(async () => {
        try {
            await checkActivationStatus();
            clearInterval(retryInterval);
        } catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                showToast('Connection issues. Pull down to refresh.', 'warning');
            }
        }
    }, MOBILE_CONFIG.retryDelay);
}

function setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('JavaScript error:', e.error);
        if (MOBILE_CONFIG.isMobile) {
            showToast('Something went wrong. Try refreshing.', 'danger');
        }
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        if (MOBILE_CONFIG.isMobile) {
            showToast('Network error. Please check your connection.', 'warning');
        }
    });
    
    // Network status monitoring
    if (MOBILE_CONFIG.isMobile) {
        window.addEventListener('online', function() {
            showToast('Connection restored', 'success');
            if (window.USER_ID && !countdownStarted) {
                checkActivationStatus();
            }
        });
        
        window.addEventListener('offline', function() {
            showToast('You are offline. Some features may not work.', 'warning');
            if (checkStatusInterval) {
                clearInterval(checkStatusInterval);
            }
        });
    }
}

// === CSS ANIMATIONS FOR MOBILE ===
const cssAnimations = `
<style>
@keyframes shake-animation {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

.shake-animation {
    animation: shake-animation 0.5s ease-in-out;
}

.validation-error {
    border-left: 4px solid var(--danger-color) !important;
    background-color: rgba(239, 68, 68, 0.05) !important;
}

.mobile-device .choice-label {
    transition: all 0.2s ease !important;
}

.mobile-device .choice-label:active {
    transform: scale(0.98) !important;
    opacity: 0.8 !important;
}

.touch-device .btn:active {
    transform: scale(0.95) !important;
}

/* Improved mobile loading states */
.mobile-device .loading-container {
    padding: 3rem 1rem !important;
}

.mobile-device .spinner-border {
    width: 4rem !important;
    height: 4rem !important;
}

/* Better mobile match display */
@media (max-width: 575px) {
    .match-item {
        flex-direction: column !important;
        text-align: center !important;
        align-items: center !important;
    }
    
    .match-avatar {
        margin-right: 0 !important;
        margin-bottom: 1rem !important;
    }
    
    .match-info {
        text-align: center !important;
    }
}

/* Pull-to-refresh indicator */
.pull-to-refresh {
    position: fixed;
    top: -50px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 10px 20px;
    border-radius: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: top 0.3s ease;
    z-index: 1000;
}

.pull-to-refresh.active {
    top: 20px;
}
</style>
`;

// Inject mobile-specific CSS
if (MOBILE_CONFIG.isMobile || MOBILE_CONFIG.isTouch) {
    document.head.insertAdjacentHTML('beforeend', cssAnimations);
}

// === CLEANUP ===
window.addEventListener('beforeunload', function() {
    // Clear intervals
    if (checkStatusInterval) {
        clearInterval(checkStatusInterval);
    }
    
    // Clear form progress if successfully submitted
    if (document.getElementById('loading-state') && 
        document.getElementById('loading-state').style.display === 'block') {
        clearFormProgress();
    }
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeMobile,
        handleNext,
        handlePrevious,
        showToast,
        triggerHapticFeedback
    };
}