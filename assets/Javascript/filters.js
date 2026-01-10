// --- Collection Navigation & Filtering Logic ---
const initializeCollectionNavigation = () => {
    const collectionCards = document.querySelectorAll('.collection-card');
    const productGrid = document.getElementById('collection-product-grid');
    const productCards = productGrid ? productGrid.querySelectorAll('.product-card') : [];
    const productCardsArray = Array.from(productCards); // For stable default sort
    const collectionCardGrid = document.getElementById('collection-card-grid');
    const backButton = document.getElementById('back-to-collections-btn');
    const collectionTitle = document.getElementById('collection-title');
    const productViewControls = document.getElementById('product-view-controls');
    const searchInput = document.getElementById('product-search-input');

    // Selects (now hidden)
    const sortSelect = document.getElementById('product-sort-select');
    const filterMaterial = document.getElementById('filter-material');
    const filterPriceRange = document.getElementById('filter-price-range');
    const filterFeatures = document.getElementById('filter-features');

    // Modal Buttons
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const openSortBtn = document.getElementById('open-sort-btn');
    const filterCountBadge = document.getElementById('filter-count-badge');
    const currentSortLabel = document.getElementById('current-sort-label');

    let currentCollectionFilter = '';

    // Guard against missing elements
    if (!productGrid || !collectionCardGrid || !backButton || !collectionTitle || collectionCards.length === 0 || !productViewControls || !searchInput || !sortSelect || !filterMaterial || !filterPriceRange || !filterFeatures) {
        console.warn("Collection navigation, search, sort or filter elements are missing.");
        return;
    }

    // --- Modal Initialization ---
    const filterModalCtl = typeof initializeModal === 'function' ? initializeModal({
        modal: document.getElementById('filter-modal'),
        panel: document.getElementById('filter-panel'),
        openBtns: [openFiltersBtn],
        closeBtn: document.getElementById('close-filter-modal'),
        backdrop: document.getElementById('filter-backdrop')
    }) : null;

    const sortModalCtl = typeof initializeModal === 'function' ? initializeModal({
        modal: document.getElementById('sort-modal'),
        panel: document.getElementById('sort-panel'),
        openBtns: [openSortBtn],
        closeBtn: document.getElementById('close-sort-modal'),
        backdrop: document.getElementById('sort-backdrop')
    }) : null;

    // --- Filter Modal Logic ---
    const setupOptionButtons = (containerId, selectEl) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Update UI
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update Select
            selectEl.value = btn.dataset.value;

            // Note: We don't update view immediately for filters, we wait for "Apply"
        });
    };

    setupOptionButtons('filter-options-material', filterMaterial);
    setupOptionButtons('filter-options-price', filterPriceRange);
    setupOptionButtons('filter-options-features', filterFeatures);

    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            updateProductView();
            if (filterModalCtl) filterModalCtl.close();
        });
    }

    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            [filterMaterial, filterPriceRange, filterFeatures].forEach(sel => sel.value = 'all');

            // Reset UI
            ['filter-options-material', 'filter-options-price', 'filter-options-features'].forEach(id => {
                const cont = document.getElementById(id);
                if (cont) {
                    cont.querySelectorAll('button').forEach(b => {
                        if (b.dataset.value === 'all') b.classList.add('active');
                        else b.classList.remove('active');
                    });
                }
            });

            updateProductView();
        });
    }

    // --- Sort Modal Logic ---
    const sortOptionsList = document.getElementById('sort-options-list');
    if (sortOptionsList) {
        sortOptionsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Update UI
            sortOptionsList.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update Select
            sortSelect.value = btn.dataset.value;

            // Update Label
            if (currentSortLabel) {
                currentSortLabel.textContent = btn.textContent.trim();
            }

            // Update View & Close
            updateProductView();
            setTimeout(() => {
                if (sortModalCtl) sortModalCtl.close();
            }, 200);
        });
    }

    // Function to filter, search, and sort products
    const updateProductView = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const sortValue = sortSelect.value;
        const materialFilter = filterMaterial.value;
        const priceRangeFilter = filterPriceRange.value;
        const featuresFilter = filterFeatures.value;

        // Step 1: Filter products by collection, search term, and category filters
        const visibleProducts = productCardsArray.filter(card => {
            const isVisibleByCollection = card.dataset.collection === currentCollectionFilter;
            if (!isVisibleByCollection) return false;

            // Category filters
            if (materialFilter !== 'all' && card.dataset.material !== materialFilter) return false;
            if (priceRangeFilter !== 'all' && card.dataset.priceRange !== priceRangeFilter) return false;
            if (featuresFilter !== 'all' && card.dataset.features !== featuresFilter) return false;

            // Search term
            if (searchTerm === '') return true;

            const productName = (card.dataset.name || '').toLowerCase();
            const productCategory = (card.dataset.category || '').toLowerCase();
            return productName.includes(searchTerm) || productCategory.includes(searchTerm);
        });

        // Step 2: Sort the filtered products
        visibleProducts.sort((a, b) => {
            if (sortValue === 'default') {
                return productCardsArray.indexOf(a) - productCardsArray.indexOf(b);
            }

            const nameA = (a.dataset.name || '').toLowerCase();
            const nameB = (b.dataset.name || '').toLowerCase();
            const priceA = parsePrice(a.dataset.price || '0');
            const priceB = parsePrice(b.dataset.price || '0');

            switch (sortValue) {
                case 'name-asc':
                    return nameA.localeCompare(nameB);
                case 'name-desc':
                    return nameB.localeCompare(nameA);
                case 'price-asc':
                    return priceA - priceB;
                case 'price-desc':
                    return priceB - priceA;
                default:
                    return 0;
            }
        });

        // Step 3: Update the DOM
        productGrid.innerHTML = ''; // Clear the grid
        if (visibleProducts.length > 0) {
            visibleProducts.forEach(card => {
                productGrid.appendChild(card);
            });
        } else {
            productGrid.innerHTML = `<p class="col-span-full text-center text-gray-600 font-sans py-12">No products found matching your criteria.</p>`;
        }
        updateActiveFiltersDisplay();
        updateFilterBadges();
    };

    const activeFiltersContainer = document.getElementById('active-filters-container');

    const updateActiveFiltersDisplay = () => {
        if (!activeFiltersContainer) return;

        const materialVal = filterMaterial.value;
        const priceVal = filterPriceRange.value;
        const featuresVal = filterFeatures.value;

        activeFiltersContainer.innerHTML = '';

        const filters = [
            { id: 'material', label: filterMaterial.options[filterMaterial.selectedIndex].text, value: materialVal, element: filterMaterial, containerId: 'filter-options-material' },
            { id: 'price', label: filterPriceRange.options[filterPriceRange.selectedIndex].text, value: priceVal, element: filterPriceRange, containerId: 'filter-options-price' },
            { id: 'features', label: filterFeatures.options[filterFeatures.selectedIndex].text, value: featuresVal, element: filterFeatures, containerId: 'filter-options-features' }
        ];

        const activeFilters = filters.filter(f => f.value !== 'all');

        if (activeFilters.length > 0) {
            activeFiltersContainer.classList.remove('hidden');
            activeFilters.forEach(filter => {
                const pill = document.createElement('div');
                pill.className = 'inline-flex items-center bg-royal-black text-ivory text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full animate-fade-in shadow-sm';
                pill.innerHTML = `
                    <span>${filter.label}</span>
                    <button type="button" class="ml-2 text-ivory/60 hover:text-ivory focus:outline-none" aria-label="Remove ${filter.label} filter">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;

                pill.querySelector('button').addEventListener('click', () => {
                    filter.element.value = 'all';

                    // Sync Modal UI
                    const modalCont = document.getElementById(filter.containerId);
                    if (modalCont) {
                        modalCont.querySelectorAll('button').forEach(b => {
                            if (b.dataset.value === 'all') b.classList.add('active');
                            else b.classList.remove('active');
                        });
                    }

                    updateProductView();
                });

                activeFiltersContainer.appendChild(pill);
            });
        } else {
            activeFiltersContainer.classList.add('hidden');
        }
    };

    const updateFilterBadges = () => {
        let count = 0;
        if (filterMaterial.value !== 'all') count++;
        if (filterPriceRange.value !== 'all') count++;
        if (filterFeatures.value !== 'all') count++;

        if (filterCountBadge) {
            if (count > 0) {
                filterCountBadge.textContent = count;
                filterCountBadge.classList.remove('hidden');
            } else {
                filterCountBadge.classList.add('hidden');
            }
        }
    };


    // Add click listener to each collection card
    collectionCards.forEach(card => {
        card.addEventListener('click', () => {
            currentCollectionFilter = card.dataset.collectionFilter;

            // Update the view
            updateProductView();

            // Hide collection cards & title
            collectionCardGrid.classList.add('hidden');
            collectionTitle.classList.add('hidden');

            // Show product grid and controls
            productGrid.classList.remove('hidden');
            productViewControls.classList.remove('hidden');
        });
    });

    // Add click listener to the back button
    backButton.addEventListener('click', () => {
        // Hide product grid and controls
        productGrid.classList.add('hidden');
        productViewControls.classList.add('hidden');
        if (activeFiltersContainer) activeFiltersContainer.classList.add('hidden');

        // Show collection cards & title
        collectionCardGrid.classList.remove('hidden');
        collectionTitle.classList.remove('hidden');

        // We DO NOT reset the filter/sort values here so they persist across collections
        currentCollectionFilter = '';
    });

    // Add listeners to controls
    searchInput.addEventListener('input', updateProductView);

    // Reset Filters Button Logic
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            sortSelect.value = 'default';
            filterMaterial.value = 'all';
            filterPriceRange.value = 'all';
            filterFeatures.value = 'all';

            // Reset UI
            if (currentSortLabel) currentSortLabel.textContent = 'Default';
            ['filter-options-material', 'filter-options-price', 'filter-options-features'].forEach(id => {
                const cont = document.getElementById(id);
                if (cont) {
                    cont.querySelectorAll('button').forEach(b => {
                        if (b.dataset.value === 'all') b.classList.add('active');
                        else b.classList.remove('active');
                    });
                }
            });

            updateProductView();
        });
    }
};
