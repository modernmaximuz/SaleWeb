let cartDisabledForEmailLogin = false;
let cartCache = [];
let cartReady = false;

function isEmailLoginActive() {
    return !!(window.firebase && firebase.auth && firebase.auth().currentUser);
}

function applyCartAccessByLoginType() {
    const icon = document.getElementById("cartIcon");
    const popupEl = document.getElementById("cartPopup");

    cartDisabledForEmailLogin = false; // Always enable cart

    if (icon) icon.style.display = "flex";
    // Keep cart popup hidden by default - don't remove hidden class
}

function getCart() {
    return [...cartCache];
}

async function saveCart(cart) {
    cartCache = [...cart];
    if (!cartDisabledForEmailLogin) {
        await fetch("/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cartCache })
        }).catch(() => {});
    }
    renderCartIcon();
    document.dispatchEvent(new CustomEvent("cartUpdated"));
}

async function syncCartFromAccount() {
    if (cartDisabledForEmailLogin) {
        cartCache = [];
        cartReady = true;
        renderCartIcon();
        return;
    }

    try {
        const me = await fetch("/me").then(r => r.json());
        if (!me) {
            cartCache = [];
            cartReady = true;
            renderCartIcon();
            return;
        }
        const data = await fetch("/cart").then(r => r.json());
        cartCache = Array.isArray(data.items) ? data.items : [];
    } catch {
        cartCache = [];
    } finally {
        cartReady = true;
        renderCartIcon();
        document.dispatchEvent(new CustomEvent("cartUpdated"));
    }
}

async function addToCart(item) {
    if (cartDisabledForEmailLogin) {
        alert("Cart is disabled for email login.");
        return;
    }

    const cart = [...cartCache];
    const found = cart.find(i => i.name === item.name);
    const requestedQty = Math.max(1, parseInt(item.qty, 10) || 1);
    const maxQty = Number.isFinite(+item.maxQty) ? Math.max(1, +item.maxQty) : Infinity;

    if (found) {
        const existingMax = Number.isFinite(+found.maxQty) ? Math.max(1, +found.maxQty) : Infinity;
        const appliedMax = Math.min(existingMax, maxQty);
        const nextQty = found.qty + requestedQty;
        found.maxQty = appliedMax;
        found.qty = Math.min(nextQty, appliedMax);

        if (nextQty > appliedMax) {
            alert(`Only ${appliedMax} stock available for this item.`);
        }
    } else {
        cart.push({
            ...item,
            qty: Math.min(requestedQty, maxQty),
            maxQty
        });

        if (requestedQty > maxQty) {
            alert(`Only ${maxQty} stock available for this item.`);
        }
    }

    await saveCart(cart);
}

function removeFromCart(name) {
    if (cartDisabledForEmailLogin) return;
    const cart = cartCache.filter(i => i.name !== name);
    saveCart(cart);
}

function changeQty(name, delta) {
    if (cartDisabledForEmailLogin) return;
    if (window.location.pathname === "/tabs/orders" && delta > 0) {
        alert("Add more items from the shop page.");
        return;
    }
    const cart = [...cartCache];
    const item = cart.find(i => i.name === name);
    if (!item) return;

    const maxQty = Number.isFinite(+item.maxQty) ? Math.max(1, +item.maxQty) : Infinity;
    item.qty += delta;
    if (item.qty > maxQty) {
        item.qty = maxQty;
        alert(`Only ${maxQty} stock available for this item.`);
    }
    if (item.qty <= 0) removeFromCart(name);

    saveCart(cart);
}

function renderCartIcon() {
    if (cartDisabledForEmailLogin) return;
    const count = cartCache.reduce((a,b)=>a+b.qty,0);
    let icon = document.getElementById("cartIcon");
    if (!icon) return;
    const countEl = document.getElementById("cartCount");
if (countEl) countEl.innerText = count;
}

window.addEventListener("load", async () => {
    applyCartAccessByLoginType();
    await syncCartFromAccount();
});

if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(async () => {
        applyCartAccessByLoginType();
        await syncCartFromAccount();
    });
}

const popup = document.getElementById("cartPopup");
const cartIcon = document.getElementById("cartIcon");

cartIcon?.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.toggle("hidden");
    renderCartPopup();
});

document.addEventListener("click", (e) => {
    if (!popup || popup.classList.contains("hidden")) return;
    const clickedInsidePopup = popup.contains(e.target);
    const clickedCartIcon = cartIcon && cartIcon.contains(e.target);
    if (!clickedInsidePopup && !clickedCartIcon) {
        popup.classList.add("hidden");
    }
});

