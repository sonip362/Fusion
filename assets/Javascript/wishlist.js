// --- Wishlist Operations ---

const addItemToWishlist = (product) => {
    if (!product) return; // Guard
    const existingItem = wishlist.find(item => item.id === product.id);
    if (!existingItem) {
        wishlist.push(product);
        saveState();
        renderWishlist();
        showToast(`${product.name} added to wishlist`, 'wishlist');
    } else {
        showToast(`${product.name} is already in your wishlist`, 'wishlist');
    }
};

const removeFromWishlist = (productId) => {
    wishlist = wishlist.filter(item => item.id !== productId);
    saveState();
    renderWishlist();
};

const clearWishlist = () => {
    if (wishlist.length === 0) return;
    const overlay = document.getElementById('wishlist-confirm-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.remove('opacity-0', 'scale-95'), 20);
};

const closeWishlistConfirm = () => {
    const overlay = document.getElementById('wishlist-confirm-overlay');
    if (!overlay) return;
    overlay.classList.add('opacity-0', 'scale-95');
    setTimeout(() => overlay.classList.add('hidden'), 300);
};

const renderWishlist = () => {
    const wishlistEmptyState = document.getElementById('wishlist-empty-state');
    const wishlistItemsList = document.getElementById('wishlist-items-list');
    const clearWishlistBtn = document.getElementById('clear-wishlist-btn');

    if (!wishlistEmptyState || !wishlistItemsList) return;

    if (wishlist.length === 0) {
        wishlistEmptyState.classList.remove('hidden');
        wishlistItemsList.classList.add('hidden');
        wishlistItemsList.innerHTML = '';
        if (clearWishlistBtn) clearWishlistBtn.classList.add('hidden');
    } else {
        wishlistEmptyState.classList.add('hidden');
        wishlistItemsList.classList.remove('hidden');
        if (clearWishlistBtn) clearWishlistBtn.classList.remove('hidden');

        wishlistItemsList.innerHTML = wishlist.map(item => `
                <li class="flex py-6">
                    <div class="w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                        <img src="${item.imageUrl}" alt="${item.name}" class="w-full h-auto object-cover object-center"
                             onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
                    </div>
                    <div class="ml-4 flex flex-1 flex-col">
                        <div>
                            <div class="flex justify-between text-base font-medium text-royal-black">
                                <h3 class="font-serif"><a href="#">${item.name}</a></h3>
                                <p class="ml-4">${item.price}</p>
                            </div>
                            <p class="mt-1 text-sm text-gray-600">${item.category}</p>
                        </div>
                        <div class="flex flex-1 items-end justify-between text-sm">
                            <button type="button" class="add-to-cart-from-wishlist-btn font-medium text-royal-black hover:text-gray-700" data-id="${item.id}">Move to Cart</button>
                            <div class="flex">
                                <button type="button" class="remove-wishlist-item-btn font-medium text-royal-black hover:text-gray-700" data-id="${item.id}">Remove</button>
                            </div>
                        </div>
                    </div>
                </li>
            `).join('');
    }

    // update badges after DOM changes
    if (typeof updateBadges === 'function') updateBadges();
};
