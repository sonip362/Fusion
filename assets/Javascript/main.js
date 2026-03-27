// --- Cookie Helpers ---
const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
};

const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
};

const getGuestId = () => {
    let gid = getCookie('fusion_guest_id');
    if (!gid) {
        gid = 'gs_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        setCookie('fusion_guest_id', gid, 30);
    }
    return gid;
};

// --- App State (Global) ---
let cart = [];
let wishlist = [];
let recentlyViewed = [];

// --- State Management ---
const loadState = async () => {
    const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');
    const guestId = getGuestId();

    try {
        // Fetch state from MongoDB - no fields in body means "Fetch Only" for the server
        const syncData = {
            email: loggedInUser?.email || null,
            guestId: loggedInUser?.email ? null : guestId
        };

        const response = await fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });

        if (response.ok) {
            const data = await response.json();
            cart = data.cart || [];
            wishlist = data.wishlist || [];
            recentlyViewed = data.recentlyViewed || [];

            // If logged in, update the local user object with latest server state
            if (loggedInUser && data.type === 'user') {
                loggedInUser.cart = cart;
                loggedInUser.wishlist = wishlist;
                loggedInUser.rewardCoins = data.rewardCoins;
                localStorage.setItem('fusion_user', JSON.stringify(loggedInUser));
            }
            // Update chat history for FAQ bot
            if (data.chatHistory && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
                localStorage.setItem('fusion_chat_history', JSON.stringify(data.chatHistory));
            }

            console.log("✅ Synced state from MongoDB (Source of Truth)");
        } else {
            console.warn("MongoDB sync failed on load, falling back to empty state.");
            cart = [];
            wishlist = [];
            recentlyViewed = [];
        }
    } catch (error) {
        console.error("Critical error during loadState:", error);
        cart = [];
        wishlist = [];
        recentlyViewed = [];
    }

    // Always update UI after loading
    if (typeof updateBadges === 'function') updateBadges();
    if (typeof renderRecentlyViewed === 'function') renderRecentlyViewed();
};

const saveState = async () => {
    const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');
    const guestId = getGuestId();

    // Prepare sync payload - ONLY include fields that are actually being saved
    const syncData = {
        email: loggedInUser?.email || null,
        guestId: loggedInUser?.email ? null : guestId,
        cart: cart,
        wishlist: wishlist,
        recentlyViewed: recentlyViewed
    };

    // Only SYNC TO MONGODB if consent is accepted
    const consent = localStorage.getItem('cookie-consent');
    if (consent === 'accepted') {
        try {
            const response = await fetch('/api/user/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData)
            });

            if (response.ok) {
                const data = await response.json();
                if (loggedInUser && data.type === 'user') {
                    loggedInUser.cart = cart;
                    loggedInUser.wishlist = wishlist;
                    localStorage.setItem('fusion_user', JSON.stringify(loggedInUser));
                }
            }
        } catch (err) {
            console.warn("Failed to sync with server:", err);
        }
    } else {
        // If rejected OR not yet decided, we do NOT save to MongoDB
        // We still keep it in local memory 'cart' / 'wishlist' variables
        // and only use localStorage as a fallback if Not Rejected
        if (consent !== 'rejected') {
            localStorage.setItem('fus_cart', JSON.stringify(cart));
            localStorage.setItem('fus_wishlist', JSON.stringify(wishlist));
            localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
        }
    }

    if (typeof updateBadges === 'function') updateBadges();
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

let fusionProducts = [];

const setFusionProducts = (products) => {
    fusionProducts = Array.isArray(products) ? products : [];
};

const getFusionProducts = () => fusionProducts;

