// --- Product Component ---

// Module-local product cache — populated by fetchAndRenderProducts(),
// used by loadCompleteTheLook() so fallback never depends on main.js globals.
let _fetchedProducts = [];

// Fix #4: Validate data from DOM
const getProductData = (cardElement) => {
    if (!cardElement || !cardElement.dataset) {
        console.warn("Could not find product card element.");
        return null;
    }

    const product = {
        id: cardElement.dataset.id,
        name: cardElement.dataset.name,
        price: cardElement.dataset.price,
        imageUrl: cardElement.dataset.imageUrl,
        category: cardElement.dataset.category,
        description: cardElement.dataset.description,
    };

    // Validation
    if (!product.id || !product.name || !product.price || !product.imageUrl) {
        console.warn("Product card is missing required data-attributes.", cardElement);
        return null;
    }

    return product;
};

// New: Fetch and render "Complete the Look" recommendations
const loadCompleteTheLook = async (product) => {
    const container = document.getElementById('complete-look-container');
    const grid = document.getElementById('complete-look-grid');
    const loading = document.getElementById('complete-look-loading');

    if (!container || !grid || !loading) return;

    // Reset UI
    container.classList.remove('hidden');
    loading.classList.remove('hidden');
    grid.innerHTML = '';
    grid.classList.add('hidden');

    try {
        const res = await fetch('/api/complete-look', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product })
        });

        const fallbackRecommendations = () => {
            // Use module-local cache first, then try the global cache as a backup
            const pool = _fetchedProducts.length > 0
                ? _fetchedProducts
                : (typeof getFusionProducts === 'function' ? getFusionProducts() : []) || [];
            const filtered = pool.filter(p => p && p.id !== product.id);
            if (filtered.length === 0) return [];
            return filtered.slice().sort(() => Math.random() - 0.5).slice(0, 2);
        };

        if (!res.ok) {
            const fallback = fallbackRecommendations();
            if (fallback.length === 0) {
                container.classList.add('hidden');
                return;
            }
            const recommendations = fallback;
            loading.classList.add('hidden');
            grid.classList.remove('hidden');
            grid.innerHTML = recommendations.map(rec => {
                const originalPriceVal = rec.originalPrice ? parsePrice(rec.originalPrice) : 0;
                const currentPriceVal = parsePrice(rec.price);
                const hasDiscount = originalPriceVal > currentPriceVal;

                let priceDisplay = `<span class="text-sm font-medium text-royal-black">${rec.price}</span>`;
                if (hasDiscount) {
                    priceDisplay = `
                       <div class="flex flex-col items-start">
                           <span class="text-[10px] text-gray-500 line-through">${rec.originalPrice}</span>
                           <span class="text-sm font-medium text-royal-black">${rec.price}</span>
                       </div>
                   `;
                }

                return `
                <div class="complete-look-card cursor-pointer group flex items-center gap-3 bg-gray-50 p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                     data-id="${rec.id}">
                    <div class="w-16 h-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
                        <img src="${rec.imageUrl}" alt="${rec.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-serif font-bold text-royal-black truncate">${rec.name}</h4>
                        <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">${rec.collection}</p>
                        ${priceDisplay}
                    </div>
                    <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-royal-black">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </div>
                </div>
               `;
            }).join('');

            grid.querySelectorAll('.complete-look-card').forEach(card => {
                card.addEventListener('click', () => {
                    const recId = card.dataset.id;
                    const recProduct = recommendations.find(r => r.id === recId);
                    if (recProduct) {
                        openQuickView(recProduct);
                    }
                });
            });
            return;
        }

        const data = await res.json();
        // Empty arrays are truthy in JS, so check .length to trigger fallback properly
        const serverRecs = Array.isArray(data.recommendations) && data.recommendations.length > 0
            ? data.recommendations
            : null;
        const recommendations = serverRecs || fallbackRecommendations();

        loading.classList.add('hidden');

        if (recommendations.length === 0) {
            container.classList.add('hidden');
            return;
        }

        grid.classList.remove('hidden');
        grid.innerHTML = recommendations.map(rec => {
            // Calculate price display similar to main grid
            const originalPriceVal = rec.originalPrice ? parsePrice(rec.originalPrice) : 0;
            const currentPriceVal = parsePrice(rec.price);
            const hasDiscount = originalPriceVal > currentPriceVal;

            let priceDisplay = `<span class="text-sm font-medium text-royal-black">${rec.price}</span>`;
            if (hasDiscount) {
                priceDisplay = `
                   <div class="flex flex-col items-start">
                       <span class="text-[10px] text-gray-500 line-through">${rec.originalPrice}</span>
                       <span class="text-sm font-medium text-royal-black">${rec.price}</span>
                   </div>
               `;
            }

            return `
            <div class="complete-look-card cursor-pointer group flex items-center gap-3 bg-gray-50 p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                 data-id="${rec.id}">
                <div class="w-16 h-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
                    <img src="${rec.imageUrl}" alt="${rec.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-serif font-bold text-royal-black truncate">${rec.name}</h4>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">${rec.collection}</p>
                    ${priceDisplay}
                </div>
                <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-royal-black">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                </div>
            </div>
           `;
        }).join('');

        // Add click listeners to recommended items to open THEM in quick view
        grid.querySelectorAll('.complete-look-card').forEach(card => {
            card.addEventListener('click', () => {
                const recId = card.dataset.id;
                const recProduct = recommendations.find(r => r.id === recId);
                if (recProduct) {
                    openQuickView(recProduct);
                }
            });
        });

    } catch (err) {
        // Use module-local cache first, then try global as backup
        const pool = _fetchedProducts.length > 0
            ? _fetchedProducts
            : (typeof getFusionProducts === 'function' ? getFusionProducts() : []) || [];
        const fallback = pool.filter(p => p && p.id !== product.id);
        if (fallback.length === 0) {
            container.classList.add('hidden');
            return;
        }
        loading.classList.add('hidden');
        grid.classList.remove('hidden');
        grid.innerHTML = fallback.slice().sort(() => Math.random() - 0.5).slice(0, 2).map(rec => {
            const originalPriceVal = rec.originalPrice ? parsePrice(rec.originalPrice) : 0;
            const currentPriceVal = parsePrice(rec.price);
            const hasDiscount = originalPriceVal > currentPriceVal;

            let priceDisplay = `<span class="text-sm font-medium text-royal-black">${rec.price}</span>`;
            if (hasDiscount) {
                priceDisplay = `
                   <div class="flex flex-col items-start">
                       <span class="text-[10px] text-gray-500 line-through">${rec.originalPrice}</span>
                       <span class="text-sm font-medium text-royal-black">${rec.price}</span>
                   </div>
               `;
            }

            return `
            <div class="complete-look-card cursor-pointer group flex items-center gap-3 bg-gray-50 p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                 data-id="${rec.id}">
                <div class="w-16 h-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
                    <img src="${rec.imageUrl}" alt="${rec.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-serif font-bold text-royal-black truncate">${rec.name}</h4>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">${rec.collection}</p>
                    ${priceDisplay}
                </div>
                <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-royal-black">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                </div>
            </div>
           `;
        }).join('');
    }
};

