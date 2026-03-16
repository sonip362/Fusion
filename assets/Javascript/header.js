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
                    handleHeaderShrink();
                    isTicking = false;
                });
                isTicking = true;
            }
        });

        const handleHeaderShrink = () => {
            const header = document.getElementById('main-header');
            const heroLogo = document.getElementById('hero-fusion-logo');
            const headerLogo = document.querySelector('#main-header img');
            
            if (!header) return;

            // --- Scroll Position Logic ---
            const scrollY = window.scrollY;
            const threshold = 400; // Distance over which transition happens
            const progress = Math.min(scrollY / threshold, 1);

            // 1. Shrink and Move Hero Logo
            if (heroLogo) {
                const targetScale = 0.3; // Shrink to 30%
                const scale = 1 - (progress * (1 - targetScale));
                const translateY = -scrollY * 0.8; // Move up faster than scroll
                
                heroLogo.style.transform = `scale(${scale}) translateY(${translateY}px)`;
                heroLogo.style.opacity = 1 - (progress * 1.5); // Fade out faster
            }

            // 2. Handle Header Style & Logo Opacity
            if (scrollY > 100) {
                header.classList.add('header-shrunk');
                if (headerLogo) headerLogo.style.opacity = "1";
            } else {
                header.classList.remove('header-shrunk');
                // Gradually fade in header logo as hero fades out
                if (headerLogo) headerLogo.style.opacity = progress.toString();
            }
        };

        // Initial check
        handleNavHighlight();
        handleHeaderShrink();
    }

    // Theme toggle removed
});