const buildProfilePlaceholder = (fullName) => {
    const initials = String(fullName || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || 'U';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#111827"/><text x="64" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" fill="#FFFFFF">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const getProfileImageSrc = (user) => {
    if (user && typeof user.profilePicture === 'string' && user.profilePicture.trim()) {
        return user.profilePicture;
    }
    return 'assets/images/main/placeholder.png';
};

const updateAuthUI = () => {
    const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');

    // Desktop elements
    const loginBtnDesktop = document.getElementById('login-btn-desktop');
    const userInfoDesktop = document.getElementById('user-info-desktop');
    const userNameDesktop = document.getElementById('user-name-desktop');
    const userAvatarDesktop = document.getElementById('user-avatar-desktop');

    // Mobile elements
    const loginBtnMobile = document.getElementById('login-btn-mobile');
    const userInfoMobile = document.getElementById('user-info-mobile');
    const userNameMobile = document.getElementById('user-name-mobile');
    const userAvatarMobile = document.getElementById('user-avatar-mobile');

    if (loggedInUser) {
        const firstName = (loggedInUser.fullName || 'User').split(' ')[0];
        const avatarSrc = getProfileImageSrc(loggedInUser);

        if (loginBtnDesktop) loginBtnDesktop.classList.add('hidden');
        if (userInfoDesktop) userInfoDesktop.classList.remove('hidden');
        if (userNameDesktop) userNameDesktop.textContent = firstName;
        if (userAvatarDesktop) userAvatarDesktop.src = avatarSrc;

        if (loginBtnMobile) loginBtnMobile.classList.add('hidden');
        if (userInfoMobile) userInfoMobile.classList.remove('hidden');
        if (userNameMobile) userNameMobile.textContent = firstName;
        if (userAvatarMobile) userAvatarMobile.src = avatarSrc;

        // Update Account Drawer View
        const authView = document.getElementById('auth-view-content');
        const accountView = document.getElementById('account-view-content');
        if (authView) authView.classList.add('hidden');
        if (accountView) {
            accountView.classList.remove('hidden');
            const accName = document.getElementById('account-view-name');
            const accEmail = document.getElementById('account-view-email');
            const accAvatar = document.getElementById('account-view-avatar');
            if (accName) accName.textContent = loggedInUser.fullName || 'User';
            if (accEmail) accEmail.textContent = loggedInUser.email;
            if (accAvatar) accAvatar.src = avatarSrc;
        }
    } else {
        if (loginBtnDesktop) loginBtnDesktop.classList.remove('hidden');
        if (userInfoDesktop) userInfoDesktop.classList.add('hidden');

        if (loginBtnMobile) loginBtnMobile.classList.remove('hidden');
        if (userInfoMobile) userInfoMobile.classList.add('hidden');

        // Reset Account Drawer View
        const authView = document.getElementById('auth-view-content');
        const accountView = document.getElementById('account-view-content');
        if (authView) authView.classList.remove('hidden');
        if (accountView) accountView.classList.add('hidden');
    }
};

const handleLogout = () => {
    localStorage.removeItem('fusion_user');
    updateAuthUI(); // Update UI immediately
    window.location.reload();
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
});

const AVATAR_PREVIEW_SIZE = 176;
const AVATAR_EXPORT_SIZE = 512;

const avatarEditorState = {
    imageDataUrl: '',
    imageEl: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartOffsetX: 0,
    dragStartOffsetY: 0,
    isSaving: false
};

let messageModalControls;
let avatarEditorModalControls;
let deleteConfirmModalControls;

const getAvatarEditorElements = () => ({
    previewCircle: document.getElementById('avatar-preview-circle'),
    previewImage: document.getElementById('avatar-preview-image'),
    zoomSlider: document.getElementById('avatar-editor-zoom'),
    dropzone: document.getElementById('avatar-dropzone'),
    fileInput: document.getElementById('avatar-editor-file-input')
});

