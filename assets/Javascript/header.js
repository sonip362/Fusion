document.addEventListener('DOMContentLoaded', function () {
    // --- Nav Link Active Logic (White Pill Cover) ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    if (navLinks.length > 0 && sections.length > 0) {
        let isTicking = false;

        const handleNavHighlight = () => {
            let currentId = '';
            const scrollPos = window.scrollY + 200; // Offset for detection

            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    currentId = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentId}`) {
                    link.classList.add('active');
                } else if (currentId === 'shop-by-collection' && link.getAttribute('href') === '#shop-by-collection') {
                    // Specific match for shop-by-collection if needed
                    link.classList.add('active');
                }
            });
        };

        window.addEventListener('scroll', () => {
            if (!isTicking) {
                window.requestAnimationFrame(() => {
                    handleNavHighlight();
                    isTicking = false;
                });
                isTicking = true;
            }
        });

        // Initial check
        handleNavHighlight();
    }
});
