// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

    if (e.key === 'Escape') {
        if (typeof wishlistModal !== 'undefined' && wishlistModal) wishlistModal.close();
        if (typeof cartModal !== 'undefined' && cartModal) cartModal.close();
        if (typeof quickViewModalCtl !== 'undefined' && quickViewModalCtl) quickViewModalCtl.close();
        if (typeof closeInfoModal === 'function') closeInfoModal();

        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
        }

        if (isInput) {
            e.target.blur();
        }
        return;
    }

    if ((e.key === '/' && !isInput) || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        const sInput = document.getElementById('product-search-input');
        const collectionSection = document.getElementById('shop-by-collection');

        if (collectionSection && sInput) {
            collectionSection.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
                if (sInput) sInput.focus({ preventScroll: true });
            }, 500);
        }
        return;
    }

    if (isInput) return;

    if (e.key === 'ArrowLeft') {
        const prevBtn = document.getElementById('carousel-prev-btn');
        if (prevBtn) { e.preventDefault(); prevBtn.click(); }
    }
    if (e.key === 'ArrowRight') {
        const nextBtn = document.getElementById('carousel-next-btn');
        if (nextBtn) { e.preventDefault(); nextBtn.click(); }
    }

    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        // Correct order based on DOM structure
        const sectionIds = ['home', 'shop-by-collection', 'recently-viewed', 'limited', 'testimonials', 'faq', 'about', 'footer'];
        // Filter for existing and visible elements (offsetParent !== null means display != none)
        const sections = sectionIds
            .map(id => document.getElementById(id))
            .filter(el => el && el.offsetParent !== null)
            .sort((a, b) => a.offsetTop - b.offsetTop); // Double check sort by offsetTop

        const currentScroll = window.scrollY;
        const buffer = 50;

        if (e.key === 'ArrowDown') {
            const nextSection = sections.find(sec => sec.offsetTop > currentScroll + buffer);
            if (nextSection) nextSection.scrollIntoView({ behavior: 'smooth' });
        } else if (e.key === 'ArrowUp') {
            const prevSection = [...sections].reverse().find(sec => sec.offsetTop < currentScroll - buffer);
            if (prevSection) prevSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        if (typeof cartModal !== 'undefined' && cartModal) cartModal.open();
    }

    if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (typeof wishlistModal !== 'undefined' && wishlistModal) wishlistModal.open();
    }

    if (e.key === '?') {
        e.preventDefault();
        if (typeof showToast === 'function') showToast('Shortcuts: Shift+↑/↓  (Nav), ←/→ (Slide), / (Search), C (Cart), W (Wishlist), Esc (Close Modals)', 'success', 5000);
    }
});
