// --- App State (Global) ---
let cart = [];
let wishlist = [];

// --- State Management ---
const loadState = () => {
    const consent = localStorage.getItem('cookie-consent');
    if (consent === 'rejected') {
        cart = [];
        wishlist = [];
        return;
    }

    try {
        cart = JSON.parse(localStorage.getItem('ris_cart') || '[]');
    } catch {
        cart = [];
        console.warn("Corrupted cart data in localStorage, resetting.");
    }
    try {
        wishlist = JSON.parse(localStorage.getItem('ris_wishlist') || '[]');
    } catch {
        wishlist = [];
        console.warn("Corrupted wishlist data in localStorage, resetting.");
    }
};

const saveState = () => {
    const consent = localStorage.getItem('cookie-consent');
    if (consent !== 'accepted') {
        // Only save in memory if rejected or not yet decided
        return;
    }
    localStorage.setItem('ris_cart', JSON.stringify(cart));
    localStorage.setItem('ris_wishlist', JSON.stringify(wishlist));
};

// --- Helper Functions ---
const parsePrice = (priceString) => {
    return Number(String(priceString).replace(/[^0-9.-]+/g, ""));
};

const formatPrice = (priceNumber) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(priceNumber).replace('INR', '₹');
};

const updateBadges = () => {
    const cartBadgeDesktop = document.getElementById('cart-badge-desktop');
    const cartBadgeMobile = document.getElementById('cart-badge-mobile');
    const wishlistBadgeDesktop = document.getElementById('wishlist-badge-desktop');
    const wishlistBadgeMobile = document.getElementById('wishlist-badge-mobile');

    const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const wishlistCount = wishlist.length;

    [[cartBadgeDesktop, cartCount], [cartBadgeMobile, cartCount]].forEach(([el, count]) => {
        if (!el) return;
        if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });

    [[wishlistBadgeDesktop, wishlistCount], [wishlistBadgeMobile, wishlistCount]].forEach(([el, count]) => {
        if (!el) return;
        if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
};

// Global handles for modals (needed by multiple scripts)
let wishlistModal, cartModal, quickViewModalCtl;

document.addEventListener('DOMContentLoaded', function () {

    // Initialize state on load
    loadState();

    // --- Prevent default on placeholder links ---
    document.querySelectorAll('a[href="#"]').forEach(link => {
        link.addEventListener('click', e => e.preventDefault());
    });

    // --- Page Initialization ---

    // Menu
    const menuBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('mobile-menu-close-btn');
    const menu = document.getElementById('mobile-menu');
    const menuLinks = document.querySelectorAll('.mobile-menu-link');

    if (menuBtn && closeBtn && menu && menuLinks.length > 0) {
        menuBtn.addEventListener('click', () => {
            menu.classList.remove('hidden');
            document.documentElement.classList.add('scroll-lock');
            document.body.classList.add('scroll-lock');
        });
        closeBtn.addEventListener('click', () => {
            menu.classList.add('hidden');
            document.documentElement.classList.remove('scroll-lock');
            document.body.classList.remove('scroll-lock');
        });
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.add('hidden');
                document.documentElement.classList.remove('scroll-lock');
                document.body.classList.remove('scroll-lock');
            });
        });
    }

    // --- Scroll Logic ---
    const mainHeader = document.getElementById('main-header');
    const heroTitle = document.getElementById('hero-title-text');
    const backTopBtn = document.getElementById('backTop');
    const heroImage = document.querySelector('#home picture img');

    const handleScroll = () => {
        const scrollY = window.scrollY;

        // --- Scroll Progress Bar ---
        const scrollProgressBar = document.getElementById('scroll-progress-bar');
        if (scrollProgressBar) {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercentage = (scrollY / windowHeight) * 100;
            scrollProgressBar.style.width = scrollPercentage + '%';
        }

        if (mainHeader) {
            if (scrollY > 50) {
                mainHeader.classList.remove('-translate-y-full', 'opacity-0');
                if (heroTitle) heroTitle.classList.add('opacity-0');
            } else {
                mainHeader.classList.add('-translate-y-full', 'opacity-0');
                if (heroTitle) heroTitle.classList.remove('opacity-0');
            }
        }

        if (backTopBtn) {
            if (scrollY > 300) {
                backTopBtn.classList.add('show');
            } else {
                backTopBtn.classList.remove('show');
            }
        }

        if (heroImage) {
            const parallaxSpeed = 0.5;
            heroImage.style.transform = `translateY(${scrollY * parallaxSpeed}px)`;
        }
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });

    // --- Confirm Dialogs ---
    const cartConfirmOk = document.getElementById('cart-confirm-ok');
    const cartConfirmCancel = document.getElementById('cart-confirm-cancel');
    const wishlistConfirmOk = document.getElementById('wishlist-confirm-ok');
    const wishlistConfirmCancel = document.getElementById('wishlist-confirm-cancel');

    if (cartConfirmOk) {
        cartConfirmOk.addEventListener('click', () => {
            cart = [];
            saveState();
            if (typeof renderCart === 'function') renderCart();
            if (typeof showToast === 'function') showToast('Cart cleared', 'success');
            if (typeof closeCartConfirm === 'function') closeCartConfirm();
        });
    }
    if (cartConfirmCancel) cartConfirmCancel.addEventListener('click', closeCartConfirm);

    if (wishlistConfirmOk) {
        wishlistConfirmOk.addEventListener('click', () => {
            wishlist = [];
            saveState();
            if (typeof renderWishlist === 'function') renderWishlist();
            if (typeof showToast === 'function') showToast('Wishlist cleared', 'success');
            if (typeof closeWishlistConfirm === 'function') closeWishlistConfirm();
        });
    }
    if (wishlistConfirmCancel) wishlistConfirmCancel.addEventListener('click', closeWishlistConfirm);


    // --- Modal Initializations ---

    wishlistModal = initializeModal({
        modal: document.getElementById('wishlist-modal'),
        panel: document.getElementById('wishlist-panel'),
        openBtns: [
            document.getElementById('wishlist-btn-desktop'),
            document.getElementById('wishlist-btn-mobile')
        ],
        closeBtn: document.getElementById('close-wishlist-modal'),
        backdrop: document.getElementById('wishlist-backdrop'),
        onClose: closeWishlistConfirm
    });

    cartModal = initializeModal({
        modal: document.getElementById('cart-modal'),
        panel: document.getElementById('cart-panel'),
        openBtns: [
            document.getElementById('cart-btn-desktop'),
            document.getElementById('cart-btn-mobile')
        ],
        closeBtn: document.getElementById('close-cart-modal'),
        backdrop: document.getElementById('cart-backdrop'),
        onClose: closeCartConfirm
    });

    quickViewModalCtl = initializeModal({
        modal: document.getElementById('quick-view-modal'),
        panel: document.getElementById('quick-view-panel'),
        openBtns: [],
        closeBtn: document.getElementById('close-quick-view-modal'),
        backdrop: document.getElementById('quick-view-backdrop'),
        onClose: () => {
            currentQuickViewProduct = null;
        }
    });

    // Cart "Continue Shopping"
    const cartContinueShopping = document.getElementById('cart-continue-shopping');
    const cartContinueShoppingFooter = document.getElementById('cart-continue-shopping-footer');

    if (cartContinueShopping && cartModal) {
        cartContinueShopping.addEventListener('click', () => cartModal.close());
    }
    if (cartContinueShoppingFooter && cartModal) {
        cartContinueShoppingFooter.addEventListener('click', (e) => {
            e.preventDefault();
            cartModal.close();
        });
    }

    // --- Product Grid Event Delegation ---
    const productGrid = document.getElementById('collection-product-grid');
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (!productCard) return;

            const product = getProductData(productCard);
            if (!product) return;

            if (e.target.closest('.quick-view-btn')) {
                e.preventDefault(); e.stopPropagation();
                openQuickView(product);
            } else if (e.target.closest('.add-to-cart-btn')) {
                e.preventDefault(); e.stopPropagation();
                addItemToCart(product);
            } else if (e.target.closest('.add-to-wishlist-btn')) {
                e.preventDefault(); e.stopPropagation();
                addItemToWishlist(product);
            }
        });
    }

    // Quick View Modal Buttons
    const quickViewAddToCartBtn = document.getElementById('quick-view-add-to-cart');
    const quickViewAddToWishlistBtn = document.getElementById('quick-view-add-to-wishlist');

    if (quickViewAddToCartBtn && quickViewModalCtl) {
        quickViewAddToCartBtn.addEventListener('click', () => {
            if (currentQuickViewProduct) {
                addItemToCart(currentQuickViewProduct);
                quickViewModalCtl.close();
            }
        });
    }

    if (quickViewAddToWishlistBtn && quickViewModalCtl) {
        quickViewAddToWishlistBtn.addEventListener('click', () => {
            if (currentQuickViewProduct) {
                addItemToWishlist(currentQuickViewProduct);
                quickViewModalCtl.close();
            }
        });
    }

    // Cart & Wishlist dynamic buttons
    const cartItemsList = document.getElementById('cart-items-list');
    const wishlistItemsList = document.getElementById('wishlist-items-list');

    if (cartItemsList) {
        cartItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-cart-item-btn');
            const increaseBtn = e.target.closest('.increase-cart-item-qty-btn');
            const decreaseBtn = e.target.closest('.decrease-cart-item-qty-btn');

            if (removeBtn) {
                e.preventDefault();
                removeFromCart(removeBtn.dataset.id);
            }
            if (increaseBtn) {
                e.preventDefault();
                increaseCartItemQuantity(increaseBtn.dataset.id);
            }
            if (decreaseBtn) {
                e.preventDefault();
                decreaseCartItemQuantity(decreaseBtn.dataset.id);
            }
        });
    }

    if (wishlistItemsList) {
        wishlistItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-wishlist-item-btn');
            const moveToCartBtn = e.target.closest('.add-to-cart-from-wishlist-btn');

            if (removeBtn) {
                e.preventDefault();
                removeFromWishlist(removeBtn.dataset.id);
            }

            if (moveToCartBtn) {
                e.preventDefault();
                const productId = moveToCartBtn.dataset.id;
                const productToMove = wishlist.find(item => item.id === productId);

                if (productToMove) {
                    addItemToCart(productToMove);
                    removeFromWishlist(productId);
                }
            }
        });
    }

    // Clear All Buttons
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const clearWishlistBtn = document.getElementById('clear-wishlist-btn');

    const clearRecentlyViewedBtn = document.getElementById('clear-recently-viewed-btn');

    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (clearWishlistBtn) clearWishlistBtn.addEventListener('click', clearWishlist);
    if (clearRecentlyViewedBtn) clearRecentlyViewedBtn.addEventListener('click', clearRecentlyViewed);

    // --- Intersection Observer ---
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.fade').forEach(el => observer.observe(el));
    } else {
        document.querySelectorAll('.fade').forEach(el => el.classList.add('fade-in'));
    }

    // --- Back to Top ---
    if (backTopBtn) {
        backTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Carousel ---
    if (typeof initializeCollectionsCarousel === 'function') initializeCollectionsCarousel();
    if (typeof initializeLimitedCarousel === 'function') initializeLimitedCarousel();
    if (typeof initializeTestimonialsCarousel === 'function') initializeTestimonialsCarousel();

    // --- Initial Renders & Inits ---
    (async () => {
        if (typeof fetchAndRenderProducts === 'function') await fetchAndRenderProducts();
        if (typeof renderCart === 'function') renderCart();
        if (typeof renderWishlist === 'function') renderWishlist();
        if (typeof initializeCollectionNavigation === 'function') initializeCollectionNavigation();
        if (typeof renderRecentlyViewed === 'function') renderRecentlyViewed();
    })();

    // --- Background Music ---
    const music = document.getElementById('background-music');
    const musicToggleBtn = document.getElementById('music-toggle-btn');
    const musicOnIcon = document.getElementById('music-on-icon');
    const musicOffIcon = document.getElementById('music-off-icon');

    if (music && musicToggleBtn && musicOnIcon && musicOffIcon) {
        const playPromise = music.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                musicToggleBtn.classList.remove('hidden');
            }).catch(error => {
                const startMusicOnInteraction = () => {
                    music.play();
                    musicToggleBtn.classList.remove('hidden');
                    document.body.removeEventListener('click', startMusicOnInteraction);
                    document.body.removeEventListener('keydown', startMusicOnInteraction);
                };
                document.body.addEventListener('click', startMusicOnInteraction);
                document.body.addEventListener('keydown', startMusicOnInteraction);
            });
        }

        musicToggleBtn.addEventListener('click', () => {
            if (music.muted) {
                music.muted = false;
                musicOnIcon.classList.remove('hidden');
                musicOffIcon.classList.add('hidden');
            } else {
                music.muted = true;
                musicOnIcon.classList.add('hidden');
                musicOffIcon.classList.remove('hidden');
            }
        });
    }

    // --- Info Modal ---
    const openShippingBtn = document.getElementById('open-shipping-modal');
    const openSizingBtn = document.getElementById('open-sizing-modal');
    const closeInfoModalBtn = document.getElementById('close-info-modal');
    const infoModalBackdrop = document.getElementById('info-modal-backdrop');

    if (openShippingBtn) {
        openShippingBtn.addEventListener('click', () => openInfoModal('Shipping & Returns', './assets/shipping.html'));
    }
    if (openSizingBtn) {
        openSizingBtn.addEventListener('click', () => openInfoModal('Sizing Guide', './assets/sizing.html'));
    }
    if (closeInfoModalBtn) {
        closeInfoModalBtn.addEventListener('click', closeInfoModal);
    }
    if (infoModalBackdrop) {
        infoModalBackdrop.addEventListener('click', closeInfoModal);
    }

    // --- Recently Viewed ---
    const recentlyViewedGrid = document.getElementById('recently-viewed-grid');
    if (recentlyViewedGrid) {
        recentlyViewedGrid.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (!productCard) return;

            const product = getProductData(productCard);
            if (!product) return;

            if (e.target.closest('.quick-view-btn')) {
                e.preventDefault(); e.stopPropagation();
                openQuickView(product);
            } else if (e.target.closest('.add-to-cart-btn')) {
                e.preventDefault(); e.stopPropagation();
                addItemToCart(product);
            } else if (e.target.closest('.add-to-wishlist-btn')) {
                e.preventDefault(); e.stopPropagation();
                addItemToWishlist(product);
            }
        });
    }

});

