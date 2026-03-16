document.addEventListener('DOMContentLoaded', function () {
    const passwordInput = document.getElementById('login-password');
    const passwordToggle = document.getElementById('password-toggle');
    const loginForm = document.getElementById('login-form');

    if (passwordToggle && passwordInput) {
        passwordToggle.setAttribute('aria-pressed', 'false');
        passwordToggle.addEventListener('click', function () {
            const isPressed = this.getAttribute('aria-pressed') === 'true';
            const newState = !isPressed;
            this.setAttribute('aria-pressed', String(newState));
            passwordInput.type = newState ? 'text' : 'password';
            this.setAttribute('aria-label', newState ? 'Hide password' : 'Show password');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('login-email');
            var password = document.getElementById('login-password');
            if (!email || !password) return;
            if (!email.value.trim() || !password.value) {
                if (!email.value.trim()) email.focus();
                else password.focus();
                return;
            }
            // Replace with your actual login endpoint / redirect
            console.log('Login submitted', { email: email.value, password: '***' });
            // loginForm.submit(); or fetch('/api/login', { ... })
        });
    }
});
