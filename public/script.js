// Set Firebase session persistence to LOCAL to keep users logged in
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

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
    const modal = document.getElementById("profileConfigModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "block";
        modal.style.visibility = "visible";
    }
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
            body: JSON.stringify({ displayName, avatar: avatarUrl })
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

// Add event listeners for avatar inputs
document.addEventListener("DOMContentLoaded", () => {
    const avatarUrlInput = document.getElementById("avatarUrl");
    const avatarUploadInput = document.getElementById("avatarUpload");
    const uploadBtn = document.getElementById("uploadBtn");
    
    if (avatarUrlInput) {
        avatarUrlInput.addEventListener("input", updateAvatarPreview);
    }
    
    if (uploadBtn && avatarUploadInput) {
        uploadBtn.addEventListener("click", () => {
            avatarUploadInput.click();
        });
        
        avatarUploadInput.addEventListener("change", handleImageUpload);
    }
});

// Handle image upload to imgbb.com
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
    }
    
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = uploadProgress?.querySelector('.progress-fill');
    const progressText = uploadProgress?.querySelector('.progress-text');
    
    if (uploadProgress) {
        uploadProgress.classList.remove('hidden');
    }
    
    try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=bdcb671a7075bed44f862ba62f369966&expiration=600`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.url) {
            // Update the avatar URL input with the uploaded image URL
            const avatarUrlInput = document.getElementById('avatarUrl');
            if (avatarUrlInput) {
                avatarUrlInput.value = result.data.url;
                updateAvatarPreview();
            }
            
            // Show success feedback
            if (progressText) {
                progressText.textContent = 'Upload complete!';
                progressText.style.color = '#4caf50';
            }
            
            // Hide progress after a delay
            setTimeout(() => {
                if (uploadProgress) {
                    uploadProgress.classList.add('hidden');
                }
            }, 2000);
        } else {
            throw new Error(result.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image: ' + error.message);
        
        if (uploadProgress) {
            uploadProgress.classList.add('hidden');
        }
    }
}

// Sidebar toggle function
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
};

// Profile configuration function
window.openProfileConfig = function() {
    if (typeof openProfileConfigModal === 'function') {
        openProfileConfigModal();
    } else {
        console.warn('Profile configuration modal not available');
    }
};

// Sidebar logout function
window.handleSidebarLogout = async function() {
    try {
        if (firebase.auth().currentUser) {
            await firebase.auth().signOut();
        }

        await fetch("/logout-discord");

        resetUI();
        toggleSidebar();

        // Force redirect every time
        window.location.href = "/";
    } catch (err) {
        console.error("Logout error:", err);
    }
};

// Handle dropdown toggles
document.addEventListener('click', function(e) {
    // New compact navigation dropdown toggle
    if (e.target.id === 'shopNavToggle' || e.target.closest('#shopNavToggle')) {
        e.preventDefault();
        const dropdown = document.getElementById('shopNavMenu');
        const dropdownContainer = e.target.closest('.nav-dropdown');
        
        // Close all other dropdowns
        document.querySelectorAll('.nav-dropdown').forEach(d => {
            if (d !== dropdownContainer) {
                d.classList.remove('open');
            }
        });
        
        // Toggle current dropdown
        if (dropdownContainer) {
            dropdownContainer.classList.toggle('open');
        }
    }
    
    // Close dropdowns when clicking outside
    if (!e.target.closest('.nav-dropdown')) {
        document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    }
    
    // Legacy shop dropdown toggle (keep for compatibility)
    if (e.target.id === 'shopToggle' || e.target.closest('#shopToggle')) {
        e.preventDefault();
        const dropdown = document.getElementById('shopMenu');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    }
    
    // Close legacy dropdowns when clicking outside
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdownContent').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
});

// Close sidebar when pressing Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        
        if (sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    }
});

// Ensure video loops properly
document.addEventListener('DOMContentLoaded', function() {
    const video = document.querySelector('.video-background video');
    if (video) {
        // Force loop behavior
        video.addEventListener('ended', function() {
            video.currentTime = 0;
            video.play();
        });
        
        // Ensure video plays
        video.play().catch(function(error) {
            console.log('Video autoplay failed:', error);
        });
    }
});

// ==================== CUSTOM POPUP SYSTEM ====================
window.showCustomPopup = function(title, message, buttons = []) {
    // Remove existing popups
    const existingPopup = document.querySelector('.custom-popup');
    const existingOverlay = document.querySelector('.popup-overlay');
    if (existingPopup) existingPopup.remove();
    if (existingOverlay) existingOverlay.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'custom-popup';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = title;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'popup-content';
    content.textContent = message;
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'popup-buttons';
    
    // Add default buttons if none provided
    if (buttons.length === 0) {
        buttons = [
            { text: 'OK', class: 'primary', action: () => {} }
        ];
    }
    
    // Create buttons
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `popup-btn ${btn.class || ''}`;
        button.textContent = btn.text;
        button.onclick = () => {
            if (btn.action) btn.action();
            hideCustomPopup();
        };
        buttonsContainer.appendChild(button);
    });
    
    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(content);
    popup.appendChild(buttonsContainer);
    
    // Add to page
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // Trigger animations
    setTimeout(() => {
        overlay.classList.add('active');
        popup.classList.add('active');
    }, 10);
    
    // Close on overlay click
    overlay.onclick = hideCustomPopup;
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            hideCustomPopup();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
};

window.hideCustomPopup = function() {
    const popup = document.querySelector('.custom-popup');
    const overlay = document.querySelector('.popup-overlay');
    
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 400);
    }
    
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
};

// Replace browser notifications with custom popups
window.showNotification = function(message, type = 'info') {
    const titles = {
        'info': 'Information',
        'success': 'Success',
        'warning': 'Warning',
        'error': 'Error'
    };
    
    const buttons = type === 'error' ? [
        { text: 'OK', class: 'primary', action: () => {} }
    ] : [
        { text: 'Got it', class: 'primary', action: () => {} }
    ];
    
    showCustomPopup(titles[type] || 'Notification', message, buttons);
};

// ===== GLOBAL AUTH CHECK (used by navbar & pages) =====
window.isLoggedIn = async function () {
    // Check Firebase
    if (firebase.auth().currentUser) return true;

    // Check Discord cookie
    const res = await fetch("/me");
    const user = await res.json();
    return !!user;
};