// carousel logic
const initializeLimitedCarousel = () => {
    const carousel = document.getElementById('limited-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');
    const indicators = document.querySelectorAll('.carousel-indicator');
    let currentIndex = 0;
    const totalSlides = slides.length;

    if (totalSlides === 0) return;

    const showSlide = (index) => {
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;

        currentIndex = index;

        slides.forEach((slide, i) => {
            if (i === currentIndex) {
                slide.classList.add('carousel-active');
                slide.classList.remove('opacity-0', 'pointer-events-none');
            } else {
                slide.classList.remove('carousel-active');
                slide.classList.add('opacity-0', 'pointer-events-none');
            }
        });

        indicators.forEach((indicator, i) => {
            if (i === currentIndex) {
                indicator.classList.remove('bg-gray-300', 'hover:bg-gray-400');
                indicator.classList.add('bg-royal-black');
            } else {
                indicator.classList.add('bg-gray-300', 'hover:bg-gray-400');
                indicator.classList.remove('bg-royal-black');
            }
        });
    };

    if (prevBtn) prevBtn.addEventListener('click', () => showSlide(currentIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showSlide(currentIndex + 1));

    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => showSlide(index));
    });

    showSlide(0);

    let autoPlayInterval = setInterval(() => showSlide(currentIndex + 1), 5000);

    carousel.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    carousel.addEventListener('mouseleave', () => {
        clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => showSlide(currentIndex + 1), 5000);
    });
};

