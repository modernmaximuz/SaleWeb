// Set Firebase session persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

// DOM elements
const profileBox = document.getElementById("profileBox");
const profileName = document.getElementById("profileName");
const profileDropdown = document.getElementById("profileDropdown");
const profileMain = document.getElementById("profileMain");
const loginToggle = document.getElementById("loginToggle");
const editor = document.getElementById("editor");
const content = document.getElementById("content");

let token = null;
let saveTimeout = null;
let currentData = {};

// ------------------ PROFILE UI HELPER ------------------
function showProfile(user, type) {
    profileBox.classList.remove("hidden");
    if (loginToggle) loginToggle.style.display = "none";

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

    // Add admin options for Firebase users
    updateProfileDropdown(type === "firebase");
}

function updateProfileDropdown(isAdmin) {
    const profileDropdown = document.getElementById("profileDropdown");
    if (!profileDropdown) return;

    if (isAdmin) {
        profileDropdown.innerHTML = `
            <button id="logoutBtn">Logout</button>
            <button id="profileConfigBtn">Configure Profile</button>
            <button onclick="location.href='/restocks'">Manage Restocks</button>
        `;
    } else {
        profileDropdown.innerHTML = `
            <button id="logoutBtn">Logout</button>
        `;
    }
}

function resetUI() {
    profileBox.classList.add("hidden");
    if (loginToggle) {
        loginToggle.style.display = "inline-flex";
        loginToggle.innerHTML = `
            <img class="loginBtnIcon" src="/images/discordlogo.png" alt="Discord">
            <span>Login</span>
        `;
        loginToggle.title = "Login with Discord (Admin login is optional)";
    }
    if (editor) editor.style.display = "none";
}

function ensureLoginModal() {
    if (document.getElementById("loginModal")) return;

    const modal = document.createElement("div");
    modal.id = "loginModal";
    modal.className = "hidden";
    modal.innerHTML = `
        <div id="loginModalBox">
            <button id="closeLoginModal" aria-label="Close">×</button>
            <h2>Login using Discord</h2>
            <p>Fast and recommended for all customers.</p>
            <button id="modalDiscordLogin">
                <img src="/images/discordlogo.png" alt="Discord">
                Continue with Discord
            </button>
            <div class="adminDivider">Admin login (email only)</div>
            <input type="email" id="adminEmailInput" placeholder="Admin Email">
            <input type="password" id="adminPasswordInput" placeholder="Admin Password">
            <button id="modalAdminLogin">Login as Admin</button>
            <p id="loginModalError"></p>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("modalDiscordLogin")?.addEventListener("click", () => {
        window.location.href = "/auth/discord";
    });

    document.getElementById("modalAdminLogin")?.addEventListener("click", async () => {
        const email = document.getElementById("adminEmailInput")?.value || "";
        const password = document.getElementById("adminPasswordInput")?.value || "";
        const errorEl = document.getElementById("loginModalError");
        if (errorEl) errorEl.textContent = "";
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            modal.classList.add("hidden");
            window.location.href = "/";
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message || "Admin login failed.";
        }
    });

    document.getElementById("closeLoginModal")?.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    modal.addEventListener("click", (e) => {
        if (e.target.id === "loginModal") modal.classList.add("hidden");
    });
}

function openLoginModal() {
    ensureLoginModal();
    document.getElementById("loginModal")?.classList.remove("hidden");
}
window.openLoginModal = openLoginModal;

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
ensureLoginModal();

loginToggle?.removeAttribute("onclick");
loginToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    openLoginModal();
});

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
document.addEventListener("click", async (e) => {
    if (e.target.id === "logoutBtn") {
        try {
            if (firebase.auth().currentUser) {
                await firebase.auth().signOut();
            }

            await fetch("/logout-discord");

            resetUI();

            // Force redirect every time
            window.location.href = "/";
        } catch (err) {
            console.error("Logout error:", err);
        }
    }
    
    if (e.target.id === "profileConfigBtn") {
        openProfileConfigModal();
    }
});

// ------------------ PROFILE DROPDOWN ------------------
profileMain?.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("hidden");
});

document.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
});

// ------------------ PROFILE CONFIGURATION ------------------
function openProfileConfigModal() {
    loadProfileData();
    document.getElementById("profileConfigModal").classList.remove("hidden");
}

function closeProfileConfigModal() {
    document.getElementById("profileConfigModal").classList.add("hidden");
}

async function loadProfileData() {
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch("/admin/profile", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            const profile = await res.json();
            document.getElementById("displayName").value = profile.displayName || '';
            document.getElementById("avatarUrl").value = profile.avatar || '';
            updateAvatarPreview();
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

function updateAvatarPreview() {
    const avatarUrl = document.getElementById("avatarUrl").value.trim();
    const previewImg = document.getElementById("avatarPreviewImg");
    
    if (avatarUrl) {
        previewImg.src = avatarUrl;
        previewImg.onerror = () => {
            previewImg.src = "/images/default-avatar.png";
        };
    } else {
        previewImg.src = "/images/default-avatar.png";
    }
}

async function saveProfile() {
    const displayName = document.getElementById("displayName").value.trim();
    const avatarUrl = document.getElementById("avatarUrl").value.trim();
    
    if (!displayName) {
        alert('Display name is required.');
        return;
    }
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch("/admin/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ displayName, avatar })
        });
        
        if (res.ok) {
            closeProfileConfigModal();
            // Update profile display if needed
            if (document.getElementById("profileName")) {
                document.getElementById("profileName").textContent = displayName;
            }
        } else {
            const error = await res.json();
            alert('Failed to save profile: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile. Please try again.');
    }
}

// Add event listener for avatar URL input
document.addEventListener("DOMContentLoaded", () => {
    const avatarUrlInput = document.getElementById("avatarUrl");
    if (avatarUrlInput) {
        avatarUrlInput.addEventListener("input", updateAvatarPreview);
    }
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
