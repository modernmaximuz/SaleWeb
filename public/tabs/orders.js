const ORDER_PASTE = "OQooMS9z";
let ordersCache = [];

const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();
const RESULT_LABELS = {
    pending: "Pending",
    accepted: "Accepted",
    success: "Success",
    scammer_alert: "Scammer Alert",
    wrong_order: "Wrong Order",
    cancelled: "Cancelled",
    declined: "Declined"
};

const RESULT_PRIORITY = {
    success: 0,
    scammer_alert: 1,
    wrong_order: 2,
    cancelled: 3,
    accepted: 4,
    pending: 5,
    declined: 6
};

async function isAdminUser() {
    return !!(window.firebase && firebase.auth && firebase.auth().currentUser);
}

function openOrderModal(order) {
    const modal = document.getElementById("orderModal");
    const title = document.getElementById("orderModalTitle");
    const meta = document.getElementById("orderModalMeta");
    const itemsEl = document.getElementById("orderModalItems");
    const totalEl = document.getElementById("orderModalTotal");

    title.textContent = `${order.user}'s Order`;
    meta.textContent = `Date: ${new Date(order.date).toLocaleString()} | Result: ${RESULT_LABELS[order.status] || "Pending"}`;

    const items = Array.isArray(order.items) ? order.items : [];
    let total = 0;
    itemsEl.innerHTML = "";

    items.forEach(item => {
        const subtotal = Number(item.price || 0) * Number(item.qty || 0);
        total += subtotal;
        itemsEl.innerHTML += `
        <div class="modalItemRow">
            <span>${item.name} x${item.qty}</span>
            <span>₱${formatPeso(subtotal)}</span>
        </div>`;
    });

    totalEl.textContent = `Total: ₱${formatPeso(total)}`;
    modal.classList.remove("hidden");
}

function closeOrderModal() {
    document.getElementById("orderModal")?.classList.add("hidden");
}

window.viewOrder = function viewOrder(i) {
    const order = ordersCache[i];
    if (!order) return;
    openOrderModal(order);
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
    let orders = [];
    try {
        const parsed = JSON.parse(json.content || "[]");
        orders = Array.isArray(parsed) ? parsed : [];
    } catch {
        orders = [];
    }
    ordersCache = orders;

    const admin = await isAdminUser();
    const list = document.getElementById("ordersList");
    list.innerHTML = "";

    const indexedOrders = orders.map((o, i) => ({ o, i }));
    indexedOrders.sort((a, b) => {
        const pa = RESULT_PRIORITY[a.o.status] ?? 9;
        const pb = RESULT_PRIORITY[b.o.status] ?? 9;
        if (pa !== pb) return pa - pb;
        return new Date(b.o.date).getTime() - new Date(a.o.date).getTime();
    });

    indexedOrders.forEach(({ o, i }) => {
        const result = o.status || "pending";
        const resultLabel = RESULT_LABELS[result] || "Pending";
        list.innerHTML += `
        <div class="orderRow">
            <span>User: ${o.user}</span>
            <span>|</span>
            <span>Date: ${new Date(o.date).toLocaleString()}</span>
            <span>|</span>
            <span>Result:</span>
            <span class="resultBadge result-${result}">${resultLabel}</span>
            <button onclick="viewOrder(${i})">View Order</button>
            ${admin ? `
            <button onclick="updateOrderStatus(${i}, 'accepted')">Accept</button>
            <button onclick="updateOrderStatus(${i}, 'cancelled')">Decline</button>
            ` : ""}
        </div>`;
    });
}

if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(loadOrders);
}
document.getElementById("closeOrderModal")?.addEventListener("click", closeOrderModal);
document.getElementById("orderModal")?.addEventListener("click", (e) => {
    if (e.target.id === "orderModal") closeOrderModal();
});
loadOrders();