const clampAvatarOffsets = () => {
    if (!avatarEditorState.imageEl) return;
    const imgW = avatarEditorState.imageEl.naturalWidth || 1;
    const imgH = avatarEditorState.imageEl.naturalHeight || 1;
    const baseScale = Math.max(AVATAR_PREVIEW_SIZE / imgW, AVATAR_PREVIEW_SIZE / imgH);
    const drawW = imgW * baseScale * avatarEditorState.zoom;
    const drawH = imgH * baseScale * avatarEditorState.zoom;
    const maxX = Math.max(0, (drawW - AVATAR_PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (drawH - AVATAR_PREVIEW_SIZE) / 2);

    avatarEditorState.offsetX = Math.max(-maxX, Math.min(maxX, avatarEditorState.offsetX));
    avatarEditorState.offsetY = Math.max(-maxY, Math.min(maxY, avatarEditorState.offsetY));
};

const renderAvatarPreview = () => {
    const { previewImage } = getAvatarEditorElements();
    if (!previewImage || !avatarEditorState.imageEl) return;

    clampAvatarOffsets();
    const imgW = avatarEditorState.imageEl.naturalWidth || 1;
    const imgH = avatarEditorState.imageEl.naturalHeight || 1;
    const baseScale = Math.max(AVATAR_PREVIEW_SIZE / imgW, AVATAR_PREVIEW_SIZE / imgH);
    const drawW = imgW * baseScale * avatarEditorState.zoom;
    const drawH = imgH * baseScale * avatarEditorState.zoom;

    previewImage.style.width = `${drawW}px`;
    previewImage.style.height = `${drawH}px`;
    previewImage.style.transform = `translate(calc(-50% + ${avatarEditorState.offsetX}px), calc(-50% + ${avatarEditorState.offsetY}px))`;
};

const setAvatarEditorImage = (dataUrl) => new Promise((resolve, reject) => {
    const { previewImage, zoomSlider } = getAvatarEditorElements();
    if (!previewImage) {
        reject(new Error('Avatar preview is unavailable.'));
        return;
    }

    const img = new Image();
    img.onload = () => {
        avatarEditorState.imageDataUrl = dataUrl;
        avatarEditorState.imageEl = img;
        avatarEditorState.zoom = 1;
        avatarEditorState.offsetX = 0;
        avatarEditorState.offsetY = 0;

        previewImage.src = dataUrl;
        if (zoomSlider) zoomSlider.value = '1';
        renderAvatarPreview();
        resolve();
    };
    img.onerror = () => reject(new Error('Could not load selected image.'));
    img.src = dataUrl;
});

const saveProfilePictureToServer = async (profilePictureDataUrl) => {
    const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');
    if (!loggedInUser || !loggedInUser.email) {
        throw new Error('Please log in first.');
    }

    const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: loggedInUser.email,
            profilePicture: profilePictureDataUrl
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile picture.');
    }

    loggedInUser.profilePicture = data.profilePicture || profilePictureDataUrl;
    localStorage.setItem('fusion_user', JSON.stringify(loggedInUser));
    updateAuthUI();
};

