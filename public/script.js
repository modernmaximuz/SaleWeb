// Set Firebase session persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

// DOM elements
const profileBox = document.getElementById("profileBox");
const profileName = document.getElementById("profileName");
const profileDropdown = document.getElementById("profileDropdown");
const profileMain = document.getElementById("profileMain");
const loginToggle = document.getElementById("loginToggle");
const discordBtn = document.getElementById("discordBtn");
const editor = document.getElementById("editor");
const content = document.getElementById("content");

let token = null;
let saveTimeout = null;
let currentData = {};

// ------------------ PROFILE UI HELPER ------------------
function showProfile(user, type) {
    profileBox.classList.remove("hidden");
    if (loginToggle) loginToggle.style.display = "none";
    if (discordBtn) discordBtn.style.display = "none";

    const avatar = document.querySelector(".avatar");

    if (type === "discord") {
        profileName.textContent = user.username;
        if (avatar) {
            avatar.style.backgroundImage = `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png)`;
            avatar.style.backgroundSize = "cover";
        }
    } else {
        profileName.textContent = user.email;
        if (avatar) {
            avatar.style.backgroundImage = "";
        }
    }
}

function resetUI() {
    profileBox.classList.add("hidden");
    if (loginToggle) loginToggle.style.display = "inline-block";
    if (discordBtn) discordBtn.style.display = "inline-block";
    if (editor) editor.style.display = "none";
}

// ------------------ DISCORD LOGIN ------------------
async function initDiscordUI() {
    try {
        const res = await fetch("/me");
        const user = await res.json();
        if (!user) return;

        // If Firebase is logged in, log it out
        if (firebase.auth().currentUser) {
            await firebase.auth().signOut();
        }

        showProfile(user, "discord");
    } catch (err) {
        console.error("Discord UI init error:", err);
    }
}
initDiscordUI();

// ------------------ FIREBASE LOGIN ------------------
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
        // Clear Discord cookie if Firebase logs in
        await fetch("/logout-discord");

        token = await user.getIdToken();

        showProfile(user, "firebase");

        if (editor) editor.style.display = "block";

        setupAutoSave();
        await loadPaste();
    } catch (err) {
        console.error("Auth state change error:", err);
    }
});

// ------------------ LOGOUT ------------------
document.getElementById("logoutBtn").onclick = async () => {
    try {
        if (firebase.auth().currentUser) {
            await firebase.auth().signOut();
        }

        await fetch("/logout-discord");

        resetUI();
    } catch (err) {
        console.error("Logout error:", err);
    }
};

// ------------------ PROFILE DROPDOWN ------------------
profileMain?.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("hidden");
});

document.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
});

// ------------------ AUTO SAVE ------------------
function setupAutoSave() {
    if (!content) return;

    content.addEventListener("input", () => {
        if (!token) return;
        clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            try {
                await fetch("/save/fZ3piaUg", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: content.value })
                });
            } catch (err) {
                console.error("Auto-save failed:", err);
            }
        }, 800);
    });
}

// ------------------ LOAD / RENDER ------------------
async function loadPaste() {
    try {
        const res = await fetch("/load/fZ3piaUg");
        const data = await res.json();
        currentData = JSON.parse(data.content || "{}");
        renderEditor();
    } catch (err) {
        console.error("Load paste error:", err);
    }
}

function renderEditor() {
    const container = document.getElementById("editorItems");
    if (!container) return;
    container.innerHTML = "";

    const mm2 = currentData.mm2 || {};
    for (let item in mm2) {
        const row = document.createElement("div");
        row.innerHTML = `
            <span>${item}</span>
            <button onclick="changeStock('${item}', -1)">-</button>
            <span>${mm2[item]}</span>
            <button onclick="changeStock('${item}', 1)">+</button>
        `;
        container.appendChild(row);
    }
}

// ------------------ CHANGE STOCK ------------------
async function changeStock(item, amount) {
    if (!token) return;

    if (!currentData.mm2) currentData.mm2 = {};
    if (!currentData.mm2[item]) currentData.mm2[item] = 0;

    currentData.mm2[item] += amount;
    if (currentData.mm2[item] < 0) currentData.mm2[item] = 0;

    await fetch("/save/fZ3piaUg", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            content: JSON.stringify(currentData, null, 2)
        })
    });

    renderEditor();
}
