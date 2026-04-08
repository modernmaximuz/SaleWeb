const CART_KEY = "hades_cart";

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartIcon();
}

function addToCart(item) {
    const cart = getCart();
    const found = cart.find(i => i.name === item.name);

    if (found) {
        found.qty += item.qty || 1;
    } else {
        cart.push({ ...item, qty: 1 });
    }

    saveCart(cart);
}

function removeFromCart(name) {
    let cart = getCart().filter(i => i.name !== name);
    saveCart(cart);
}

function changeQty(name, delta) {
    const cart = getCart();
    const item = cart.find(i => i.name === name);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) removeFromCart(name);

    saveCart(cart);
}

function renderCartIcon() {
    const count = getCart().reduce((a,b)=>a+b.qty,0);
    let icon = document.getElementById("cartIcon");
    if (!icon) return;
    const countEl = document.getElementById("cartCount");
if (countEl) countEl.innerText = count;
}

window.addEventListener("load", renderCartIcon);

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