const exportAvatarEditorImage = () => {
    if (!avatarEditorState.imageEl) {
        throw new Error('Please drop an image first.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_EXPORT_SIZE;
    canvas.height = AVATAR_EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export failed.');

    const imgW = avatarEditorState.imageEl.naturalWidth || 1;
    const imgH = avatarEditorState.imageEl.naturalHeight || 1;
    const baseScale = Math.max(AVATAR_EXPORT_SIZE / imgW, AVATAR_EXPORT_SIZE / imgH);
    const drawW = imgW * baseScale * avatarEditorState.zoom;
    const drawH = imgH * baseScale * avatarEditorState.zoom;
    const pixelFactor = AVATAR_EXPORT_SIZE / AVATAR_PREVIEW_SIZE;
    const drawX = (AVATAR_EXPORT_SIZE - drawW) / 2 + (avatarEditorState.offsetX * pixelFactor);
    const drawY = (AVATAR_EXPORT_SIZE - drawH) / 2 + (avatarEditorState.offsetY * pixelFactor);

    ctx.drawImage(avatarEditorState.imageEl, drawX, drawY, drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.9);
};

const showMessage = (title, text, type = 'success') => {
    const titleEl = document.getElementById('message-modal-title');
    const textEl = document.getElementById('message-modal-text');
    const iconEl = document.getElementById('message-modal-icon');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;

    if (iconEl) {
        if (type === 'error') {
            iconEl.classList.remove('bg-black');
            iconEl.classList.add('bg-red-600');
            iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
        } else {
            iconEl.classList.add('bg-black');
            iconEl.classList.remove('bg-red-600');
            iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>';
        }
    }

    if (messageModalControls) messageModalControls.open();
};

const resolveProductImageUrl = (url) => {
    if (!url) return '';
    if (window.location.pathname.includes('/pages/')) {
        return url.replace('./', '../');
    }
    return url;
};

const getCompleteLookItems = (product, products) => {
    if (!product || !Array.isArray(products)) return [];

    const COMPLETE_LOOK_MAP = {
        p1: ['p2', 'p3']
    };

    const isKurta = /kurta/i.test(product.name || '');
    if (!isKurta) return [];

    const selected = [];
    const seen = new Set([product.id]);

    const addIfFound = (item) => {
        if (!item || seen.has(item.id)) return;
        seen.add(item.id);
        selected.push(item);
    };

    const mapIds = COMPLETE_LOOK_MAP[product.id];
    if (mapIds && mapIds.length) {
        mapIds.forEach(id => addIfFound(products.find(p => p.id === id)));
    }

    const findByKeyword = (keyword, collectionOnly) => {
        const lower = keyword.toLowerCase();
        return products.find(p => {
            if (!p || seen.has(p.id)) return false;
            if (collectionOnly && (p.collectionName || p.collection) !== (product.collectionName || product.collection)) return false;
            return (p.name || '').toLowerCase().includes(lower);
        });
    };

    if (selected.length < 2) {
        addIfFound(findByKeyword('pants', true) || findByKeyword('pants', false));
    }

    if (selected.length < 2) {
        addIfFound(findByKeyword('dupatta', true) || findByKeyword('dupatta', false));
    }

    if (selected.length < 2) {
        addIfFound(findByKeyword('scarf', true) || findByKeyword('scarf', false));
    }

    return selected.slice(0, 2);
};

const renderQuickViewBundle = (product) => {
    const container = document.getElementById('quick-view-bundle');
    const list = document.getElementById('quick-view-bundle-items');
    if (!container || !list) return;

    const items = getCompleteLookItems(product, getFusionProducts());

    if (!product || items.length === 0) {
        container.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    list.innerHTML = items.map(item => `
        <div class="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div class="w-16 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <img src="${resolveProductImageUrl(item.imageUrl)}" alt="${item.name}" class="w-full h-full object-cover"
                    onerror="this.onerror=null;this.src='https://placehold.co/100x125/F7F5F2/1A1A1A?text=IMG';">
            </div>
            <div class="flex-1">
                <p class="text-[10px] uppercase tracking-widest text-gray-400">${item.category || 'Style'}</p>
                <p class="text-sm font-serif font-semibold text-royal-black">${item.name}</p>
                <p class="text-sm text-gray-700">${item.price}</p>
            </div>
            <button type="button" class="bundle-add-btn px-3 py-1.5 rounded-full bg-royal-black text-ivory text-[10px] uppercase tracking-widest font-semibold hover:bg-gray-800 transition-colors"
                data-bundle-id="${item.id}">
                Add
            </button>
        </div>
    `).join('');

    list.querySelectorAll('.bundle-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.bundleId;
            const item = items.find(p => p.id === id);
            if (item && typeof addItemToCart === 'function') {
                addItemToCart(item);
            }
        });
    });
};

window.setFusionProducts = setFusionProducts;
window.getFusionProducts = getFusionProducts;
window.resolveProductImageUrl = resolveProductImageUrl;
window.renderQuickViewBundle = renderQuickViewBundle;

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
        else { el.classList.add('hidden'); el.textContent = '0'; }
    });

    [[wishlistBadgeDesktop, wishlistCount], [wishlistBadgeMobile, wishlistCount]].forEach(([el, count]) => {
        if (!el) return;
        if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); el.textContent = '0'; }
    });
};

