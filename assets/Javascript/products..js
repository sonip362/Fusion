// --- Product Component ---

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

let currentQuickViewProduct = null;

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
};

// New: fetch products.json and render product cards into the grid
const fetchAndRenderProducts = async () => {
    const productGrid = document.getElementById('collection-product-grid');
    if (!productGrid) return;

    try {
        const res = await fetch('./assets/products.json', { cache: "no-store" });
        if (!res.ok) throw new Error('Failed to load products.json');
        const products = await res.json();

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
                    <div class="absolute top-2 left-2 bg-royal-black text-white text-xs font-bold px-2 py-1 rounded z-20 
                                opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        ${discountPercent}% discount
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
            <div class="group relative text-left product-card"
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
                
                <div class="aspect-[4/5] w-full overflow-hidden rounded-lg bg-gray-200 relative skeleton">
                    ${discountBadge}
                <img src="${product.imageUrl}" 
                     alt="${product.name}" 
                     class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 product-image"
                     loading="lazy" width="auto" height="auto"
                     onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');"
                     onerror="this.onerror=null;this.src='https://placehold.co/400x500/F7F5F2/1A1A1A?text=IMG'; this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');">
                    <button type="button" class="quick-view-btn absolute inset-0 m-auto h-12 w-32 bg-ivory/90 text-royal-black font-semibold rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" aria-label="Quick view for ${product.name}">
                        Quick View
                    </button>
                    <button type="button" class="add-to-wishlist-btn absolute top-3 right-3 p-3 rounded-full bg-ivory/90 text-royal-black shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 hover:bg-ivory" aria-label="Add to wishlist">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                    </button>
                </div>
                <div class="mt-4 flex justify-between items-start">
                    <div class="min-h-[3.5rem] flex flex-col">
                        <h3 class="text-lg font-serif text-royal-black"><a href="#" class="product-name hover:underline">${product.name}</a></h3>
                        <p class="mt-1 text-sm text-gray-600 product-category">${product.category}</p>
                        ${lowStockLabel}
                    </div>
                    <div class="text-right flex-shrink-0 pl-2">
                        ${priceDisplay}
                        <button type="button" class="add-to-cart-btn text-sm font-semibold text-gray-700 hover:text-royal-black transition-colors flex items-center justify-end mt-1" aria-label="Add ${product.name} to cart">
                            Add<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 ml-1 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        `}).join('');
    } catch (err) {
        console.error('Error loading products:', err);
        productGrid.innerHTML = `<p class="col-span-full text-center text-gray-600 font-sans py-12">Unable to load products at the moment.</p>`;
    }
};


