// --- Toast Message Component ---
const showToast = (message, iconType = 'success', duration = 2000) => {
    const toast = document.getElementById('toast-notification');
    if (!toast) return; // Guard

    const toastMessage = document.getElementById('toast-message');
    const toastIconSuccess = document.getElementById('toast-icon-success');
    const toastIconWishlist = document.getElementById('toast-icon-wishlist');

    if (window.toastTimeout) clearTimeout(window.toastTimeout);

    if (toastMessage) toastMessage.textContent = message;
    if (toastIconSuccess && toastIconWishlist) {
        if (iconType === 'success') {
            toastIconSuccess.classList.remove('hidden');
            toastIconWishlist.classList.add('hidden');
        } else if (iconType === 'wishlist') {
            toastIconSuccess.classList.add('hidden');
            toastIconWishlist.classList.remove('hidden');
        }
    }

    toast.classList.add('show');

    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
};
