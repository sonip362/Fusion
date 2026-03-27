// Search Page JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    const searchInput = document.getElementById('main-search-input');
    const searchPlaceholderRotator = document.getElementById('search-placeholder-rotator');
    const searchPlaceholderText = document.getElementById('search-placeholder-text');
    const searchRecommendations = document.getElementById('search-recommendations');
    const clearSearchBtn = document.getElementById('clear-search');
    const resultsGrid = document.getElementById('search-results-grid');
    const noResults = document.getElementById('no-results');
    const loadingSkeleton = document.getElementById('loading-skeleton');
    const resultsCount = document.getElementById('results-count');
    const featuredHeader = document.getElementById('featured-header');
    const clearResultsBtn = document.getElementById('clear-search-results');
    const suggestionTags = document.querySelectorAll('.suggestion-tag');

    // Quick View Modal Elements
    const quickViewImage = document.getElementById('quick-view-image');
    const quickViewName = document.getElementById('quick-view-name');
    const quickViewPrice = document.getElementById('quick-view-price');
    const quickViewDesc = document.getElementById('quick-view-description');
    const quickViewAddToCart = document.getElementById('quick-view-add-to-cart');
    const quickViewAddToWishlist = document.getElementById('quick-view-add-to-wishlist');

    let allProducts = [];
    let debounceTimer;
    let currentQuickViewProduct = null;
    let placeholderRotateTimer;
    let placeholderSwapTimer;
    const placeholderPhrases = [
        'Search for denim',
        'Search for kurtas',
        'Search for hoodies',
        'Search for jackets',
        'Search for cotton shirts'
    ];
    const placeholderTransitionMs = 350;
    const placeholderIntervalMs = 2300;
    const searchDebounceMs = 300;
    const minRecommendationQueryLength = 2;
    const maxRecommendations = 6;
    let placeholderIndex = 0;

    const updatePlaceholderVisibility = () => {
        if (!searchInput || !searchPlaceholderRotator) return;
        const shouldHide = searchInput.value.trim().length > 0;
        searchPlaceholderRotator.classList.toggle('is-hidden', shouldHide);
    };

    const rotatePlaceholderText = () => {
        if (!searchPlaceholderText || placeholderPhrases.length < 2) return;
        searchPlaceholderText.classList.add('is-exit');

        clearTimeout(placeholderSwapTimer);
        placeholderSwapTimer = setTimeout(() => {
            placeholderIndex = (placeholderIndex + 1) % placeholderPhrases.length;
            searchPlaceholderText.textContent = placeholderPhrases[placeholderIndex];
            searchPlaceholderText.classList.remove('is-exit');
            searchPlaceholderText.classList.add('is-enter');

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    searchPlaceholderText.classList.remove('is-enter');
                });
            });
        }, placeholderTransitionMs);
    };

    const startPlaceholderAnimation = () => {
        if (!searchPlaceholderText || placeholderPhrases.length === 0) return;
        searchPlaceholderText.textContent = placeholderPhrases[placeholderIndex];
        updatePlaceholderVisibility();

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || placeholderPhrases.length < 2) {
            return;
        }

        clearInterval(placeholderRotateTimer);
        placeholderRotateTimer = setInterval(rotatePlaceholderText, placeholderIntervalMs);
    };

    const hideRecommendations = () => {
        if (!searchRecommendations) return;
        searchRecommendations.classList.add('hidden');
        searchRecommendations.innerHTML = '';
    };

    const escapeHtml = (value) => {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    };

    const getRecommendations = (query) => {
        const normalized = query.trim().toLowerCase();
        if (normalized.length < minRecommendationQueryLength) return [];

        const unique = new Set();
        const startsWithMatches = [];
        const includesMatches = [];

        allProducts.forEach((product) => {
            if (!product || !product.name) return;

            const name = String(product.name).trim();
            if (!name) return;

            const nameLower = name.toLowerCase();
            const key = nameLower;
            if (unique.has(key)) return;

            const category = product.category ? String(product.category) : 'Product';

            if (nameLower.startsWith(normalized)) {
                unique.add(key);
                startsWithMatches.push({ name, category });
                return;
            }

            if (nameLower.includes(normalized)) {
                unique.add(key);
                includesMatches.push({ name, category });
            }
        });

        return startsWithMatches.concat(includesMatches).slice(0, maxRecommendations);
    };

    const renderRecommendations = (query) => {
        if (!searchRecommendations) return;

        const recommendations = getRecommendations(query);
        if (recommendations.length === 0) {
            hideRecommendations();
            return;
        }

        searchRecommendations.innerHTML = recommendations.map((item) => {
            const safeName = escapeHtml(item.name);
            const safeCategory = escapeHtml(item.category);
            return `
                <button type="button" class="search-recommendation-item" data-query="${safeName}">
                    <span class="search-recommendation-name">${safeName}</span>
                    <span class="search-recommendation-meta">${safeCategory}</span>
                </button>
            `;
        }).join('');

        searchRecommendations.classList.remove('hidden');

        const recommendationButtons = searchRecommendations.querySelectorAll('.search-recommendation-item');
        recommendationButtons.forEach((button) => {
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            button.addEventListener('click', () => {
                const selectedQuery = button.dataset.query || '';
                searchInput.value = selectedQuery;
                performSearch(selectedQuery);
                updatePlaceholderVisibility();
                hideRecommendations();
            });
        });
    };

    // Fetch products from JSON
    const fetchProducts = async () => {
        try {
            showLoading(true);
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            allProducts = await response.json();
            if (typeof setFusionProducts === 'function') {
                setFusionProducts(allProducts);
            }
            showLoading(false);
            return allProducts;
        } catch (error) {
            console.error('Error fetching products:', error);
            showLoading(false);
            return [];
        }
    };

    // Show/Hide loading skeleton
    const showLoading = (show) => {
        if (show) {
            loadingSkeleton.classList.remove('hidden');
            resultsGrid.classList.add('hidden');
        } else {
            loadingSkeleton.classList.add('hidden');
            resultsGrid.classList.remove('hidden');
        }
    };

    // Open Quick View Modal
    const openQuickView = (product) => {
        if (!product) return;
        currentQuickViewProduct = product;

        // Populate details
        if (quickViewImage) quickViewImage.src = product.imageUrl.replace('./', '../');
        if (quickViewName) quickViewName.textContent = product.name;
        if (quickViewPrice) quickViewPrice.textContent = product.price;
        if (quickViewDesc) quickViewDesc.textContent = product.description || "No description available.";

        if (typeof renderQuickViewBundle === 'function') {
            renderQuickViewBundle(product);
        }

        // Open modal using global controller if available
        if (typeof quickViewModalCtl !== 'undefined') {
            quickViewModalCtl.open();
        } else {
            // Fallback
            const modal = document.getElementById('quick-view-modal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex'); // Ensure flex display
            }
        }
    };

    // Render products to grid
    const renderProducts = (products, isSearch = false) => {
        resultsGrid.innerHTML = '';

        if (products.length === 0 && isSearch) {
            noResults.classList.remove('hidden');
            resultsGrid.classList.add('hidden');
            resultsCount.classList.add('hidden');
            featuredHeader.classList.add('hidden');
            return;
        }

        noResults.classList.add('hidden');
        resultsGrid.classList.remove('hidden');

        if (isSearch) {
            resultsCount.innerHTML = `Showing <strong>${products.length}</strong> result${products.length !== 1 ? 's' : ''}`;
            resultsCount.classList.remove('hidden');
            featuredHeader.classList.add('hidden');
        } else {
            resultsCount.classList.add('hidden');
            featuredHeader.classList.remove('hidden');
        }

        products.forEach((product, index) => {
            const card = createProductCard(product, index);
            resultsGrid.appendChild(card);
        });
    };

    // Create product card element
    const createProductCard = (product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card-search';
        card.style.animationDelay = `${index * 0.05}s`;
        card.setAttribute('data-product-id', product.id);

        // Calculate discount percentage if there's an original price
        let discountBadge = '';
        if (product.originalPrice) {
            const currentPrice = parseFloat(product.price.replace(/[^0-9.]/g, ''));
            const originalPrice = parseFloat(product.originalPrice.replace(/[^0-9.]/g, ''));
            const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
            if (discount > 0) {
                discountBadge = `
                    <div class="bg-royal-black text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full 
                                opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                        ${discount}% OFF
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div class="product-image-wrapper relative">
                <div class="absolute right-2 md:inset-x-0 top-2 flex justify-end md:justify-center z-20 pointer-events-none">
                    ${discountBadge}
                </div>
                <img src="${product.imageUrl.replace('./', '../')}" alt="${product.name}" class="product-image" loading="lazy">
                <div class="quick-actions">
                    <button class="quick-action-btn quick-view-btn" aria-label="Quick View" title="Quick View">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </button>
                    <button class="quick-action-btn add-cart-btn" aria-label="Add to Cart" title="Add to Cart">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
                        </svg>
                    </button>
                    <button class="quick-action-btn add-wishlist-btn" aria-label="Add to Wishlist" title="Add to Wishlist">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <p class="product-category">${product.category}</p>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price-wrapper">
                    <span class="product-price">${product.price}</span>
                    ${product.originalPrice ? `<span class="product-original-price">${product.originalPrice}</span>` : ''}
                </div>
            </div>
        `;

        // Card click - navigate to collection
        card.addEventListener('click', (e) => {
            if (e.target.closest('.quick-action-btn')) return;
            // Open Quick View Modal
            openQuickView(product);
        });

        // Add to Cart
        const addToCartBtn = card.querySelector('.add-cart-btn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof addItemToCart === 'function') {
                    addItemToCart(product);
                } else {
                    console.error('addItemToCart not found');
                }
            });
        }

        // Add to Wishlist
        const addToWishlistBtn = card.querySelector('.add-wishlist-btn');
        if (addToWishlistBtn) {
            addToWishlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof addItemToWishlist === 'function') {
                    addItemToWishlist(product);
                }
            });
        }

        // Quick View
        const quickViewBtn = card.querySelector('.quick-view-btn');
        if (quickViewBtn) {
            quickViewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openQuickView(product);
            });
        }

        return card;
    };

    // Quick View Modal Button Listeners
    if (quickViewAddToCart) {
        quickViewAddToCart.addEventListener('click', () => {
            if (currentQuickViewProduct && typeof addItemToCart === 'function') {
                addItemToCart(currentQuickViewProduct);
                // Close modal
                if (typeof quickViewModalCtl !== 'undefined') {
                    quickViewModalCtl.close();
                }
            }
        });
    }

    if (quickViewAddToWishlist) {
        quickViewAddToWishlist.addEventListener('click', () => {
            if (currentQuickViewProduct && typeof addItemToWishlist === 'function') {
                addItemToWishlist(currentQuickViewProduct);
            }
        });
    }

    // Search function with debounce
    const performSearch = (query) => {
        query = query.trim().toLowerCase();

        if (query.length === 0) {
            renderProducts(allProducts, false);
            clearSearchBtn.classList.remove('visible');
            hideRecommendations();
            return;
        }

        clearSearchBtn.classList.add('visible');

        const results = allProducts.filter(product => {
            const searchableText = [
                product.name,
                product.category,
                product.description,
                product.collection
            ].join(' ').toLowerCase();

            return searchableText.includes(query);
        });

        renderProducts(results, true);
    };

    // Debounced search
    const debouncedSearch = (query) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            performSearch(query);
            renderRecommendations(query);
        }, searchDebounceMs);
    };

    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
            updatePlaceholderVisibility();
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= minRecommendationQueryLength) {
                renderRecommendations(searchInput.value);
            }
        });

        // Check for query parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('q');
        if (queryParam) {
            searchInput.value = queryParam;
            updatePlaceholderVisibility();
            // Wait for products to load, then search
            await fetchProducts();
            performSearch(queryParam);
            renderRecommendations(queryParam);
        } else {
            // Load and display all products as featured
            await fetchProducts();
            renderProducts(allProducts, false);
        }
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            clearSearchBtn.classList.remove('visible');
            renderProducts(allProducts, false);
            updatePlaceholderVisibility();
            hideRecommendations();
        });
    }

    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            clearSearchBtn.classList.remove('visible');
            renderProducts(allProducts, false);
            updatePlaceholderVisibility();
            hideRecommendations();
        });
    }

    // Suggestion tags
    suggestionTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            searchInput.value = query;
            performSearch(query);
            updatePlaceholderVisibility();
            renderRecommendations(query);
        });
    });

    document.addEventListener('click', (e) => {
        if (!searchRecommendations || !searchInput) return;
        if (searchInput.contains(e.target) || searchRecommendations.contains(e.target)) return;
        hideRecommendations();
    });

    // Initial load if no query param (already handled above)
    // Redundant check removed to avoid double fetch

    startPlaceholderAnimation();

    // Initialize state visuals
    if (typeof updateBadges === 'function') updateBadges();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderWishlist === 'function') renderWishlist();
});

