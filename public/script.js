// Set Firebase session persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

// DOM elements
const profileBox = document.getElementById("profileBox");
const profileName = document.getElementById("profileName");
const profileDropdown = document.getElementById("profileDropdown");
const profileMain = document.getElementById("profileMain");
const loginToggle = document.getElementById("loginToggle");
const loginBox = document.getElementById("loginBox");
const discordBtn = document.getElementById("discordBtn");
const editor = document.getElementById("editor");
const content = document.getElementById("content");
const errorP = document.getElementById("error");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");

let token = null;
let saveTimeout = null;
let currentData = {};

// ------------------ Discord UI ------------------
async function initDiscordUI() {
    try {
        const res = await fetch("/me");
        const user = await res.json();
        if (!user) return;

        // Sign out Firebase user if logged in
        if (firebase.auth().currentUser) {
            await firebase.auth().signOut();
        }

        // Show Discord profile UI
        profileBox.classList.remove("hidden");
        loginToggle.style.display = "none";
        if (discordBtn) discordBtn.style.display = "none";
        profileName.textContent = user.username;

        const avatar = document.querySelector(".avatar");
        if (avatar) {
            avatar.style.backgroundImage = `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png)`;
            avatar.style.backgroundSize = "cover";
        }
    } catch (err) {
        console.error("Discord UI init error:", err);
    }
}
initDiscordUI();

// ------------------ Firebase Auth ------------------
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
        await fetch("/logout-discord"); // logout Discord session if any

        token = await user.getIdToken();

        if (editor) editor.style.display = "block";
        if (discordBtn) discordBtn.style.display = "none";
        profileBox.classList.remove("hidden");
        loginToggle.style.display = "none";
        profileName.textContent = user.email || "User";

        setupAutoSave(); // attach input listener
        await loadPaste(); // load current data
    } catch (err) {
        console.error("Auth state change error:", err);
    }
});

// ------------------ Login / Logout ------------------
if (loginToggle) {
    loginToggle.onclick = () => {
        if (!loginBox) return;
        loginBox.style.display = loginBox.style.display === "block" ? "none" : "block";
    };
}

// Email/password login
document.getElementById("loginBtn").onclick = async () => {
    try {
        await firebase.auth().signInWithEmailAndPassword(emailInput.value, passInput.value);
        errorP.textContent = "";
        if (loginBox) loginBox.style.display = "none";
    } catch (err) {
        errorP.textContent = err.message;
    }
};

// Logout
document.getElementById("logoutBtn").onclick = async () => {
    try {
        await firebase.auth().signOut();
        await fetch("/logout-discord");

        // Reset UI
        profileBox.classList.add("hidden");
        if (editor) editor.style.display = "none";
        loginToggle.style.display = "inline-block";
        if (discordBtn) discordBtn.style.display = "inline-block";
    } catch (err) {
        console.error("Logout error:", err);
    }
};

// ------------------ Profile Dropdown ------------------
if (profileMain) {
    profileMain.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle("hidden");
    });
}
if (profileDropdown) {
    profileDropdown.addEventListener("click", (e) => e.stopPropagation());
}
document.addEventListener("click", () => profileDropdown.classList.add("hidden"));

// ------------------ Auto-save ------------------
function setupAutoSave() {
    if (!content) return;

    content.addEventListener("input", () => {
        if (!token) return;
        clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            try {
                await fetch("/save", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: content.value })
                });
                console.log("Auto-saved");
            } catch (err) {
                console.error("Auto-save failed:", err);
            }
        }, 800);
    });
}

// ------------------ Load / Render Paste ------------------
async function loadPaste() {
    try {
        const res = await fetch("/load", {
            headers: { Authorization: `Bearer ${token}` }
        });
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

// ------------------ Change Stock ------------------
async function changeStock(item, amount) {
    if (!token) return;

    if (!currentData.mm2) currentData.mm2 = {};
    if (!currentData.mm2[item]) currentData.mm2[item] = 0;

    currentData.mm2[item] += amount;
    if (currentData.mm2[item] < 0) currentData.mm2[item] = 0;

    try {
        await fetch("/save", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content: JSON.stringify(currentData, null, 2) })
        });
        renderEditor();
    } catch (err) {
        console.error("Change stock error:", err);
    }
}