// info modal helpers
const openInfoModal = (title, htmlFile) => {
    const infoModal = document.getElementById('info-modal');
    const infoModalPanel = document.getElementById('info-modal-panel');
    const infoModalTitle = document.getElementById('info-modal-title');
    const infoModalContent = document.getElementById('info-modal-content');

    if (!infoModal || !infoModalPanel || !infoModalContent || !infoModalTitle) return;

    infoModalTitle.textContent = title;
    infoModalContent.innerHTML = '<div class="flex items-center justify-center py-12"><p class="text-gray-500">Loading...</p></div>';

    infoModal.classList.remove('hidden');
    setTimeout(() => {
        infoModalPanel.classList.remove('opacity-0', 'scale-95');
    }, 20);

    fetch(htmlFile)
        .then(res => {
            if (!res.ok) throw new Error('Failed to load content');
            return res.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const mainContent = doc.querySelector('main') || doc.querySelector('.container') || doc.querySelector('.size-guide') || doc.body;

            if (mainContent) {
                infoModalContent.innerHTML = mainContent.innerHTML;
            } else {
                infoModalContent.innerHTML = '<p class="text-gray-600">Content could not be loaded.</p>';
            }
        })
        .catch(err => {
            console.error('Error loading modal content:', err);
            infoModalContent.innerHTML = '<p class="text-gray-600">Failed to load content. Please try again.</p>';
        });
};