// Quick View Modal Logic
const openQuickView = (product) => {
    if (!product || !quickViewModalCtl) return; // Guard

    currentQuickViewProduct = product;
    const quickViewImageUrl = product.imageUrl.replace('400x500', '800x1000');

    // Guarded element checks
    const imgEl = document.getElementById('quick-view-image');
    const nameEl = document.getElementById('quick-view-name');
    const priceEl = document.getElementById('quick-view-price');
    const descEl = document.getElementById('quick-view-description');

    if (imgEl) {
        imgEl.src = quickViewImageUrl;
        imgEl.alt = product.name;
        imgEl.onerror = function () {
            this.onerror = null;
            this.src = 'https://placehold.co/800x1000/F7F5F2/1A1A1A?text=Product+Not+Found';
        };
    }
    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = product.price;
    if (descEl) descEl.textContent = product.description;

    quickViewModalCtl.open(); // Manually open the modal

    // Track recently viewed
    if (typeof addToRecentlyViewed === 'function') addToRecentlyViewed(product);

    // Load AI Recommendations
    loadCompleteTheLook(product);
};

// Fetch products.json and render product cards into the grid
const fetchAndRenderProducts = async () => {
    const productGrid = document.getElementById('collection-product-grid');
    if (!productGrid) return;

    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to load products');
        const products = await res.json();

        // Store in module-local cache first (race-condition-proof)
        _fetchedProducts = Array.isArray(products) ? products : [];

        // Also populate the global cache for other consumers (cart recs, etc.)
        if (typeof setFusionProducts === 'function') setFusionProducts(products);

        // Build HTML for each product (keep structure & data-* attributes expected by existing JS)
        productGrid.innerHTML = products.map(product => {
            const originalPriceVal = product.originalPrice ? parsePrice(product.originalPrice) : 0;
            const currentPriceVal = parsePrice(product.price);
            const hasDiscount = originalPriceVal > currentPriceVal;

            let discountBadge = '';
            let priceDisplay = `<p class="text-lg font-medium text-royal-black product-price">${product.price}</p>`;

            if (hasDiscount) {
                const discountPercent = Math.round(((originalPriceVal - currentPriceVal) / originalPriceVal) * 100);
                // Badge: Visible on mobile (default), Hidden on Desktop unless hovered (using tailwind md: modifiers)
                discountBadge = `
                    <div class="bg-royal-black text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full 
                                opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                        ${discountPercent}% OFF
                    </div>
                `;

                priceDisplay = `
                    <div class="flex flex-col items-end">
                        <span class="text-xs text-gray-500 line-through">${product.originalPrice}</span>
                        <span class="text-lg font-medium text-royal-black product-price">${product.price}</span>
                    </div>
                `;
            }

            // Low Stock: Show "Only 4 left!!" on specific products (e.g. odd IDs) for visibility
            const showLowStock = parseInt(product.id.replace(/\D/g, '')) % 2 !== 0;
            const lowStockLabel = showLowStock ? `<p class="mt-1 text-xs text-red-600 font-bold animate-pulse">Only 4 left!!</p>` : '';

            return `
            <div class="group relative text-left product-card animate-fade-in"
                 data-collection="${product.collection}"
                 data-id="${product.id}"
                 data-name="${product.name}"
                 data-price="${product.price}"
                 data-original-price="${product.originalPrice || ''}"
                 data-image-url="${product.imageUrl}"
                 data-category="${product.category}"
                 data-description="${product.description}"
                 data-material="${product.categoryId?.material || ''}"
                 data-price-range="${product.categoryId?.priceRange || ''}"
                 data-features="${product.categoryId?.features || ''}">
                
                <div class="aspect-[4/5] w-full overflow-hidden rounded-lg bg-gray-200 relative skeleton shadow-sm group-hover:shadow-xl transition-all duration-500">
                    <div class="absolute right-2 md:inset-x-0 top-2 flex justify-end md:justify-center z-20 pointer-events-none">
                        ${discountBadge}
                    </div>
                    
                    <!-- Main Image -->
                    <img src="${product.imageUrl}" 
                         alt="${product.name}" 
                         class="h-full w-full object-cover object-center transition-all duration-700 group-hover:scale-110 product-image"
                         loading="lazy" width="auto" height="auto"
                         onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');"
                         onerror="this.onerror=null;this.src='https://placehold.co/400x500/F7F5F2/1A1A1A?text=IMG';">

                    <!-- Action Buttons: Hidden on Mobile, Hover-only on Desktop -->
                    <button type="button" class="quick-view-btn hidden md:flex items-center justify-center whitespace-nowrap absolute bottom-4 left-1/2 -translate-x-1/2 h-10 w-[85%] bg-white/90 backdrop-blur-md text-royal-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 z-20 hover:bg-white" aria-label="Quick view for ${product.name}">
                        Quick View
                    </button>
                    
                    <button type="button" class="add-to-wishlist-btn hidden md:flex absolute top-3 right-3 p-2.5 rounded-full bg-white/80 text-royal-black shadow-lg backdrop-blur-md opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 z-20 hover:bg-white" aria-label="Add to wishlist">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                    </button>
                    
                    <button type="button" class="add-to-cart-btn hidden md:flex absolute top-3 left-3 p-2.5 rounded-full bg-royal-black text-white shadow-lg opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 z-20 hover:bg-gray-800" aria-label="Quick Add to Cart">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                </div>
                
                <div class="mt-4 flex justify-between items-start">
                    <div class="flex flex-col">
                        <h3 class="text-base font-serif font-bold text-royal-black tracking-tight"><a href="#" class="product-name hover:text-gray-600 transition-colors line-clamp-1">${product.name}</a></h3>
                        <p class="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400 font-bold product-category">${product.category}</p>
                        ${lowStockLabel}
                    </div>
                    <div class="text-right flex-shrink-0 pl-2">
                        ${priceDisplay}
                    </div>
                </div>
            </div>
        `}).join('');
    } catch (err) {
        console.error('Error loading products:', err);
        productGrid.innerHTML = `<p class="col-span-full text-center text-gray-600 font-sans py-12">Unable to load products at the moment.</p>`;
    }
};
