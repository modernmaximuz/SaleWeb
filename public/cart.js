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
        found.qty++;
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
    icon.innerText = `🛒 ${count}`;
}

window.addEventListener("load", renderCartIcon);
