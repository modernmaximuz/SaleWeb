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
    const reasonPart = order.declineReason ? ` | Reason: ${order.declineReason}` : "";
    meta.textContent = `Date: ${new Date(order.date).toLocaleString()} | Result: ${RESULT_LABELS[order.status] || "Pending"}${reasonPart}`;

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

    let declineReason = "";
    if (status === "declined") {
        declineReason = prompt("State your reason for declining this order:") || "";
        if (!declineReason.trim()) {
            alert("Decline reason is required.");
            return;
        }
    }

    const token = await user.getIdToken();
    const res = await fetch(`/orders/${i}/status`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, declineReason })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update order.");
        return;
    }

    alert(`Order ${status}.`);
    await loadOrders();
};

function renderOrderRow(order, index, admin, customResultText) {
    const result = order.status || "pending";
    const resultLabel = customResultText || RESULT_LABELS[result] || "Pending";
    const reasonPart = order.declineReason ? `<div class="orderReason">Reason: ${order.declineReason}</div>` : "";
    return `
    <div class="orderRow">
        <div class="orderMeta">
            <div class="orderPrimary">
                <span class="metaText"><strong>User:</strong> ${order.user}</span>
                <span class="metaDivider">|</span>
                <span class="metaText"><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</span>
            </div>
            <div class="orderResultLine">
                <span>Result:</span>
                <span class="resultBadge result-${result}">${resultLabel}</span>
            </div>
            ${reasonPart}
        </div>
        <div class="orderActions">
            <button class="orderActionBtn viewBtn" onclick="viewOrder(${index})">View Order</button>
            ${admin && result === "pending" ? `
            <button class="orderActionBtn" onclick="updateOrderStatus(${index}, 'accepted')">Accept</button>
            <button class="orderActionBtn declineBtn" onclick="updateOrderStatus(${index}, 'declined')">Decline</button>
            ` : ""}
        </div>
    </div>`;
}

function applyFinalSortAndFilter(entries) {
    const sortMode = document.getElementById("finalSortOrder")?.value || "newest";
    const filterMode = document.getElementById("finalFilterType")?.value || "all";

    let filtered = entries;
    if (filterMode !== "all") {
        filtered = entries.filter(({ o }) => o.status === filterMode);
    }

    const sorted = [...filtered];
    if (sortMode === "newest") {
        sorted.sort((a, b) => new Date(b.o.date).getTime() - new Date(a.o.date).getTime());
    } else {
        sorted.sort((a, b) => new Date(a.o.date).getTime() - new Date(b.o.date).getTime());
    }
    return sorted;
}

function updateFinalCounts(finalEntries) {
    const count = (status) => finalEntries.filter(({ o }) => o.status === status).length;
    const unsuccessfulCount = count("wrong_order") + count("cancelled");

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    set("countSuccess", `Success: ${count("success")}`);
    set("countUnsuccessful", `Unsuccessful: ${unsuccessfulCount}`);
    set("countScam", `Scammer Alert: ${count("scammer_alert")}`);
    set("countDeclined", `Declined: ${count("declined")}`);
}

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

    const indexedOrders = orders.map((o, i) => ({ o, i }));
    const admin = await isAdminUser();
    const waitingList = document.getElementById("waitingOrdersList");
    const acceptedList = document.getElementById("acceptedOrdersList");
    const finalList = document.getElementById("finalOrdersList");

    waitingList.innerHTML = "";
    acceptedList.innerHTML = "";
    finalList.innerHTML = "";

    const waitingEntries = indexedOrders.filter(({ o }) => (o.status || "pending") === "pending");
    const acceptedEntries = indexedOrders.filter(({ o }) => o.status === "accepted");
    const finalEntries = indexedOrders.filter(({ o }) =>
        ["success", "declined", "scammer_alert", "wrong_order", "cancelled"].includes(o.status)
    );

    waitingEntries
        .sort((a, b) => new Date(b.o.date).getTime() - new Date(a.o.date).getTime())
        .forEach(({ o, i }) => {
            waitingList.innerHTML += renderOrderRow(o, i, admin, "Waiting for someone to accept...");
        });

    acceptedEntries
        .sort((a, b) => new Date(b.o.date).getTime() - new Date(a.o.date).getTime())
        .forEach(({ o, i }) => {
            acceptedList.innerHTML += renderOrderRow(o, i, admin, "Pending");
        });

    const finalRendered = applyFinalSortAndFilter(finalEntries);
    finalRendered.forEach(({ o, i }) => {
        finalList.innerHTML += renderOrderRow(o, i, false);
    });

    updateFinalCounts(finalEntries);
}

if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(loadOrders);
}
document.getElementById("closeOrderModal")?.addEventListener("click", closeOrderModal);
document.getElementById("orderModal")?.addEventListener("click", (e) => {
    if (e.target.id === "orderModal") closeOrderModal();
});
document.getElementById("toggleFinalSort")?.addEventListener("click", () => {
    document.getElementById("finalSortPanel")?.classList.toggle("hidden");
});
document.getElementById("finalSortOrder")?.addEventListener("change", loadOrders);
document.getElementById("finalFilterType")?.addEventListener("change", loadOrders);
loadOrders();