const closeInfoModal = () => {
    const infoModal = document.getElementById('info-modal');
    const infoModalPanel = document.getElementById('info-modal-panel');
    if (!infoModal || !infoModalPanel) return;

    infoModalPanel.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        infoModal.classList.add('hidden');
    }, 300);
};


const initializeTestimonialsCarousel = () => {
    const carousel = document.getElementById('testimonials-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.testimonial-slide');
    const prevBtn = document.getElementById('testimonials-prev-btn');
    const nextBtn = document.getElementById('testimonials-next-btn');
    const indicators = document.querySelectorAll('.testimonial-indicator');
    let currentIndex = 0;
    const totalSlides = slides.length;

    if (totalSlides === 0) return;

    const showSlide = (index) => {
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;

        currentIndex = index;

        slides.forEach((slide, i) => {
            if (i === currentIndex) {
                slide.classList.remove('opacity-0', 'pointer-events-none');
                slide.classList.add('z-10');
                slide.classList.remove('z-0');
            } else {
                slide.classList.add('opacity-0', 'pointer-events-none');
                slide.classList.remove('z-10');
                slide.classList.add('z-0');
            }
        });

        indicators.forEach((indicator, i) => {
            if (i === currentIndex) {
                indicator.classList.remove('bg-gray-300', 'hover:bg-gray-200');
                indicator.classList.add('bg-royal-black');
            } else {
                indicator.classList.add('bg-gray-300', 'hover:bg-gray-200');
                indicator.classList.remove('bg-royal-black');
            }
        });
    };

    if (prevBtn) prevBtn.addEventListener('click', () => showSlide(currentIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showSlide(currentIndex + 1));

    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => showSlide(index));
    });

    showSlide(0);

    let autoPlayInterval = setInterval(() => showSlide(currentIndex + 1), 6000);

    carousel.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    carousel.addEventListener('mouseleave', () => {
        clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => showSlide(currentIndex + 1), 6000);
    });
};

