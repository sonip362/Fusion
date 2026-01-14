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

    // Helper: Format Price
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price).replace('INR', '₹');
    };

    // Helper: Parse Price String to Number
    const parsePrice = (priceString) => {
        return Number(String(priceString).replace(/[^0-9.-]+/g, ""));
    };

    // Load Cart
    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('ris_cart') || '[]');
    } catch {
        cart = [];
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

    // Render Items
    checkoutItemsContainer.innerHTML = cart.map(item => {
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

    // Calculate Initial Totals
    let subtotal = cart.reduce((sum, item) => sum + (parsePrice(item.price) * (Number(item.quantity) || 1)), 0);
    let shipping = subtotal > 1999 ? 0 : 99;
    let discount = 0;

    updateTotals(subtotal, shipping, discount);

    function updateTotals(sub, ship, disc) {
        const total = sub + ship - disc;
        const formattedTotal = formatPrice(total > 0 ? total : 0);

        subtotalEl.textContent = formatPrice(sub);
        shippingEl.textContent = ship === 0 ? 'FREE' : formatPrice(ship);

        // Add discount row if exists
        const oldDiscountRows = document.querySelectorAll('.discount-row');
        oldDiscountRows.forEach(row => row.remove());

        if (disc > 0) {
            const discountRow = document.createElement('div');
            discountRow.className = 'flex justify-between text-sm text-green-600 discount-row';
            discountRow.innerHTML = `<span>Discount</span><span>-${formatPrice(disc)}</span>`;
            shippingEl.parentElement.after(discountRow);
        }

        totalEl.textContent = formattedTotal;

        // Update mobile floating total
        const mobileTotalEl = document.getElementById('mobile-floating-total');
        if (mobileTotalEl) {
            mobileTotalEl.textContent = formattedTotal;
        }
    }

    // Coupon Logic with Tier Validation
    const couponTiers = [
        { threshold: 1500, code: 'FUSION10', discount: 0.10 },
        { threshold: 3000, code: 'FUSION20', discount: 0.20 },
        { threshold: 5000, code: 'KINGFUSION', discount: 0.30 }
    ];

    applyCouponBtn.addEventListener('click', () => {
        const code = couponInput.value.trim().toUpperCase();
        couponMessage.classList.remove('hidden', 'text-green-600', 'text-red-500');

        // Find the coupon tier
        const couponTier = couponTiers.find(tier => tier.code === code);

        if (!couponTier) {
            // Invalid coupon code
            discount = 0;
            updateTotals(subtotal, shipping, discount);
            couponMessage.textContent = 'Invalid coupon code.';
            couponMessage.classList.add('text-red-500', 'block');
            couponMessage.classList.remove('hidden');
            return;
        }

        // Check if subtotal meets the threshold
        if (subtotal < couponTier.threshold) {
            discount = 0;
            updateTotals(subtotal, shipping, discount);
            couponMessage.textContent = `Coupon Unavailable.`;
            couponMessage.classList.add('text-red-500', 'block');
            couponMessage.classList.remove('hidden');
            return;
        }

        // Valid and unlocked coupon
        discount = subtotal * couponTier.discount;
        updateTotals(subtotal, shipping, discount);

        couponMessage.textContent = `Coupon applied! You saved ${formatPrice(discount)}.`;
        couponMessage.classList.add('text-green-600', 'block');
        couponMessage.classList.remove('hidden');
    });

    // --- Persistence & Section Unlocking Logic ---
    const paymentSection = document.getElementById('payment-section');

    // Load saved checkout info
    const savedInfo = JSON.parse(localStorage.getItem('ris_checkout_info') || '{}');
    const shippingInputs = checkoutForm.querySelectorAll('input');

    shippingInputs.forEach(input => {
        if (savedInfo[input.name]) {
            input.value = savedInfo[input.name];
        }
    });

    const checkFormValidity = () => {
        // Save current info
        const currentInfo = {};
        shippingInputs.forEach(input => {
            currentInfo[input.name] = input.value;
        });
        localStorage.setItem('ris_checkout_info', JSON.stringify(currentInfo));

        if (checkoutForm.checkValidity()) {
            paymentSection.classList.remove('opacity-60', 'pointer-events-none', 'grayscale');
            paymentSection.classList.add('shadow-xl', 'border-royal-black/20');
        } else {
            paymentSection.classList.add('opacity-60', 'pointer-events-none', 'grayscale');
            paymentSection.classList.remove('shadow-xl', 'border-royal-black/20');
        }
    };

    // Run initial check
    checkFormValidity();

    shippingInputs.forEach(input => {
        input.addEventListener('input', checkFormValidity);
        input.addEventListener('change', checkFormValidity);
    });

    // --- Payment Method Logic ---
    const cardDetailsForm = document.getElementById('card-details-form');
    const upiQrSection = document.getElementById('upi-qr-section');
    const paymentMethods = document.querySelectorAll('input[name="payment-method"]');
    const upiTimerEl = document.getElementById('upi-timer');
    const upiTransIdEl = document.getElementById('upi-trans-id');

    let timerInterval = null;

    const startUpiTimer = () => {
        // Reset ID
        upiTransIdEl.textContent = `FSN-${Math.floor(Math.random() * 900000 + 100000)}`;

        // Reset and Start Timer (5 minutes)
        let timeLeft = 300;
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            upiTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                upiTimerEl.textContent = "EXPIRED";
            }
            timeLeft--;
        }, 1000);
    };

    paymentMethods.forEach(method => {
        method.addEventListener('change', (e) => {
            // Reset visibility
            cardDetailsForm.classList.add('hidden');
            upiQrSection.classList.add('hidden');
            if (timerInterval) clearInterval(timerInterval);

            if (e.target.value === 'card') {
                cardDetailsForm.classList.remove('hidden');
            } else if (e.target.value === 'upi') {
                upiQrSection.classList.remove('hidden');
                startUpiTimer();
            }
        });
    });

    // Place Order Logic
    placeOrderBtn.addEventListener('click', (e) => {
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        e.preventDefault();

        // Show loading state
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

        setTimeout(() => {
            localStorage.removeItem('ris_cart');
            window.location.href = '../index.html';
        }, 2000);
    });
});
