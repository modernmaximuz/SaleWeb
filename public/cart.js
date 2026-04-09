const CART_KEY = "hades_cart";
let cartDisabledForEmailLogin = false;

function isEmailLoginActive() {
    return !!firebase.auth().currentUser;
}

function applyCartAccessByLoginType() {
    const icon = document.getElementById("cartIcon");
    const popupEl = document.getElementById("cartPopup");

    cartDisabledForEmailLogin = isEmailLoginActive();

    if (cartDisabledForEmailLogin) {
        localStorage.removeItem(CART_KEY);
        if (icon) icon.style.display = "none";
        if (popupEl) popupEl.classList.add("hidden");
        return;
    }

    if (icon) icon.style.display = "";
}

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartIcon();
}

function addToCart(item) {
    if (cartDisabledForEmailLogin) {
        alert("Cart is disabled for email login.");
        return;
    }

    const cart = getCart();
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

    saveCart(cart);
}

function removeFromCart(name) {
    if (cartDisabledForEmailLogin) return;
    let cart = getCart().filter(i => i.name !== name);
    saveCart(cart);
}

function changeQty(name, delta) {
    if (cartDisabledForEmailLogin) return;
    if (window.location.pathname === "/tabs/orders" && delta > 0) {
        alert("Add more items from the shop page.");
        return;
    }
    const cart = getCart();
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
    const count = getCart().reduce((a,b)=>a+b.qty,0);
    let icon = document.getElementById("cartIcon");
    if (!icon) return;
    const countEl = document.getElementById("cartCount");
if (countEl) countEl.innerText = count;
}

window.addEventListener("load", renderCartIcon);
window.addEventListener("load", applyCartAccessByLoginType);

firebase.auth().onAuthStateChanged(() => {
    applyCartAccessByLoginType();
    renderCartIcon();
});

const popup = document.getElementById("cartPopup");

document.getElementById("cartIcon")?.addEventListener("click", () => {
    popup.classList.remove("hidden");
    renderCartPopup();
});

popup?.addEventListener("click", (e) => {
    if (e.target.id === "cartPopup") {
        popup.classList.add("hidden");
    }
});

function renderCartPopup() {
    if (cartDisabledForEmailLogin) return;
    const cart = getCart();
    const box = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");

    if (!box) return;

    box.innerHTML = "";
    let total = 0;

    cart.forEach(i => {
        const subtotal = i.price * i.qty;
        total += subtotal;

        box.innerHTML += `
        <div class="cartRow">
            <img src="${i.img}">
            <div>
                ${i.name} x${i.qty}<br>
                <span class="stockHint">Stock info shown here</span>
            </div>
            <div>₱${subtotal}</div>
        </div>
        `;
    });

    totalEl.innerText = `Total: ₱${total}`;
}

document.getElementById("finalizeOrder")?.addEventListener("click", async () => {
    if (cartDisabledForEmailLogin) {
        alert("Order placement is disabled for email login.");
        return;
    }

    const user = await (await fetch("/me")).json();
    const cart = getCart();

    if (!cart.length) {
        alert("Cart is empty!");
        return;
    }

    // 🔥 CHECK EXISTING ORDERS
const existingOrders = await fetch(`/load/OQooMS9z`)
    .then(res => res.json())
    .then(json => JSON.parse(json.content || "[]"));

const hasPending = existingOrders.find(o =>
    o.discordId === user.id && o.status === "pending"
);

if (hasPending) {
    alert("You already have a pending order!");
    return;
}

// ✅ CREATE ORDER
const order = {
    user: user.username,
    discordId: user.id,
    date: new Date().toISOString(),
    items: cart,
    status: "pending"
};

// ✅ SAVE ORDER
await fetch(`/load/OQooMS9z`)
    .then(res => res.json())
    .then(async json => {
        const data = JSON.parse(json.content || "[]");
        data.push(order);

        await fetch(`/save/OQooMS9z`, {
            method:"PUT",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
                content: JSON.stringify(data,null,2)
            })
        });
    });

    localStorage.removeItem("hades_cart");
    alert("Order placed!");

    location.href = "/tabs/orders"; // now THIS is correct usage
});