// Collections carousel logic
// Collections carousel logic
const initializeCollectionsCarousel = () => {
    const track = document.getElementById('collections-track');
    if (!track) return;

    const slides = track.querySelectorAll('.collection-slide');
    const prevBtn = document.getElementById('collections-prev-btn');
    const nextBtn = document.getElementById('collections-next-btn');
    const indicators = document.querySelectorAll('.collection-indicator');

    let currentIndex = 0;
    const totalSlides = slides.length;
    // On desktop, we show 2 slides, so max index is totalSlides - 2 if we don't loop endlessly or want "empty" space.
    // However, typical carousel behavior often allows going to the end.
    // Let's stick to simple: index 0 to totalSlides - 2

    if (totalSlides === 0) return;

    // Helper to check viewport
    const isDesktop = () => window.innerWidth >= 768; // Matching Tailwind 'md'

    const updateCarousel = (index) => {
        if (!isDesktop()) {
            // Mobile: Reset transform, let CSS scroll handle it.
            track.style.transform = 'translateX(0%)';
            return;
        }

        // Desktop Logic: Slide by 50% per index
        if (index < 0) index = 0; // Boundary check start

        // We show 2 items. So if we have 6 items: [0,1], [1,2], [2,3], [3,4], [4,5].
        // Max index should be 4 (totalSlides - 2).
        if (index > totalSlides - 2) index = totalSlides - 2;

        currentIndex = index;

        // Move track
        const translateX = -(currentIndex * 50); // 50% per slide
        track.style.transform = `translateX(${translateX}%)`;

        updateIndicators();
    };

    const updateIndicators = () => {
        indicators.forEach((indicator, i) => {
            // Simplify active state: if current index matches indicator
            if (i === currentIndex) {
                indicator.classList.remove('bg-gray-300', 'hover:bg-gray-400');
                indicator.classList.add('bg-royal-black');
            } else {
                indicator.classList.add('bg-gray-300', 'hover:bg-gray-400');
                indicator.classList.remove('bg-royal-black');
            }
        });
    };

    // Event Listeners
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            updateCarousel(currentIndex - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            updateCarousel(currentIndex + 1);
        });
    }

    // Indicator clicks
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            // Boundary check for indicators too
            if (isDesktop() && index > totalSlides - 2) {
                index = totalSlides - 2;
            }
            updateCarousel(index);
        });
    });

    // Auto-play logic (Optional, mostly for desktop usually)
    // User didn't strictly ask to remove it, but scrollable usually implies manual control.
    // Let's keep it simple: no auto-play for now as user asked for "scrollable" and specific click interactions.
    // The previous implementation had it, but sliding tracks with auto-play can be tricky with interactions.
    // I will exclude explicit auto-play to respect the "scrollable" request on mobile and manual click on desktop.

    // Handle resize to reset/adjust state
    window.addEventListener('resize', () => {
        updateCarousel(currentIndex);
    });

    // Initial state
    updateCarousel(0);
};
