const ORDER_PASTE = "OQooMS9z";

function renderCart() {
    const cart = getCart();
    const box = document.getElementById("cartView");
    box.innerHTML = "";

    cart.forEach(i => {
        box.innerHTML += `
        <div class="cartItem">
            <img src="${i.img}">
            ${i.name} x${i.qty}
            <button onclick="changeQty('${i.name}',1)">+</button>
            <button onclick="changeQty('${i.name}',-1)">-</button>
            <button onclick="removeFromCart('${i.name}')">Remove</button>
        </div>`;
    });
}
renderCart();

document.getElementById("placeOrder").onclick = async () => {
    const user = await (await fetch("/me")).json();
    const cart = getCart();

    const order = {
        user: user.username,
        discordId: user.id,
        date: new Date().toISOString(),
        items: cart,
        status: "pending"
    };

    const res = await fetch(`/load/${ORDER_PASTE}`);
    const json = await res.json();
    const data = JSON.parse(json.content || "[]");

    data.push(order);

    await fetch(`/save/${ORDER_PASTE}`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ content: JSON.stringify(data,null,2) })
    });

    localStorage.removeItem("hades_cart");
    alert("Order placed!");
};

async function loadOrders() {
    const res = await fetch(`/load/${ORDER_PASTE}`);
    const json = await res.json();
    const orders = JSON.parse(json.content || "[]");

    const me = await (await fetch("/me")).json();
    const list = document.getElementById("ordersList");
    list.innerHTML = "";

    orders.forEach((o, i) => {
        list.innerHTML += `
        <div class="orderRow">
            User: ${o.user} | ${o.date}
            <button onclick="viewOrder(${i})">View Order</button>
            ${me && me.username === "YOUR_ADMIN_NAME" ? `
            <button onclick="acceptOrder(${i})">Accept</button>
            <button onclick="declineOrder(${i})">Decline</button>
            `:""}
        </div>`;
    });

    window._orders = orders;
}
loadOrders();
