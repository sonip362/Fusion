// --- Recently Viewed Component (MongoDB Integrated) ---

// Add to recently viewed
const addToRecentlyViewed = (product) => {
    if (!product || !product.id) return;

    // Check if we already have it in state
    const existingIndex = recentlyViewed.findIndex(item => item.id === product.id);
    
    if (existingIndex !== -1) {
        // Remove old entry to bump to top
        recentlyViewed.splice(existingIndex, 1);
    }

    // Add full product object to the front
    recentlyViewed.unshift({
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        collectionName: product.collectionName || product.collection || 'Collection'
    });

    // Limit to 4 items
    if (recentlyViewed.length > 4) {
        recentlyViewed = recentlyViewed.slice(0, 4);
    }

    // saveState is in main.js and syncs to MongoDB
    if (typeof saveState === 'function') saveState();
    renderRecentlyViewed();
};

// Render recently viewed
const renderRecentlyViewed = () => {
    const section = document.getElementById('recently-viewed');
    const grid = document.getElementById('recently-viewed-grid');
    const placeholder = document.getElementById('recently-viewed-placeholder');
    const clearBtn = document.getElementById('clear-recently-viewed-btn');

    if (!section || !grid) return;

    if (!recentlyViewed || recentlyViewed.length === 0) {
        grid.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }

    // Since we store full objects now, we don't need to fetch
    section.classList.remove('hidden');
    grid.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');

    grid.innerHTML = recentlyViewed.map(product => {
        const originalPriceVal = product.originalPrice ? parsePrice(product.originalPrice) : 0;
        const currentPriceVal = parsePrice(product.price);
        const hasDiscount = originalPriceVal > currentPriceVal;

        let discountBadge = '';
        let priceDisplay = `<p class="text-lg font-medium text-royal-black product-price">${product.price}</p>`;

        if (hasDiscount) {
            const discountPercent = Math.round(((originalPriceVal - currentPriceVal) / originalPriceVal) * 100);
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

        return `
        <div class="group relative text-left product-card animate-fade-in"
             data-id="${product.id}"
             data-name="${product.name}"
             data-price="${product.price}"
             data-image-url="${product.imageUrl}"
             data-category="${product.category}">
            
            <div class="aspect-[4/5] w-full overflow-hidden rounded-lg bg-gray-200 relative">
                <div class="absolute right-2 md:inset-x-0 top-2 flex justify-end md:justify-center z-20 pointer-events-none">
                    ${discountBadge}
                </div>
                <img src="${product.imageUrl}" 
                     alt="${product.name}" 
                     class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 product-image loaded"
                     loading="lazy"
                     onerror="this.onerror=null;this.src='https://placehold.co/400x500/F7F5F2/1A1A1A?text=IMG';">
                <button type="button" class="quick-view-btn absolute inset-0 m-auto h-12 w-32 bg-ivory/90 text-royal-black font-semibold rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" aria-label="Quick view for ${product.name}">
                    Quick View
                </button>
            </div>
            <div class="mt-4 flex justify-between items-start">
                <div class="min-h-[3.5rem] flex flex-col">
                    <h3 class="text-lg font-serif text-royal-black"><a href="#" class="product-name hover:underline">${product.name}</a></h3>
                    <p class="mt-1 text-sm text-gray-600 product-category">${product.category}</p>
                </div>
                <div class="text-right flex-shrink-0 pl-2">
                    ${priceDisplay}
                </div>
            </div>
        </div>
    `}).join('');
};

// Clear all recently viewed
const clearRecentlyViewed = () => {
    // Check if recentlyViewed is defined in main.js
    if (typeof recentlyViewed !== 'undefined') {
        recentlyViewed = [];
        if (typeof saveState === 'function') saveState();
        renderRecentlyViewed();
        if (typeof showToast === 'function') showToast('Recently viewed cleared', 'success');
    }
};

// Initial render call if state is already loaded
document.addEventListener('DOMContentLoaded', () => {
    // renderRecentlyViewed will also be called by main.js loadState
    renderRecentlyViewed();

    const clearBtn = document.getElementById('clear-recently-viewed-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearRecentlyViewed);
    }
});
