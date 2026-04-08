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
    alert("You already added this item!");
    return;
}
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

document.getElementById("finalizeOrder")?.addEventListener("click", async () => {
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
