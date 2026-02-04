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

            // Mock lifestyle image for hover effect
            const lifestyleImg = product.imageUrl.replace('.webp', '-lifestyle.webp');

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
                    <div class="absolute inset-x-0 top-2 flex justify-center z-20 pointer-events-none">
                        ${discountBadge}
                    </div>
                    
                    <!-- Main Image -->
                    <img src="${product.imageUrl}" 
                         alt="${product.name}" 
                         class="h-full w-full object-cover object-center transition-all duration-700 group-hover:scale-110 product-image"
                         loading="lazy" width="auto" height="auto"
                         onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');"
                         onerror="this.onerror=null;this.src='https://placehold.co/400x500/F7F5F2/1A1A1A?text=IMG';">

                    <button type="button" class="quick-view-btn absolute bottom-4 left-1/2 -translate-x-1/2 h-10 w-[80%] bg-white/90 backdrop-blur-md text-royal-black text-xs font-bold uppercase tracking-widest rounded-full shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 z-20 hover:bg-white" aria-label="Quick view for ${product.name}">
                        Quick View
                    </button>
                    
                    <button type="button" class="add-to-wishlist-btn absolute top-3 right-3 p-2.5 rounded-full bg-white/80 text-royal-black shadow-lg backdrop-blur-md opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 z-20 hover:bg-white" aria-label="Add to wishlist">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                    </button>
                    
                    <button type="button" class="add-to-cart-btn absolute top-3 left-3 p-2.5 rounded-full bg-royal-black text-white shadow-lg opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 z-20 hover:bg-gray-800" aria-label="Quick Add to Cart">
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


