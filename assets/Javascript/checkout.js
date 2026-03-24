document.addEventListener('DOMContentLoaded', () => {
    const checkoutItemsContainer = document.getElementById('checkout-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const totalEl = document.getElementById('checkout-total');
    const couponInput = document.getElementById('coupon-input');
    const applyCouponBtn = document.getElementById('apply-coupon');
    const couponMessage = document.getElementById('coupon-message');
    const placeOrderBtn = document.getElementById('confirm-order-btn');
    const checkoutForm = document.getElementById('checkout-form');
    const coinSection = document.getElementById('coin-section');
    const coinBalanceEl = document.getElementById('coin-balance');
    const coinRedeemInput = document.getElementById('coin-redeem-input');
    const applyCoinsBtn = document.getElementById('apply-coins');
    const coinMessageEl = document.getElementById('coin-message');
    const mobileTotalEl = document.getElementById('mobile-floating-total');

    const MIN_REDEEM_COINS = 20;
    const COIN_VALUE_INR = 1;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price).replace('INR', '₹');
    };

    const parsePrice = (priceString) => Number(String(priceString).replace(/[^0-9.-]+/g, ''));

    const getLoggedInUser = () => {
        try {
            return JSON.parse(localStorage.getItem('fusion_user') || 'null');
        } catch {
            return null;
        }
    };

    const setLoggedInUser = (user) => {
        localStorage.setItem('fusion_user', JSON.stringify(user));
    };

    const setCoinMessage = (message, type = 'neutral') => {
        if (!coinMessageEl) return;
        coinMessageEl.textContent = message;
        coinMessageEl.classList.remove('hidden', 'text-red-500', 'text-green-600', 'text-gray-500');
        if (type === 'error') coinMessageEl.classList.add('text-red-500');
        else if (type === 'success') coinMessageEl.classList.add('text-green-600');
        else coinMessageEl.classList.add('text-gray-500');
    };

    let cart = [];
    const loggedInUser = getLoggedInUser();

    try {

        if (loggedInUser && Array.isArray(loggedInUser.cart)) {
            cart = loggedInUser.cart;
        } else {
            cart = JSON.parse(localStorage.getItem('fus_cart') || '[]');
        }
    } catch {
        cart = [];
    }

    let subtotal = cart.reduce((sum, item) => sum + (parsePrice(item.price) * (Number(item.quantity) || 1)), 0);
    let shipping = subtotal > 1999 ? 0 : 99;
    let discount = 0;
    let codFee = 0;
    let coinRedeemAmount = 0;

    const getCoinBalance = () => Math.max(0, Math.floor(Number(getLoggedInUser()?.rewardCoins) || 0));

    const getMaxRedeemableCoins = () => {
        const coinBalance = getCoinBalance();
        const payableBeforeCoins = Math.max(0, Math.floor(subtotal + shipping + codFee - discount));
        return Math.min(coinBalance, payableBeforeCoins);
    };

    const syncCoinRedemptionToLimits = () => {
        const maxRedeemable = getMaxRedeemableCoins();
        if (maxRedeemable < MIN_REDEEM_COINS) {
            coinRedeemAmount = 0;
            return 0;
        }

        if (coinRedeemAmount > maxRedeemable) {
            coinRedeemAmount = maxRedeemable;
        }

        if (coinRedeemAmount > 0 && coinRedeemAmount < MIN_REDEEM_COINS) {
            coinRedeemAmount = 0;
        }

        return coinRedeemAmount * COIN_VALUE_INR;
    };

    function updateTotals(sub, ship, disc) {
        const coinDiscount = syncCoinRedemptionToLimits();
        const total = sub + ship + codFee - disc - coinDiscount;
        const formattedTotal = formatPrice(total > 0 ? total : 0);

        subtotalEl.textContent = formatPrice(sub);
        shippingEl.textContent = ship === 0 ? 'FREE' : formatPrice(ship);

        const oldRows = document.querySelectorAll('.discount-row, .fee-row, .coin-row');
        oldRows.forEach((row) => row.remove());

        const dynamicRows = [];
        if (disc > 0) {
            const discountRow = document.createElement('div');
            discountRow.className = 'flex justify-between text-sm text-green-600 discount-row';
            discountRow.innerHTML = `<span>Discount</span><span>-${formatPrice(disc)}</span>`;
            dynamicRows.push(discountRow);
        }

        if (coinDiscount > 0) {
            const coinRow = document.createElement('div');
            coinRow.className = 'flex justify-between text-sm text-green-600 coin-row';
            coinRow.innerHTML = `<span>Reward Coins</span><span>-${formatPrice(coinDiscount)}</span>`;
            dynamicRows.push(coinRow);
        }

        if (codFee > 0) {
            const feeRow = document.createElement('div');
            feeRow.className = 'flex justify-between text-sm text-gray-700 fee-row';
            feeRow.innerHTML = `<span>Cash on Delivery Fee</span><span>${formatPrice(codFee)}</span>`;
            dynamicRows.push(feeRow);
        }

        let insertAfter = shippingEl.parentElement;
        dynamicRows.forEach((row) => {
            insertAfter.after(row);
            insertAfter = row;
        });

        totalEl.textContent = formattedTotal;
        if (mobileTotalEl) mobileTotalEl.textContent = formattedTotal;

        updateCoinUI();
    }

    const updateCoinUI = () => {
        if (!coinSection || !coinBalanceEl || !coinRedeemInput || !applyCoinsBtn) return;

        const loggedInUser = getLoggedInUser();
        const coinBalance = getCoinBalance();
        const maxRedeemable = getMaxRedeemableCoins();

        coinBalanceEl.textContent = String(coinBalance);
        coinRedeemInput.max = String(maxRedeemable);

        if (!loggedInUser) {
            coinRedeemInput.disabled = true;
            applyCoinsBtn.disabled = true;
            applyCoinsBtn.classList.add('opacity-60', 'cursor-not-allowed');
            coinRedeemInput.value = '';
            coinRedeemAmount = 0;
            setCoinMessage('Log in to redeem reward coins.', 'error');
            return;
        }

        if (maxRedeemable < MIN_REDEEM_COINS) {
            coinRedeemInput.disabled = true;
            applyCoinsBtn.disabled = true;
            applyCoinsBtn.classList.add('opacity-60', 'cursor-not-allowed');
            coinRedeemInput.value = '';
            coinRedeemAmount = 0;

            if (coinBalance < MIN_REDEEM_COINS) {
                setCoinMessage(`Minimum ${MIN_REDEEM_COINS} coins are required to redeem.`);
            } else {
                setCoinMessage(`Order total must support at least ${MIN_REDEEM_COINS} coins.`);
            }
            return;
        }

        coinRedeemInput.disabled = false;
        applyCoinsBtn.disabled = false;
        applyCoinsBtn.classList.remove('opacity-60', 'cursor-not-allowed');

        if (coinRedeemAmount >= MIN_REDEEM_COINS) {
            coinRedeemInput.value = String(coinRedeemAmount);
            setCoinMessage(
                `${coinRedeemAmount} coins applied. You saved ${formatPrice(coinRedeemAmount * COIN_VALUE_INR)}.`,
                'success'
            );
        } else {
            coinRedeemInput.value = '';
            setCoinMessage(`1 coin = ${formatPrice(COIN_VALUE_INR)}. Minimum redeem is ${MIN_REDEEM_COINS}. Earn 1 coin per ${formatPrice(100)} shopping.`);
        }
    };

    // The common loggedInUser is now defined at the top
    if (!loggedInUser || !loggedInUser.email) {
        checkoutItemsContainer.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 mb-4">Please log in to proceed with checkout.</p>
                <a href="../index.html" class="text-royal-black font-semibold underline">Back to Home</a>
            </div>
        `;
        placeOrderBtn.disabled = true;
        placeOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
        updateTotals(0, 0, 0);
        return;
    }

    if (cart.length === 0) {
        checkoutItemsContainer.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 mb-4">Your cart is empty.</p>
                <a href="../index.html" class="text-royal-black font-semibold underline">Continue Shopping</a>
            </div>
        `;
        placeOrderBtn.disabled = true;
        placeOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
        updateTotals(0, 0, 0);
        return;
    }

    checkoutItemsContainer.innerHTML = cart.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const price = parsePrice(item.price);
        return `
            <li class="flex gap-4 py-2">
                <div class="w-16 h-20 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                    <img src="../${item.imageUrl}" alt="${item.name}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/100x125?text=Img'">
                </div>
                <div class="flex-1 flex flex-col justify-center">
                    <h3 class="text-sm font-semibold text-royal-black leading-tight">${item.name}</h3>
                    <p class="text-xs text-gray-500 mt-1">${item.category || 'Apparel'}</p>
                    <div class="flex justify-between items-center mt-2">
                        <p class="text-xs text-gray-600">Qty: ${quantity}</p>
                        <p class="text-sm font-medium text-royal-black">${formatPrice(price * quantity)}</p>
                    </div>
                </div>
            </li>
        `;
    }).join('');

    const defaultCouponTiers = [
        { threshold: 1500, code: 'FUSION10', discount: 0.10 },
        { threshold: 3000, code: 'FUSION20', discount: 0.20 },
        { threshold: 5000, code: 'KINGFUSION', discount: 0.30 }
    ];
    let couponTiers = defaultCouponTiers.slice();

    (function loadCoupons() {
        fetch('../assets/data/coupons.json')
            .then((res) => {
                if (!res.ok) throw new Error('Network response not ok');
                return res.json();
            })
            .then((json) => {
                if (Array.isArray(json) && json.length) couponTiers = json;
            })
            .catch((err) => {
                console.warn('Could not load coupons.json, using defaults', err);
            });
    })();

    applyCouponBtn.addEventListener('click', async () => {
        const code = couponInput.value.trim().toUpperCase();
        couponMessage.classList.remove('hidden', 'text-green-600', 'text-red-500');

        try {
            const res = await fetch('../assets/data/coupons.json', { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length) couponTiers = json;
            }
        } catch (err) {
            console.warn('Could not refresh coupons.json on apply', err);
        }

        const couponTier = couponTiers.find((tier) => String(tier.code).toUpperCase() === code);
        if (!couponTier) {
            discount = 0;
            updateTotals(subtotal, shipping, discount);
            couponMessage.textContent = 'Invalid coupon code.';
            couponMessage.classList.add('text-red-500', 'block');
            couponMessage.classList.remove('hidden');
            return;
        }

        if (subtotal < Number(couponTier.threshold)) {
            discount = 0;
            updateTotals(subtotal, shipping, discount);
            couponMessage.textContent = 'Coupon Unavailable.';
            couponMessage.classList.add('text-red-500', 'block');
            couponMessage.classList.remove('hidden');
            return;
        }

        discount = subtotal * Number(couponTier.discount);
        updateTotals(subtotal, shipping, discount);

        couponMessage.textContent = `Coupon applied! You saved ${formatPrice(discount)}.`;
        couponMessage.classList.add('text-green-600', 'block');
        couponMessage.classList.remove('hidden');
    });

    if (applyCoinsBtn) {
        applyCoinsBtn.addEventListener('click', () => {
            const loggedInUser = getLoggedInUser();
            const requestedCoins = Math.floor(Number(coinRedeemInput.value) || 0);
            const coinBalance = getCoinBalance();
            const maxRedeemable = getMaxRedeemableCoins();

            if (!loggedInUser) {
                setCoinMessage('Log in to redeem reward coins.', 'error');
                return;
            }

            if (requestedCoins <= 0) {
                coinRedeemAmount = 0;
                updateTotals(subtotal, shipping, discount);
                setCoinMessage('Coin redemption cleared.');
                return;
            }

            if (requestedCoins < MIN_REDEEM_COINS) {
                setCoinMessage(`Minimum redeem amount is ${MIN_REDEEM_COINS} coins.`, 'error');
                return;
            }

            if (requestedCoins > coinBalance) {
                setCoinMessage('You do not have enough coins.', 'error');
                return;
            }

            if (requestedCoins > maxRedeemable) {
                setCoinMessage('Coins cannot exceed payable order amount.', 'error');
                return;
            }

            coinRedeemAmount = requestedCoins;
            updateTotals(subtotal, shipping, discount);
            setCoinMessage(
                `${coinRedeemAmount} coins applied. You saved ${formatPrice(coinRedeemAmount * COIN_VALUE_INR)}.`,
                'success'
            );
        });
    }

    const paymentSection = document.getElementById('payment-section');
    const savedInfo = JSON.parse(localStorage.getItem('fus_checkout_info') || '{}');
    const shippingInputs = checkoutForm.querySelectorAll('input');

    shippingInputs.forEach((input) => {
        if (savedInfo[input.name]) input.value = savedInfo[input.name];
    });

    const checkFormValidity = () => {
        const currentInfo = {};
        shippingInputs.forEach((input) => {
            currentInfo[input.name] = input.value;
        });
        localStorage.setItem('fus_checkout_info', JSON.stringify(currentInfo));

        if (checkoutForm.checkValidity()) {
            paymentSection.classList.remove('opacity-60', 'pointer-events-none', 'grayscale');
            paymentSection.classList.add('shadow-xl', 'border-royal-black/20');
        } else {
            paymentSection.classList.add('opacity-60', 'pointer-events-none', 'grayscale');
            paymentSection.classList.remove('shadow-xl', 'border-royal-black/20');
        }
    };

    checkFormValidity();
    shippingInputs.forEach((input) => {
        input.addEventListener('input', checkFormValidity);
        input.addEventListener('change', checkFormValidity);
    });

    const cardDetailsForm = document.getElementById('card-details-form');
    const upiQrSection = document.getElementById('upi-qr-section');
    const paymentMethods = document.querySelectorAll('input[name="payment-method"]');
    const upiTimerEl = document.getElementById('upi-timer');
    const upiTransIdEl = document.getElementById('upi-trans-id');
    let timerInterval = null;

    const startUpiTimer = () => {
        upiTransIdEl.textContent = `FSN-${Math.floor(Math.random() * 900000 + 100000)}`;
        let timeLeft = 300;
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            upiTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                upiTimerEl.textContent = 'EXPIRED';
            }
            timeLeft--;
        }, 1000);
    };

    paymentMethods.forEach((method) => {
        method.addEventListener('change', (e) => {
            cardDetailsForm.classList.add('hidden');
            upiQrSection.classList.add('hidden');
            if (timerInterval) clearInterval(timerInterval);

            if (e.target.value === 'card') {
                cardDetailsForm.classList.remove('hidden');
                codFee = 0;
            } else if (e.target.value === 'upi') {
                upiQrSection.classList.remove('hidden');
                startUpiTimer();
                codFee = 0;
            } else if (e.target.value === 'cod') {
                codFee = 49;
            }

            updateTotals(subtotal, shipping, discount);
        });
    });

    placeOrderBtn.addEventListener('click', async (e) => {
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        e.preventDefault();

        const originalText = placeOrderBtn.innerHTML;
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = `
            <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5 text-ivory" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
            </span>
        `;

        try {
            const redeemCoinsForOrder = coinRedeemAmount >= MIN_REDEEM_COINS ? coinRedeemAmount : 0;
            const shoppingAmountForCoins = Math.max(
                0,
                subtotal - discount - (redeemCoinsForOrder * COIN_VALUE_INR)
            );

            if (loggedInUser && loggedInUser.email) {
                const rewardsResponse = await fetch('/api/user/checkout-rewards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loggedInUser.email,
                        coinsToRedeem: redeemCoinsForOrder,
                        shoppingAmount: shoppingAmountForCoins
                    })
                });

                const rewardsData = await rewardsResponse.json().catch(() => ({}));
                if (!rewardsResponse.ok) {
                    throw new Error(rewardsData.error || 'Failed to update reward coins.');
                }

                loggedInUser.rewardCoins = Number(rewardsData.rewardCoins) || 0;
            } else if (redeemCoinsForOrder > 0) {
                throw new Error('Please log in before redeeming coins.');
            }

            if (loggedInUser) {
                loggedInUser.cart = [];
                setLoggedInUser(loggedInUser);

                fetch('/api/user/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loggedInUser.email,
                        cart: [],
                        wishlist: loggedInUser.wishlist || []
                    })
                }).catch((err) => console.warn('Failed to sync post-checkout cart state:', err));
            }

            localStorage.removeItem('fus_cart');

            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1200);
        } catch (error) {
            setCoinMessage(error.message || 'Unable to place order right now.', 'error');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = originalText;
        }
    });

    updateTotals(subtotal, shipping, discount);
});
