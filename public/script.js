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
    if (loginToggle) {
        loginToggle.style.display = "inline-block";
        loginToggle.textContent = "Admin";
        loginToggle.title = "Admin email login only";
    }
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
resetUI();

// ------------------ FIREBASE LOGIN ------------------
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
        // Clear Discord cookie if Firebase logs in
        await fetch("/logout-discord");

        token = await user.getIdToken();

        showProfile(user, "firebase");

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

        // 🔥 FORCE REDIRECT EVERY TIME
        window.location.href = "/";
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

// ===== GLOBAL AUTH CHECK (used by navbar & pages) =====
window.isLoggedIn = async function () {
    // Check Firebase
    if (firebase.auth().currentUser) return true;

    // Check Discord cookie
    const res = await fetch("/me");
    const user = await res.json();
    return !!user;
};