function renderCartPopup() {
    if (cartDisabledForEmailLogin) return;
    const cart = [...cartCache];
    const box = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");

    if (!box) return;

    box.innerHTML = "";
    let total = 0;

    const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();

    cart.forEach(i => {
        const subtotal = i.price * i.qty;
        total += subtotal;

        box.innerHTML += `
        <div class="cartRow">
            <img src="${i.img}">
            <div>
                ${i.name} x${i.qty}<br>
                <span class="stockHint">₱${formatPeso(i.price)} each</span>
            </div>
            <div>₱${formatPeso(subtotal)}</div>
            <button class="removeCartBtn" onclick="removeCartItemAndRefresh('${i.name.replace(/'/g, "\\'")}')">Remove</button>
        </div>
        `;
    });

    // Apply discount if available
    const discountPercentage = parseFloat(localStorage.getItem('discountPercentage')) || 0;
    const discountCode = localStorage.getItem('discountCode') || '';
    let discountAmount = 0;
    let finalTotal = total;

    if (discountPercentage > 0) {
        discountAmount = total * (discountPercentage / 100);
        finalTotal = total - discountAmount;
    }

    // Build total text with discount info
    let totalText = `Subtotal: ₱${formatPeso(total)}`;
    if (discountPercentage > 0) {
        totalText += `<br><span class="discount-info">Discount (${discountPercentage}%): -₱${formatPeso(discountAmount)}</span>`;
        totalText += `<br><strong>Total: ₱${formatPeso(finalTotal)}</strong>`;
        if (discountCode) {
            totalText += `<br><span class="discount-code">Code: ${discountCode}</span>`;
        }
    } else {
        totalText = `Total: ₱${formatPeso(total)}`;
    }

    totalEl.innerHTML = totalText;
}

window.removeCartItemAndRefresh = function (name) {
    removeFromCart(name);
    renderCartPopup();
};

document.getElementById("finalizeOrder")?.addEventListener("click", async () => {
    if (cartDisabledForEmailLogin) {
        alert("Order placement is disabled for email login.");
        return;
    }

    const cart = [...cartCache];

    if (!cart.length) {
        alert("Cart is empty!");
        return;
    }

    // Show the finalize order popup
    showFinalizeOrderPopup(cart);
});

function showFinalizeOrderPopup(cart) {
    const popup = document.getElementById("finalizeOrderPopup");
    const summary = document.getElementById("finalizeOrderSummary");

    if (!popup || !summary) return;

    // Build order summary HTML
    let total = 0;
    let summaryHTML = '';

    const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();

    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        summaryHTML += `
            <div class="order-item">
                <span class="order-item-name">${item.name} x${item.qty}</span>
                <span class="order-item-price">₱${formatPeso(subtotal)}</span>
            </div>
        `;
    });

    // Apply discount if available
    const discountPercentage = parseFloat(localStorage.getItem('discountPercentage')) || 0;
    const discountCode = localStorage.getItem('discountCode') || '';
    let discountAmount = 0;
    let finalTotal = total;

    if (discountPercentage > 0) {
        discountAmount = total * (discountPercentage / 100);
        finalTotal = total - discountAmount;
    }

    // Add total row
    summaryHTML += `
        <div class="order-total">
            <span class="total-label">Total:</span>
            <span class="total-amount">₱${formatPeso(finalTotal)}</span>
        </div>
    `;

    if (discountPercentage > 0) {
        summaryHTML += `
            <div style="margin-top: 10px; color: #90EE90; font-size: 14px;">
                Discount (${discountPercentage}%): -₱${formatPeso(discountAmount)}
            </div>
        `;
        if (discountCode) {
            summaryHTML += `
                <div style="margin-top: 5px; color: #FF4500; font-size: 12px;">
                    Code: ${discountCode}
                </div>
            `;
        }
    }

    summary.innerHTML = summaryHTML;

    // Show popup with animation
    popup.classList.add("active");

    // Store cart data for confirmation
    popup.dataset.cartData = JSON.stringify(cart);
    popup.dataset.discountPercentage = discountPercentage || '';
    popup.dataset.discountCode = discountCode || '';
}

// Cancel button handler
document.getElementById("cancelOrder")?.addEventListener("click", () => {
    const popup = document.getElementById("finalizeOrderPopup");
    if (popup) {
        popup.classList.remove("active");
    }
});

// Confirm button handler
document.getElementById("confirmOrder")?.addEventListener("click", async () => {
    const popup = document.getElementById("finalizeOrderPopup");
    if (!popup) return;

    const cartData = popup.dataset.cartData;
    const discountPercentage = popup.dataset.discountPercentage;
    const discountCode = popup.dataset.discountCode;

    if (!cartData) return;

    const cart = JSON.parse(cartData);

    // Close popup
    popup.classList.remove("active");

    // Finalize the order
    const finalizeRes = await fetch("/orders/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            items: cart,
            discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
            discountCode: discountCode || null
        })
    });

    if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({}));
        alert(err.error || "Failed to place order.");
        return;
    }

    cartCache = [];
    await fetch("/cart", { method: "DELETE" }).catch(() => {});
    document.dispatchEvent(new CustomEvent("cartUpdated"));
    renderCartIcon();
    renderCartPopup();

    // Clear discount from localStorage after successful order
    localStorage.removeItem('discountPercentage');
    localStorage.removeItem('discountCode');

    alert("Order placed!");

    location.href = "/tabs/orders";
});

window.addToCart = addToCart;
window.getCart = getCart;
