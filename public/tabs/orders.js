const ORDER_PASTE = "OQooMS9z";
let ordersCache = [];

const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();

async function isAdminUser() {
    return !!(window.firebase && firebase.auth && firebase.auth().currentUser);
}

window.viewOrder = function viewOrder(i) {
    const order = ordersCache[i];
    if (!order) return;

    const lines = (order.items || []).map(item => {
        const subtotal = Number(item.price || 0) * Number(item.qty || 0);
        return `- ${item.name} x${item.qty} = ₱${formatPeso(subtotal)}`;
    });
    const total = (order.items || []).reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
        0
    );

    alert(`${order.user} | ${new Date(order.date).toLocaleString()}\n\n${lines.join("\n")}\n\nTotal: ₱${formatPeso(total)}`);
};

window.updateOrderStatus = async function updateOrderStatus(i, status) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Admin login required.");
        return;
    }

    const token = await user.getIdToken();
    const res = await fetch(`/orders/${i}/status`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update order.");
        return;
    }

    alert(`Order ${status}.`);
    await loadOrders();
};

async function loadOrders() {
    const res = await fetch(`/load/${ORDER_PASTE}`);
    const json = await res.json();
    const orders = JSON.parse(json.content || "[]");
    ordersCache = orders;

    const admin = await isAdminUser();
    const list = document.getElementById("ordersList");
    list.innerHTML = "";

    orders.forEach((o, i) => {
        list.innerHTML += `
        <div class="orderRow">
            User: ${o.user} | Date: ${new Date(o.date).toLocaleString()} | Status: ${o.status}
            <button onclick="viewOrder(${i})">View Order</button>
            ${admin ? `
            <button onclick="updateOrderStatus(${i}, 'accepted')">Accept</button>
            <button onclick="updateOrderStatus(${i}, 'declined')">Decline</button>
            ` : ""}
        </div>`;
    });
}

if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(loadOrders);
}
loadOrders();
