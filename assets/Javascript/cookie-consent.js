document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('accept-cookies');
    const rejectBtn = document.getElementById('reject-cookies');
    const content = document.getElementById('cookie-content');
    const actions = document.getElementById('cookie-actions');

    if (!banner || !acceptBtn || !rejectBtn) return;

    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
        // Show modal after a short delay
        setTimeout(() => {
            banner.classList.remove('opacity-0', 'pointer-events-none');
            banner.querySelector('div:last-child').classList.remove('scale-95');
        }, 1000);
    }

    const hideBanner = () => {
        banner.classList.add('opacity-0', 'pointer-events-none');
        banner.querySelector('div:last-child').classList.add('scale-95');
        setTimeout(() => {
            banner.remove();
        }, 600);
    };

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('cookie-consent', 'accepted');
        hideBanner();
        if (typeof showToast === 'function') showToast('Preferences saved!', 'success');
    });

    rejectBtn.addEventListener('click', () => {
        // Change content to warning as requested
        content.innerHTML = `
            <h3 class="text-2xl font-serif mb-4 text-ivory flex flex-col items-center gap-4">
                <div class="p-3 bg-red-500/10 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8 text-red-500"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                </div>
                Limited Experience Warning
            </h3>
            <p class="text-sm font-sans text-ivory/60 leading-relaxed text-center">
                By rejecting cookies, items in your <b>Cart</b>, <b>Wishlist</b>, and <b>Recently Viewed</b> will NOT be saved across sessions. Local storage will be restricted.
            </p>
        `;

        actions.innerHTML = `
            <button id="reconsider-accept" class="w-full py-4 rounded-2xl bg-ivory text-royal-black hover:bg-white transition-all text-sm font-semibold uppercase tracking-widest shadow-xl">
                Accept All
            </button>
            <button id="confirm-reject" class="w-full py-4 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium uppercase tracking-[0.2em]">
                Still Reject
            </button>
        `;

        // Re-attach listeners to new dynamic buttons
        document.getElementById('confirm-reject').addEventListener('click', () => {
            // SET THE CONSENT FIRST before reloading
            localStorage.setItem('cookie-consent', 'rejected');

            // Clear current persistent data to respect the choice
            localStorage.removeItem('ris_cart');
            localStorage.removeItem('ris_wishlist');
            localStorage.removeItem('recentlyViewed');
            localStorage.removeItem('fusion_chat_history');

            hideBanner();
            if (typeof showToast === 'function') showToast('Privacy mode active', 'success');

            // Wait for toast and animation before reload
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });

        document.getElementById('reconsider-accept').addEventListener('click', () => {
            localStorage.setItem('cookie-consent', 'accepted');
            hideBanner();
            if (typeof showToast === 'function') showToast('Preferences saved!', 'success');
        });
    });
});
