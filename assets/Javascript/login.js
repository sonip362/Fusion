document.addEventListener('DOMContentLoaded', () => {
    let isRegisterMode = false;
    let registerPhotoDataUrl = '';

    const elements = {
        screen: document.getElementById('login-screen'),
        form: document.getElementById('login-form-new'),
        nameContainer: document.getElementById('register-name-container'),
        nameInput: document.getElementById('register-name-new'),
        photoContainer: document.getElementById('register-photo-container'),
        photoInput: document.getElementById('register-photo-new'),
        photoPreview: document.getElementById('register-photo-preview'),
        emailInput: document.getElementById('login-email-new'),
        passwordInput: document.getElementById('login-password-new'),
        submitBtn: document.getElementById('login-submit-btn'),
        switchBtn: document.getElementById('switch-to-register-btn'),
        forgotLink: document.getElementById('forgot-password-link'),
        mobileMenu: document.getElementById('mobile-menu'),

        // QR Login UI
        qrBtn: document.getElementById('qr-login-btn'),
        qrPanel: document.getElementById('qr-login-panel'),
        qrClose: document.getElementById('qr-login-close')
    };

    const closeQrPanel = () => {
        if (elements.qrPanel) elements.qrPanel.classList.add('hidden');
    };

    const openQrPanel = () => {
        if (!elements.qrPanel) return;
        elements.qrPanel.classList.remove('hidden');
        if (typeof showMessage === 'function') {
            showMessage('Coming Soon', 'QR login is not enabled yet. This is a placeholder.', 'success');
        }
    };

    const updateUIState = () => {
        if (isRegisterMode) {
            elements.nameContainer.classList.remove('hidden');
            if (elements.photoContainer) elements.photoContainer.classList.remove('hidden');
            elements.nameInput.setAttribute('required', 'true');
            elements.submitBtn.textContent = 'Sign Up';
            elements.switchBtn.textContent = 'Already have an account? Log In';
            elements.forgotLink.classList.add('hidden');
        } else {
            elements.nameContainer.classList.add('hidden');
            if (elements.photoContainer) elements.photoContainer.classList.add('hidden');
            elements.nameInput.removeAttribute('required');
            elements.submitBtn.textContent = 'Log In';
            elements.switchBtn.textContent = 'Create Account';
            elements.forgotLink.classList.remove('hidden');
        }
    };

    const validateForm = () => {
        const emailValid = elements.emailInput.value.includes('@');
        const passwordValid = elements.passwordInput.value.length >= 6;
        const nameValid = !isRegisterMode || elements.nameInput.value.trim().length > 0;

        elements.submitBtn.disabled = !(emailValid && passwordValid && nameValid);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        
        const endpoint = isRegisterMode ? '/api/register' : '/api/login';
        const payload = {
            email: elements.emailInput.value,
            password: elements.passwordInput.value,
            guestId: (typeof getGuestId === 'function') ? getGuestId() : null,
            ...(isRegisterMode && {
                fullName: elements.nameInput.value,
                profilePicture: registerPhotoDataUrl
            })
        };

        try {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = isRegisterMode ? 'Creating Account...' : 'Logging In...';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                // Error response from server
                showMessage('Error', data.error || 'Something went wrong', 'error');
            } else {
                // Success!!
                if (isRegisterMode) {
                    showMessage('Welcome', 'Registration successful! You can now log in.', 'success');
                    isRegisterMode = false; // Switch to login mode after successful registration
                } else {
                    const rewardCoinsAdded = Number(data.rewardCoinsAdded) || 0;
                    if (rewardCoinsAdded > 0) {
                        showMessage('Success', `Login successful! +${rewardCoinsAdded} coins added.`, 'success');
                    } else {
                        showMessage('Success', 'Login successful!', 'success');
                    }
                }
                
                if (data.user) {
                    localStorage.setItem('fusion_user', JSON.stringify(data.user));
                    // Optional: Refresh the page or update the header UI
                    setTimeout(() => {
                        closeLogin();
                        window.location.reload(); 
                    }, 500);
                }
            }

        } catch (error) {
            showMessage('Error', error.message, 'error');
        } finally {
            elements.submitBtn.disabled = false;
            updateUIState();
        }
    };

    // --- Drawer Controls ---
    const openLogin = (e) => {
        if (e) e.preventDefault();
        if (elements.mobileMenu) elements.mobileMenu.classList.add('hidden');
        elements.screen.classList.remove('translate-x-full');
        elements.screen.style.setProperty('translate', '0 0', 'important');
        elements.screen.style.setProperty('visibility', 'visible', 'important');
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('scroll-lock');
        document.body.classList.add('scroll-lock');
    };

    const closeLogin = () => {
        elements.screen.classList.add('translate-x-full');
        elements.screen.style.setProperty('translate', '100% 0', 'important');
        document.body.style.overflow = '';
        document.documentElement.classList.remove('scroll-lock');
        document.body.classList.remove('scroll-lock');
        closeQrPanel();
        
        // Dispatch event for cookie consent to show
        document.dispatchEvent(new CustomEvent('loginClosed'));
    };

    // --- Listeners ---
    elements.form.addEventListener('submit', handleAuth);

    elements.switchBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        updateUIState();
        validateForm();
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#login-btn-desktop') || target.closest('#login-btn-mobile')) openLogin(e);
        if (target.closest('#close-login-drawer')) closeLogin();
        if (target.closest('#qr-login-btn')) {
            e.preventDefault();
            openQrPanel();
        }
        if (target.closest('#qr-login-close')) {
            e.preventDefault();
            closeQrPanel();
        }
        
        if (target.closest('#toggle-password-new')) {
            const isMasked = elements.passwordInput.type === 'password';
            elements.passwordInput.type = isMasked ? 'text' : 'password';
            // When masked: show "eye" (action: show). When visible: show "eye-slash" (action: hide).
            document.getElementById('eye-visible-svg').classList.toggle('hidden', !isMasked);
            document.getElementById('eye-hidden-svg').classList.toggle('hidden', isMasked);
        }
    });

    document.addEventListener('input', validateForm);
    document.addEventListener('change', (e) => {
        if (!e.target.matches('#register-photo-new')) return;
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type || !file.type.startsWith('image/')) {
            showMessage('Error', 'Please choose an image file.', 'error');
            e.target.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showMessage('Error', 'Image must be under 2MB.', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            registerPhotoDataUrl = String(reader.result || '');
            if (elements.photoPreview && registerPhotoDataUrl) {
                elements.photoPreview.src = registerPhotoDataUrl;
            }
        };
        reader.onerror = () => showMessage('Error', 'Failed to read image file.', 'error');
        reader.readAsDataURL(file);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLogin(); });
});
