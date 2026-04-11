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

// Custom notification modal functions
function showNotificationModal(title, message, icon, buttons = []) {
    const modal = document.getElementById("notificationModal");
    const iconEl = document.getElementById("notificationModalIcon");
    const titleEl = document.getElementById("notificationModalTitle");
    const messageEl = document.getElementById("notificationModalMessage");
    const buttonsEl = document.getElementById("notificationModalButtons");

    iconEl.textContent = icon;
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    buttonsEl.innerHTML = "";
    buttons.forEach(btn => {
        const button = document.createElement("button");
        button.className = `notificationBtn ${btn.type || 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = btn.action;
        buttonsEl.appendChild(button);
    });

    modal.classList.remove("hidden");
}

function closeNotificationModal() {
    document.getElementById("notificationModal").classList.add("hidden");
}

window.updateOrderStatus = async function updateOrderStatus(i, status) {
    const user = firebase.auth().currentUser;
    if (!user) {
        showNotificationModal(
            "Authentication Required",
            "Admin login required to perform this action.",
            "🔒",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    if (status === "declined") {
        showNotificationModal(
            "Decline Order",
            "Please state your reason for declining this order:",
            "📝",
            []
        );
        
        // Add input field and buttons
        const messageEl = document.getElementById("notificationModalMessage");
        const buttonsEl = document.getElementById("notificationModalButtons");
        
        const input = document.createElement("textarea");
        input.id = "declineReasonInput";
        input.placeholder = "Enter decline reason...";
        messageEl.style.display = "none";
        messageEl.parentNode.insertBefore(input, buttonsEl);
        
        buttonsEl.innerHTML = `
            <button class="notificationBtn secondary" onclick="closeNotificationModal()">Cancel</button>
            <button class="notificationBtn danger" onclick="confirmDecline(${i})">Decline Order</button>
        `;
        
        input.focus();
        return;
    }

    // For accept action
    showNotificationModal(
        "Accept Order",
        "Are you sure you want to accept this order? This action cannot be undone.",
        "✅",
        [
            { text: "Cancel", type: "secondary", action: closeNotificationModal },
            { text: "Accept Order", type: "success", action: () => confirmUpdateOrderStatus(i, status) }
        ]
    );
};

window.confirmDecline = async function confirmDecline(i) {
    const input = document.getElementById("declineReasonInput");
    const declineReason = input ? input.value.trim() : "";
    
    if (!declineReason) {
        showNotificationModal(
            "Reason Required",
            "A decline reason is required.",
            "⚠️",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }
    
    await confirmUpdateOrderStatus(i, "declined", declineReason);
};

window.confirmUpdateOrderStatus = async function confirmUpdateOrderStatus(i, status, declineReason = "") {
    const user = firebase.auth().currentUser;
    if (!user) return;

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
        showNotificationModal(
            "Error",
            err.error || "Failed to update order.",
            "❌",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    const statusText = status === "accepted" ? "accepted" : status === "declined" ? "declined" : status;
    showNotificationModal(
        "Success",
        `Order ${statusText} successfully!`,
        "✅",
        [{ text: "OK", type: "primary", action: () => { closeNotificationModal(); loadOrders(); } }]
    );
};

window.removeOrder = async function removeOrder(i) {
    const user = firebase.auth().currentUser;
    if (!user) {
        showNotificationModal(
            "Authentication Required",
            "Admin login required to perform this action.",
            "🔒",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    const order = ordersCache[i];
    if (!order) return;

    showNotificationModal(
        "Remove Order",
        `Are you sure you want to remove this order from ${order.user}? This action cannot be undone.`,
        "🗑️",
        [
            { text: "Cancel", type: "secondary", action: closeNotificationModal },
            { text: "Remove Order", type: "danger", action: () => confirmRemoveOrder(i) }
        ]
    );
};

window.confirmRemoveOrder = async function confirmRemoveOrder(i) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const order = ordersCache[i];
    if (!order) return;

    const token = await user.getIdToken();
    const res = await fetch(`/delete-order-result`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId: order.id })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotificationModal(
            "Error",
            err.error || "Failed to remove order.",
            "",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    showNotificationModal(
        "Success",
        "Order removed successfully!",
        "",
        [{ text: "OK", type: "primary", action: () => { closeNotificationModal(); loadOrders(); } }]
    );
};

window.deleteFinalResult = async function deleteFinalResult(i) {
    const user = firebase.auth().currentUser;
    if (!user) {
        showNotificationModal(
            "Authentication Required",
            "Admin login required to perform this action.",
            "",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    const order = ordersCache[i];
    if (!order) return;

    showNotificationModal(
        "Delete Final Result",
        `Are you sure you want to delete the final result for this order from ${order.user}? The order will be reset to pending status.`,
        "",
        [
            { text: "Cancel", type: "secondary", action: closeNotificationModal },
            { text: "Delete Result", type: "danger", action: () => confirmDeleteFinalResult(i) }
        ]
    );
};

window.confirmDeleteFinalResult = async function confirmDeleteFinalResult(i) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const token = await user.getIdToken();
    const res = await fetch(`/orders/${i}/result`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotificationModal(
            "Error",
            err.error || "Failed to delete final result.",
            "",
            [{ text: "OK", type: "primary", action: closeNotificationModal }]
        );
        return;
    }

    showNotificationModal(
        "Success",
        "Final result deleted successfully! Order reset to pending.",
        "",
        [{ text: "OK", type: "primary", action: () => { closeNotificationModal(); loadOrders(); } }]
    );
};

function renderOrderRow(order, index, admin, customResultText) {
    const result = order.status || "pending";
    const resultLabel = customResultText || RESULT_LABELS[result] || "Pending";
    const reasonPart = order.declineReason ? `<div class="orderReason">Reason: ${order.declineReason}</div>` : "";
    const transactionId = order.transactionId ? `<div class="transactionId"><strong>Transaction ID:</strong> ${order.transactionId}</div>` : "";
    
    // Determine if admin can remove this order
    const canRemove = admin && ['accepted', 'success', 'declined', 'scammer_alert', 'wrong_order', 'cancelled'].includes(result);
    
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
            ${transactionId}
            ${reasonPart}
        </div>
        <div class="orderActions">
            <button class="orderActionBtn viewBtn" onclick="viewOrder(${index})">View Order</button>
            ${admin && result === "pending" ? `
            <button class="orderActionBtn" onclick="updateOrderStatus(${index}, 'accepted')">Accept</button>
            <button class="orderActionBtn declineBtn" onclick="updateOrderStatus(${index}, 'declined')">Decline</button>
            ` : ""}
            ${canRemove ? `
            <button class="orderActionBtn danger" onclick="removeOrder(${index})">Remove</button>
            ` : ""}
            ${admin && order.transactionId ? `
            <button class="orderActionBtn proofBtn" onclick="window.open('/tabs/proofs.html', '_blank')">Upload Proof</button>
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
            waitingList.innerHTML += renderOrderRow(o, i, admin);
        });

    acceptedEntries
        .sort((a, b) => new Date(b.o.date).getTime() - new Date(a.o.date).getTime())
        .forEach(({ o, i }) => {
            acceptedList.innerHTML += renderOrderRow(o, i, admin);
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

// Notification modal event listeners
document.getElementById("notificationModal")?.addEventListener("click", (e) => {
    if (e.target.id === "notificationModal") closeNotificationModal();
});
document.getElementById("toggleFinalSort")?.addEventListener("click", () => {
    document.getElementById("finalSortPanel")?.classList.toggle("hidden");
});
document.getElementById("finalSortOrder")?.addEventListener("change", loadOrders);
document.getElementById("finalFilterType")?.addEventListener("change", loadOrders);
loadOrders();