// Global handles for modals (needed by multiple scripts)
let wishlistModal, cartModal, quickViewModalCtl, currentQuickViewProduct;
document.addEventListener('DOMContentLoaded', async function () {

    // Initialize state on load
    await loadState();
    updateAuthUI();

    // POP UP LOGIN AT FIRST (if not logged in)
    const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');
    if (!loggedInUser) {
        // We wait for DOM and triggers
        setTimeout(() => {
            const loginBtn = document.getElementById('login-btn-desktop');
            if (loginBtn) loginBtn.click();
        }, 500);
    }


    // Initialize Message Modal
    messageModalControls = initializeModal({
        modal: document.getElementById('message-modal'),
        panel: document.getElementById('message-modal-panel'),
        closeBtn: document.getElementById('message-modal-close'),
        backdrop: document.getElementById('message-modal-backdrop')
    });

    avatarEditorModalControls = initializeModal({
        modal: document.getElementById('avatar-editor-modal'),
        panel: document.getElementById('avatar-editor-panel'),
        closeBtn: document.getElementById('avatar-editor-close'),
        backdrop: document.getElementById('avatar-editor-backdrop')
    });

    deleteConfirmModalControls = initializeModal({
        modal: document.getElementById('delete-confirm-modal'),
        panel: document.getElementById('delete-confirm-panel'),
        closeBtn: document.getElementById('delete-confirm-cancel-btn'),
        backdrop: document.getElementById('delete-confirm-backdrop')
    });

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

    // --- Parallax Effect ---
    document.addEventListener('mousemove', (e) => {
        const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
        const parallaxElements = document.querySelectorAll('.parallax-bg');

        parallaxElements.forEach(el => {
            el.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        });
    });

    // --- Entrance Animations Observer ---
    if ("IntersectionObserver" in window) {
        const entranceObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    entranceObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.card-entrance').forEach(el => {
            entranceObserver.observe(el);
        });
    }


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
            document.getElementById('wishlist-btn-mobile'),
            document.getElementById('wishlist-btn-mobile-header')
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
            document.getElementById('cart-btn-mobile'),
            document.getElementById('cart-btn-mobile-header')
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

            const quickViewBtn = e.target.closest('.quick-view-btn');
            const addToCartBtn = e.target.closest('.add-to-cart-btn');
            const addToWishlistBtn = e.target.closest('.add-to-wishlist-btn');

            if (quickViewBtn) {
                e.preventDefault(); e.stopPropagation();
                openQuickView(product);
            } else if (addToCartBtn) {
                e.preventDefault(); e.stopPropagation();
                addItemToCart(product);
            } else if (addToWishlistBtn) {
                e.preventDefault(); e.stopPropagation();
                addItemToWishlist(product);
            } else if (window.innerWidth < 768) {
                // Mobile: Single tap opens Quick View
                e.preventDefault();
                openQuickView(product);
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

    // Logout listeners
    const logoutBtnDesktop = document.getElementById('logout-btn-desktop');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnDesktop) logoutBtnDesktop.addEventListener('click', handleLogout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', handleLogout);

    // Avatar editor listeners
    const userAvatarDesktop = document.getElementById('user-avatar-desktop');
    const userAvatarMobile = document.getElementById('user-avatar-mobile');
    const avatarEditorAccept = document.getElementById('avatar-editor-accept');
    const avatarEditorCancel = document.getElementById('avatar-editor-cancel');
    const {
        previewCircle: avatarPreviewCircle,
        zoomSlider: avatarZoomSlider,
        dropzone: avatarDropzone,
        fileInput: avatarFileInput
    } = getAvatarEditorElements();

    const openAccountDrawer = () => {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.remove('translate-x-full');
            document.documentElement.classList.add('scroll-lock');
            document.body.classList.add('scroll-lock');
        }
    };

    const openAvatarEditor = async () => {
        const loggedInUser = JSON.parse(localStorage.getItem('fusion_user') || 'null');
        if (!loggedInUser) {
            showMessage('Error', 'Please log in first.', 'error');
            return;
        }

        try {
            await setAvatarEditorImage(getProfileImageSrc(loggedInUser));
            if (avatarEditorModalControls) avatarEditorModalControls.open();
        } catch (error) {
            showMessage('Error', error.message || 'Failed to open avatar editor.', 'error');
        }
    };

    const handleAvatarFile = async (file) => {
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
            showMessage('Error', 'Please choose an image file.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showMessage('Error', 'Image must be under 2MB.', 'error');
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            await setAvatarEditorImage(dataUrl);
        } catch (error) {
            showMessage('Error', error.message || 'Failed to read image.', 'error');
        }
    };

    if (userAvatarDesktop) {
        userAvatarDesktop.addEventListener('click', (e) => {
            e.stopPropagation();
            openAccountDrawer();
        });
    }
    if (userAvatarMobile) {
        userAvatarMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            openAccountDrawer();
        });
    }

    // Account Management Action Listeners
    const downloadDataBtn = document.getElementById('download-data-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteConfirmFinalBtn = document.getElementById('delete-confirm-final-btn');
    const logoutBtnDrawer = document.getElementById('logout-btn-drawer');
    const changePhotoBtn = document.getElementById('account-change-photo-btn');

    if (changePhotoBtn) changePhotoBtn.addEventListener('click', openAvatarEditor);
    if (logoutBtnDrawer) logoutBtnDrawer.addEventListener('click', handleLogout);

    if (downloadDataBtn) {
        downloadDataBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('fusion_user') || 'null');
            if (!user) return;

            try {
                const response = await fetch('/api/user/download-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                });

                if (response.ok) {
                    const data = await response.json();
                    const blob = new Blob([JSON.stringify(data.userData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fusion_data_${user.email.split('@')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('Data download started', 'success');
                } else {
                    const error = await response.json();
                    showMessage('Error', error.error || 'Failed to download data.', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('Error', 'An unexpected error occurred.', 'error');
            }
        });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            if (deleteConfirmModalControls) deleteConfirmModalControls.open();
        });
    }

    if (deleteConfirmFinalBtn) {
        deleteConfirmFinalBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('fusion_user') || 'null');
            if (!user) return;

            try {
                const response = await fetch('/api/user/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                });

                if (response.ok) {
                    if (deleteConfirmModalControls) deleteConfirmModalControls.close();
                    localStorage.removeItem('fusion_user');
                    showMessage('Success', 'Your account has been deleted. Refreshing...', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    const error = await response.json();
                    showMessage('Error', error.error || 'Failed to delete account.', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('Error', 'An unexpected error occurred.', 'error');
            }
        });
    }

    if (avatarEditorCancel && avatarEditorModalControls) {
        avatarEditorCancel.addEventListener('click', avatarEditorModalControls.close);
    }

    if (avatarDropzone) {
        avatarDropzone.addEventListener('click', () => {
            if (avatarFileInput) avatarFileInput.click();
        });
        avatarDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            avatarDropzone.classList.add('border-black/40', 'bg-zinc-100');
        });
        avatarDropzone.addEventListener('dragleave', () => {
            avatarDropzone.classList.remove('border-black/40', 'bg-zinc-100');
        });
        avatarDropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            avatarDropzone.classList.remove('border-black/40', 'bg-zinc-100');
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            await handleAvatarFile(file);
        });
    }

    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            await handleAvatarFile(file);
            e.target.value = '';
        });
    }

    if (avatarZoomSlider) {
        avatarZoomSlider.addEventListener('input', (e) => {
            avatarEditorState.zoom = Number(e.target.value || 1);
            renderAvatarPreview();
        });
    }

    if (avatarPreviewCircle) {
        avatarPreviewCircle.addEventListener('pointerdown', (e) => {
            if (!avatarEditorState.imageEl) return;
            avatarEditorState.dragging = true;
            avatarEditorState.dragStartX = e.clientX;
            avatarEditorState.dragStartY = e.clientY;
            avatarEditorState.dragStartOffsetX = avatarEditorState.offsetX;
            avatarEditorState.dragStartOffsetY = avatarEditorState.offsetY;
            avatarPreviewCircle.classList.remove('cursor-grab');
            avatarPreviewCircle.classList.add('cursor-grabbing');
        });
    }

    window.addEventListener('pointermove', (e) => {
        if (!avatarEditorState.dragging) return;
        avatarEditorState.offsetX = avatarEditorState.dragStartOffsetX + (e.clientX - avatarEditorState.dragStartX);
        avatarEditorState.offsetY = avatarEditorState.dragStartOffsetY + (e.clientY - avatarEditorState.dragStartY);
        renderAvatarPreview();
    });

    window.addEventListener('pointerup', () => {
        if (!avatarEditorState.dragging) return;
        avatarEditorState.dragging = false;
        if (avatarPreviewCircle) {
            avatarPreviewCircle.classList.remove('cursor-grabbing');
            avatarPreviewCircle.classList.add('cursor-grab');
        }
    });

    if (avatarEditorAccept) {
        avatarEditorAccept.addEventListener('click', async () => {
            if (avatarEditorState.isSaving) return;
            avatarEditorState.isSaving = true;
            avatarEditorAccept.disabled = true;
            const originalAcceptText = avatarEditorAccept.textContent;
            avatarEditorAccept.textContent = 'Saving...';
            try {
                const exportedDataUrl = exportAvatarEditorImage();
                await saveProfilePictureToServer(exportedDataUrl);
                if (avatarEditorModalControls) avatarEditorModalControls.close();
                setTimeout(() => {
                    showMessage('Success', 'Profile picture updated.', 'success');
                }, 320);
            } catch (error) {
                showMessage('Error', error.message || 'Failed to update profile picture.', 'error');
            } finally {
                avatarEditorState.isSaving = false;
                avatarEditorAccept.disabled = false;
                avatarEditorAccept.textContent = originalAcceptText;
            }
        });
    }

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
    const openPrivacyBtn = document.getElementById('open-privacy-modal');
    const closeInfoModalBtn = document.getElementById('close-info-modal');
    const infoModalBackdrop = document.getElementById('info-modal-backdrop');

    if (openShippingBtn) {
        openShippingBtn.addEventListener('click', () => openInfoModal('Shipping & Returns', './assets/shipping.html'));
    }
    if (openSizingBtn) {
        openSizingBtn.addEventListener('click', () => openInfoModal('Sizing Guide', './assets/sizing.html'));
    }
     if (openPrivacyBtn) {
        openPrivacyBtn.addEventListener('click', () => openInfoModal('Privacy Policy', './assets/privacy-policy.html'));
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


    if (typeof initializeNewsletter === 'function') initializeNewsletter();

    // --- FAQ Accordion Logic ---
    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const questionBtn = item.querySelector('.faq-question');
            questionBtn.addEventListener('click', () => {
                const isActive = item.classList.contains('active');

                // Close all other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                        otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                    }
                });

                // Toggle current item
                if (isActive) {
                    item.classList.remove('active');
                    questionBtn.setAttribute('aria-expanded', 'false');
                } else {
                    item.classList.add('active');
                    questionBtn.setAttribute('aria-expanded', 'true');
                }
            });
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
                infoModalContent.innerHTML = mainContent.outerHTML;
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


    // Handle resize to reset/adjust state
    window.addEventListener('resize', () => {
        updateCarousel(currentIndex);
    });

    // Initial state
    updateCarousel(0);

    // Mobile "Nudge" Animation to cue horizontal scrolling
    if (!isDesktop()) {
        setTimeout(() => {
            // Only nudge if the user hasn't scrolled yet (scrollLeft is still 0)
            if (track.scrollLeft < 10) {
                // gentle nudge
                track.scrollBy({ left: 50, behavior: 'smooth' });
                // return after short delay
                setTimeout(() => {
                    track.scrollBy({ left: -50, behavior: 'smooth' });
                }, 600);
            }
        }, 2000); // 2 seconds delay
    }
};

// Newsletter logic
const initializeNewsletter = () => {
    const form = document.getElementById('newsletter-form');
    const statusMsg = document.getElementById('newsletter-status');

    if (form && statusMsg) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('newsletter-email');
            const inputContainer = form.querySelector('div'); // The div wrapping input and button

            if (emailInput && emailInput.value.trim() !== '') {
                // Dim the input to indicate processing
                if (inputContainer) {
                    inputContainer.classList.add('opacity-50', 'pointer-events-none');
                }

                // Simulate network request
                setTimeout(() => {
                    // Hide input container and show success message
                    if (inputContainer) {
                        inputContainer.classList.add('hidden');
                    }
                    statusMsg.classList.remove('hidden');
                    statusMsg.classList.add('fade-in');

                    emailInput.value = '';
                }, 800);
            }
        });
    }
};
