// --- Modal Logic Utility ---
const initializeModal = (options) => {
    const { modal, panel, openBtns, closeBtn, backdrop, onClose } = options;
    if (!modal || !panel || !closeBtn || !backdrop) return;

    const open = (e) => {
        if (e) e.preventDefault();

        // Scroll Lock
        document.documentElement.classList.add('scroll-lock');
        document.body.classList.add('scroll-lock');

        modal.classList.remove('hidden');
        // Trigger reflow for transitions
        void modal.offsetWidth;

        modal.classList.add('modal-open');

        setTimeout(() => {
            // Handle various transition classes
            panel.classList.remove('translate-x-full', 'translate-y-full', 'opacity-0', 'scale-95');
        }, 20);
    };

    const close = () => {
        // Unlock Scroll
        document.documentElement.classList.remove('scroll-lock');
        document.body.classList.remove('scroll-lock');

        modal.classList.remove('modal-open');

        // Add back the transition hidden classes based on what was there
        if (panel.dataset.transitionType === 'slide-y') {
            panel.classList.add('translate-y-full');
        } else if (panel.classList.contains('transition-transform') && !panel.classList.contains('translate-y-full')) {
            panel.classList.add('translate-x-full');
        } else {
            panel.classList.add('opacity-0', 'scale-95');
        }

        setTimeout(() => {
            modal.classList.add('hidden');
            if (onClose) onClose();
        }, 300);
    };

    if (openBtns && openBtns.length > 0) {
        openBtns.forEach(btn => {
            if (btn) btn.addEventListener('click', open); // Guard for each button
        });
    }

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);

    return { open, close }; // Return controls for manual use
};
