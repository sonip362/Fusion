document.addEventListener('DOMContentLoaded', () => {
    const getElements = () => ({
        screen: document.getElementById('login-screen'),
        emailInput: document.getElementById('login-email-new'),
        passwordInput: document.getElementById('login-password-new'),
        submitBtn: document.getElementById('login-submit-btn'),
        toggleBtn: document.getElementById('toggle-password-new'),
        mobileMenu: document.getElementById('mobile-menu')
    });

    const updateSubmitState = () => {
        const { emailInput, passwordInput, submitBtn } = getElements();
        if (!emailInput || !passwordInput || !submitBtn) return;
        
        const isValid = emailInput.value.includes('@') && passwordInput.value.length >= 6;
        submitBtn.disabled = !isValid;
    };

    const openLogin = (e) => {
        if (e) e.preventDefault();
        const { screen, mobileMenu, emailInput } = getElements();

        if (!screen) return;
        if (mobileMenu) mobileMenu.classList.add('hidden');

        // Reset positions and show screen
        screen.classList.remove('translate-x-full');
        screen.style.setProperty('translate', '0 0', 'important');
        screen.style.setProperty('visibility', 'visible', 'important');
        
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            if (emailInput) emailInput.focus();
        }, 500);
    };

    const closeLogin = () => {
        const { screen } = getElements();
        if (screen) {
            screen.classList.add('translate-x-full');
            screen.style.setProperty('translate', '100% 0', 'important');
        }
        document.body.style.overflow = '';
    };

    // Event Delegation
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.closest('#login-btn-desktop') || target.closest('#login-btn-mobile')) {
            openLogin(e);
        }
        
        if (target.closest('#close-login-drawer')) {
            closeLogin();
        }

        if (target.closest('#toggle-password-new')) {
            const { passwordInput } = getElements();
            if (passwordInput) {
                const isMasked = passwordInput.type === 'password';
                passwordInput.type = isMasked ? 'text' : 'password';
                
                const eyeVisible = document.getElementById('eye-visible-svg');
                const eyeHidden = document.getElementById('eye-hidden-svg');
                
                if (isMasked) {
                    // Password just became visible (type="text") -> Show 'Slash' Eye (Click to hide)
                    if (eyeVisible) eyeVisible.classList.add('hidden');
                    if (eyeHidden) eyeHidden.classList.remove('hidden');
                } else {
                    // Password just became masked (type="password") -> Show 'Open' Eye (Click to see)
                    if (eyeVisible) eyeVisible.classList.remove('hidden');
                    if (eyeHidden) eyeHidden.classList.add('hidden');
                }
            }
        }
    });

    // Validation Listeners
    document.addEventListener('input', (e) => {
        if (e.target.id === 'login-email-new' || e.target.id === 'login-password-new') {
            updateSubmitState();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLogin();
    });
});
