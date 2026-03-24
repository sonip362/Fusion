// --- Cart Operations ---

// Preload coupon tiers into a global cache so cart UI can show unlocked coupons
(function preloadCouponTiers() {
    try {
        const isSubPage = window.location.pathname.includes('/pages/');
        const url = isSubPage ? '../assets/data/coupons.json' : './assets/data/coupons.json';
        fetch(url, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error('Failed to load coupons.json'); return r.json(); })
            .then(json => { if (Array.isArray(json)) window.__cachedCouponTiers = json; })
            .catch(err => { console.warn('preloadCouponTiers:', err); });
    } catch (e) { console.warn('preloadCouponTiers error', e); }
})();


// --- Cart Recommendations (You May Also Like) ---
const renderCartRecommendations = async () => {
    const recContainer = document.getElementById('cart-recommendations');
    const recGrid = document.getElementById('cart-rec-grid');
    const recLabel = document.getElementById('cart-rec-label');
    if (!recContainer || !recGrid) return;

    if (cart.length === 0) {
        recContainer.classList.add('hidden');
        recGrid.innerHTML = '';
        return;
    }

    // Determine gender from cart items
    let hasMen = false;
    let hasWomen = false;
    cart.forEach(item => {
        const cat = (item.category || '').toLowerCase();
        if (cat.includes('men') && !cat.includes('women')) hasMen = true;
        if (cat.includes('women')) hasWomen = true;
        if (cat.includes('both')) { hasMen = true; hasWomen = true; }
    });

    let genderFilter = 'both'; // show both
    let labelText = 'For Everyone';
    if (hasMen && !hasWomen) { genderFilter = 'men'; labelText = 'For Him'; }
    else if (hasWomen && !hasMen) { genderFilter = 'women'; labelText = 'For Her'; }

    if (recLabel) recLabel.textContent = labelText;

    try {
        const isSubPage = window.location.pathname.includes('/pages/');
        const response = await fetch('/api/products', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load products');
        const allProducts = await response.json();

        const cartIds = new Set(cart.map(i => i.id));

        // Filter by gender
        const candidates = allProducts.filter(p => {
            if (cartIds.has(p.id)) return false; // already in cart
            const cat = (p.category || '').toLowerCase();
            if (genderFilter === 'men') {
                return cat.includes('men') || cat.includes('both');
            } else if (genderFilter === 'women') {
                return cat.includes('women') || cat.includes('both');
            }
            return true; // both — show all
        });

        // Pick up to 3
        const picks = candidates.slice(0, 6);

        if (picks.length === 0) {
            recContainer.classList.add('hidden');
            return;
        }

        recContainer.classList.remove('hidden');

        const resolveImg = (url) => {
            if (!url) return '';
            return window.location.pathname.includes('/pages/')
                ? url.replace('./', '../')
                : url;
        };

        recGrid.innerHTML = picks.map(p => `
            <div class="group relative flex flex-col bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all duration-300">
                <div class="aspect-[3/4] overflow-hidden bg-gray-200">
                    <img src="${resolveImg(p.imageUrl)}" alt="${p.name}"
                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                         onerror="this.onerror=null;this.src='https://placehold.co/300x400/F7F5F2/1A1A1A?text=IMG';">
                </div>
                <div class="p-2 flex flex-col gap-1.5">
                    <div>
                        <p class="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">${p.category}</p>
                        <h4 class="text-xs font-serif font-bold text-royal-black leading-tight line-clamp-1">${p.name}</h4>
                        <p class="text-[10px] text-gray-600 mt-0.5">${p.price}</p>
                    </div>
                    <button type="button"
                        class="cart-rec-add-btn w-full py-2 rounded-full bg-royal-black text-ivory text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors mt-auto"
                        data-rec-id="${p.id}"
                        data-rec-name="${p.name}"
                        data-rec-price="${p.price}"
                        data-rec-image="${resolveImg(p.imageUrl)}"
                        data-rec-category="${p.category}"
                        data-rec-description="${p.description || ''}">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');

        // Attach add-to-cart listeners
        recGrid.querySelectorAll('.cart-rec-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const product = {
                    id: btn.dataset.recId,
                    name: btn.dataset.recName,
                    price: btn.dataset.recPrice,
                    imageUrl: btn.dataset.recImage,
                    category: btn.dataset.recCategory,
                    description: btn.dataset.recDescription,
                };
                addItemToCart(product);
                // Re-render recommendations after adding
                renderCartRecommendations();
            });
        });

    } catch (err) {
        console.error('Cart recommendations error:', err);
        recContainer.classList.add('hidden');
    }
};



const addItemToCart = (product) => {
    if (!product) return; // Guard
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    saveState();
    renderCart();
    showToast(`${product.name} added to cart`, 'success');
};

const removeFromCart = (productId) => {
    cart = cart.filter(item => item.id !== productId);
    saveState();
    renderCart();
};

const increaseCartItemQuantity = (productId) => {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity++;
        saveState();
        renderCart();
    }
};

const decreaseCartItemQuantity = (productId) => {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity--;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveState();
            renderCart();
        }
    }
};

const clearCart = () => {
    if (cart.length === 0) return;
    const overlay = document.getElementById('cart-confirm-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.remove('opacity-0', 'scale-95'), 20);
};

const closeCartConfirm = () => {
    const overlay = document.getElementById('cart-confirm-overlay');
    if (!overlay) return;
    overlay.classList.add('opacity-0', 'scale-95');
    setTimeout(() => overlay.classList.add('hidden'), 300);
};

const renderCart = () => {
    const cartEmptyState = document.getElementById('cart-empty-state');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartFooter = document.getElementById('cart-footer');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const clearCartBtn = document.getElementById('clear-cart-btn');

    if (!cartEmptyState || !cartItemsList || !cartFooter || !cartSubtotal) return;

    if (cart.length === 0) {
        cartEmptyState.classList.remove('hidden');
        cartItemsList.classList.add('hidden');
        cartItemsList.innerHTML = '';
        cartFooter.classList.add('hidden');
        if (clearCartBtn) clearCartBtn.classList.add('hidden');

        // Hide reward tracker when cart is empty
        const rewardTrackerContainer = document.getElementById('reward-tracker-container');
        if (rewardTrackerContainer) rewardTrackerContainer.classList.add('hidden');
    } else {
        cartEmptyState.classList.add('hidden');
        cartItemsList.classList.remove('hidden');
        cartFooter.classList.remove('hidden');
        if (clearCartBtn) clearCartBtn.classList.remove('hidden');

        const subtotal = cart.reduce((sum, item) => {
            return sum + (parsePrice(item.price) * (Number(item.quantity) || 1));
        }, 0);

        // If coupon data hasn't been loaded yet, fetch it now and re-render once available.
        if (typeof window.__cachedCouponTiers === 'undefined' && !window.__couponFetchInProgress) {
            try {
                window.__couponFetchInProgress = true;
                const isSubPage = window.location.pathname.includes('/pages/');
                const url = isSubPage ? '../assets/data/coupons.json' : './assets/data/coupons.json';
                fetch(url, { cache: 'no-store' })
                    .then(r => { if (!r.ok) throw new Error('Failed to load coupons.json'); return r.json(); })
                    .then(json => { if (Array.isArray(json)) window.__cachedCouponTiers = json; })
                    .catch(err => { console.warn('renderCart: could not load coupons.json', err); })
                    .finally(() => { window.__couponFetchInProgress = false; renderCart(); });
            } catch (e) {
                window.__couponFetchInProgress = false;
            }
            return; // wait for async load
        }

        cartItemsList.innerHTML = cart.map(item => {
            const quantity = Number(item.quantity) || 1;
            const itemPrice = parsePrice(item.price) * quantity;

            return `
                <li class="flex py-6 text-left">
                    <div class="w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                        <img src="${item.imageUrl}" alt="${item.name}" class="w-full h-auto object-cover object-center" 
                             onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
                    </div>
                    <div class="ml-4 flex flex-1 flex-col">
                        <div>
                            <div class="flex justify-between text-base font-medium text-royal-black">
                                <h3 class="font-serif"><a href="#">${item.name}</a></h3>
                                <p class="ml-4">${formatPrice(itemPrice)}</p>
                            </div>
                            <p class="mt-1 text-sm text-gray-600">${item.category}</p>
                        </div>
                        <div class="flex flex-1 items-end justify-between text-sm">
                            <div class="flex items-center border border-gray-200 rounded">
                                <button type="button" class="decrease-cart-item-qty-btn w-7 h-7 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                                <span class="w-8 text-center text-sm font-medium text-gray-800">${item.quantity}</span>
                                <button type="button" class="increase-cart-item-qty-btn w-7 h-7 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100" data-id="${item.id}" aria-label="Increase quantity">+</button>
                            </div>
                            <div class="flex">
                                <button type="button" class="remove-cart-item-btn font-medium text-royal-black hover:text-gray-700" data-id="${item.id}">Remove</button>
                            </div>
                        </div>
                    </div>
                </li>
            `;
        }).join('');

        cartSubtotal.textContent = formatPrice(subtotal);

        // --- Multi-Tier Discount Tracker Logic ---
        const rewardTrackerContainer = document.getElementById('reward-tracker-container');
        const rewardStatusText = document.getElementById('reward-status-text');
        const rewardTrackerBar = document.getElementById('reward-tracker-bar');
        const rewardTrackerIcon = document.getElementById('reward-tracker-icon');
        const couponContainer = document.getElementById('unlocked-coupon-container');
        const couponCodeText = document.getElementById('unlocked-coupon-code');

        // Load coupon tiers (cached) or default
        const defaultTiers = [
            { threshold: 1500, code: 'FUSION10', discount: 0.10 },
            { threshold: 3000, code: 'FUSION20', discount: 0.20 },
            { threshold: 5000, code: 'KINGFUSION', discount: 0.30 }
        ];

        // Use globally cached coupon list if available (loaded at module start)
        const rawTiers = (window.__cachedCouponTiers && Array.isArray(window.__cachedCouponTiers) && window.__cachedCouponTiers.length)
            ? window.__cachedCouponTiers
            : defaultTiers;

        // Map raw tiers to display tiers with label/icon
        const tiers = rawTiers.slice().sort((a, b) => a.threshold - b.threshold).map((t, idx, arr) => {
            const pct = Math.round((Number(t.discount) || 0) * 100);
            let icon = '✨';
            if (pct >= 30) icon = '👑';
            else if (pct >= 20) icon = '🔥';
            return {
                threshold: Number(t.threshold),
                label: (pct > 0) ? `${pct}% OFF` : 'Discount',
                code: String(t.code || '').toUpperCase(),
                icon
            };
        });

        if (rewardTrackerContainer && rewardStatusText && rewardTrackerBar) {
            rewardTrackerContainer.classList.remove('hidden');

            // Find current and next tier
            const currentTierIndex = [...tiers].reverse().findIndex(t => subtotal >= t.threshold);
            const actualTierIndex = currentTierIndex === -1 ? -1 : tiers.length - 1 - currentTierIndex;
            const nextTier = tiers[actualTierIndex + 1];

            if (nextTier) {
                const remaining = nextTier.threshold - subtotal;
                const progress = (subtotal / nextTier.threshold) * 100;

                rewardStatusText.innerHTML = `Add <span class="font-bold text-ivory">₹${remaining}</span> more to unlock <span class="text-ivory underline decoration-2 underline-offset-4">${nextTier.label}</span>`;
                rewardTrackerBar.style.width = `${progress}%`;
                rewardTrackerIcon.textContent = nextTier.icon;
            } else {
                // Max tier reached
                rewardStatusText.innerHTML = `🎉 <span class="text-royal-black uppercase tracking-widest font-extrabold">VIP Status Unlocked!</span>`;
                rewardTrackerBar.style.width = '100%';
                rewardTrackerIcon.textContent = '👑';
            }

            // Handle coupon visibility
            if (actualTierIndex !== -1) {
                couponContainer.classList.remove('hidden');
                const bestCoupon = tiers[actualTierIndex].code;
                couponCodeText.textContent = bestCoupon;

                // Add copy to clipboard functionality if not already added
                if (!couponContainer.dataset.copyInited) {
                    couponContainer.addEventListener('click', () => {
                        navigator.clipboard.writeText(bestCoupon).then(() => {
                            showToast(`Coupon ${bestCoupon} copied!`, 'success');
                        });
                    });
                    couponContainer.dataset.copyInited = 'true';
                }
            } else {
                couponContainer.classList.add('hidden');
            }
        }
    }

    // update badges after DOM changes
    if (typeof updateBadges === 'function') updateBadges();

    // Update recommendations
    if (typeof renderCartRecommendations === 'function') renderCartRecommendations();
};

