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
        // For Firebase users, use displayName if available, otherwise email
        profileName.textContent = user.displayName || user.email;
        if (avatar) {
            // Clear the CSS gradient background first
            avatar.style.background = "none";
            if (user.photoURL) {
                avatar.style.backgroundImage = `url(${user.photoURL})`;
                avatar.style.backgroundSize = "cover";
            } else {
                // Use default hades.gif when no custom avatar
                avatar.style.backgroundImage = `url(/images/hades.gif)`;
                avatar.style.backgroundSize = "cover";
            }
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
        modal.style.display = "flex";
        modal.style.visibility = "visible";
    }
}

function closeProfileConfigModal() {
    document.getElementById("profileConfigModal").classList.add("hidden");
}

async function loadProfileData() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Reload user to get latest profile data from Firebase
        await user.reload();

        document.getElementById("displayName").value = user.displayName || user.email || '';
        document.getElementById("avatarUrl").value = user.photoURL || '';
        updateAvatarPreview();
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
            previewImg.src = "/images/hades.gif";
        };
    } else {
        previewImg.src = "/images/hades.gif";
    }
}

function resetAvatar() {
    document.getElementById("avatarUrl").value = "";
    updateAvatarPreview();
}

async function saveProfile() {
    const displayName = document.getElementById("displayName").value.trim();
    const avatarUrl = document.getElementById("avatarUrl").value.trim();

    if (!displayName) {
        alert('Display name is required.');
        return;
    }

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            alert('You must be logged in to save your profile.');
            return;
        }

        const token = await user.getIdToken();

        // Use backend endpoint to update profile for consistency
        const response = await fetch('/admin/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                displayName: displayName,
                avatar: avatarUrl || null
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save profile');
        }

        // Reload user to get updated data from Firebase Auth
        await user.reload();

        // Reload admin profile from backend to update support.js currentUser
        try {
            const profileRes = await fetch('/admin/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                // Update global currentUser if support.js has it loaded
                if (typeof window.currentUser !== 'undefined') {
                    window.currentUser.avatar = profileData.avatar;
                    window.currentUser.displayName = profileData.displayName;
                    window.currentUser.username = profileData.displayName;
                }
            }
        } catch (profileError) {
            console.error('Failed to reload admin profile after save:', profileError);
        }

        closeProfileConfigModal();

        // Update profile display
        if (document.getElementById("profileName")) {
            document.getElementById("profileName").textContent = displayName;
        }

        // Update avatar display - prioritize custom avatar, otherwise use default
        const avatar = document.querySelector(".avatar");
        if (avatar) {
            // Clear the CSS gradient background first
            avatar.style.background = "none";
            if (user.photoURL) {
                avatar.style.backgroundImage = `url(${user.photoURL})`;
                avatar.style.backgroundSize = "cover";
            } else {
                // Use default hades.gif
                avatar.style.backgroundImage = `url(/images/hades.gif)`;
                avatar.style.backgroundSize = "cover";
            }
        }

        alert('Profile saved successfully!');
    } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile: ' + error.message);
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
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=bdcb671a7075bed44f862ba62f369966`, {
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

// Function to update sidebar items based on login status
async function updateSidebarAuthState() {
    const isLoggedIn = await window.isLoggedIn();
    const loginRequiredItems = document.querySelectorAll('.requires-login');
    const logoutButton = document.getElementById('sidebarLogout');

    loginRequiredItems.forEach(item => {
        if (isLoggedIn) {
            item.classList.remove('requires-login');
            item.style.opacity = '1';
            item.style.pointerEvents = 'auto';
            item.style.cursor = 'pointer';
        } else {
            item.classList.add('requires-login');
        }
    });

    // Hide logout button if not logged in
    if (logoutButton) {
        logoutButton.style.display = isLoggedIn ? 'flex' : 'none';
    }
}

// Update sidebar auth state on page load and auth change
document.addEventListener('DOMContentLoaded', updateSidebarAuthState);

firebase.auth().onAuthStateChanged(updateSidebarAuthState);

// Handle dropdown toggles
document.addEventListener('click', function(e) {
    // New compact navigation dropdown toggle
    if (e.target.id === 'shopNavToggle' || e.target.closest('#shopNavToggle')) {
        e.preventDefault();
        e.stopPropagation();
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

// Dedicated dropdown handler for reliability
document.addEventListener('DOMContentLoaded', function() {
    const shopToggle = document.getElementById('shopNavToggle');
    if (shopToggle) {
        shopToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropdownContainer = this.closest('.nav-dropdown');
            if (dropdownContainer) {
                dropdownContainer.classList.toggle('open');
            }
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

// ===== REDEEM CODE POPUP FUNCTIONS =====
let userIP = 'Loading...';
let hardwareId = '';

// Generate a hardware ID based on browser fingerprint
async function generateHardwareId() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const txt = 'hardware-id';
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText(txt, 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText(txt, 4, 17);

    const canvasFingerprint = canvas.toDataURL();
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;

    const combined = `${canvasFingerprint}-${screenInfo}-${timezone}-${language}-${platform}`;

    // Use Web Crypto API for browser compatibility
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 32);
    } catch (error) {
        // Fallback to base64 if crypto.subtle is not available
        return btoa(combined).substring(0, 32);
    }
}

// Get user IP address
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
        const userIPEl = document.getElementById('userIP');
        if (userIPEl) userIPEl.textContent = userIP;
    } catch (error) {
        console.error('Failed to get IP:', error);
        userIP = 'Unknown';
        const userIPEl = document.getElementById('userIP');
        if (userIPEl) userIPEl.textContent = userIP;
    }
}

// Open redeem popup
async function openRedeemPopup() {
    const popup = document.getElementById('redeemPopup');
    if (popup) {
        popup.classList.remove('hidden');
        getUserIP();
        hardwareId = await generateHardwareId();
    }
}

// Close redeem popup
function closeRedeemPopup() {
    const popup = document.getElementById('redeemPopup');
    if (popup) {
        popup.classList.add('hidden');
        const codeInput = document.getElementById('redeemCodeInput');
        const messageEl = document.getElementById('redeemMessage');
        if (codeInput) codeInput.value = '';
        if (messageEl) {
            messageEl.className = 'redeem-message';
            messageEl.textContent = '';
        }
    }
}

// Open events popup
async function openEventsPopup() {
    const popup = document.getElementById('eventsPopup');
    if (popup) {
        popup.classList.remove('hidden');
        await loadEvents();
    }
}

// Close events popup
function closeEventsPopup() {
    const popup = document.getElementById('eventsPopup');
    if (popup) {
        popup.classList.add('hidden');
    }
}

// Load events from backend
async function loadEvents() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;

    eventsList.innerHTML = '<p class="loading-text">Loading events...</p>';

    try {
        const response = await fetch('/events');
        const data = await response.json();

        if (data.events && data.events.length > 0) {
            eventsList.innerHTML = '';
            data.events.forEach(event => {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';

                // Parse message for links
                const parsedMessage = parseLinks(event.message);

                eventItem.innerHTML = `
                    <div class="event-message">${parsedMessage.text}</div>
                    ${parsedMessage.link ? `<div class="event-link"><a href="${parsedMessage.link}" target="_blank"><i class="fas fa-external-link-alt"></i> Go to link</a></div>` : ''}
                    ${event.link ? `<div class="event-link"><a href="${event.link}" target="_blank"><i class="fas fa-external-link-alt"></i> Go to link</a></div>` : ''}
                `;

                eventsList.appendChild(eventItem);
            });
        } else {
            eventsList.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-bell-slash"></i>
                    <p>No events currently active</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load events:', error);
        eventsList.innerHTML = `
            <div class="no-events">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load events</p>
            </div>
        `;
    }
}

// Parse links in message text
function parseLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = text.match(urlRegex);
    let cleanText = text.replace(urlRegex, '[Link]');

    return {
        text: cleanText,
        link: links && links.length > 0 ? links[0] : null
    };
}

// Close event notification
function closeEventNotification() {
    const notification = document.getElementById('eventNotification');
    if (notification) {
        notification.classList.add('hidden');
    }
}

// Show event notification
function showEventNotification(event) {
    const notification = document.getElementById('eventNotification');
    const messageEl = document.getElementById('notificationMessage');

    if (!notification || !messageEl) return;

    // Set the message (truncate if too long)
    const parsedMessage = parseLinks(event.message);
    messageEl.textContent = parsedMessage.text.length > 50 ? parsedMessage.text.substring(0, 50) + '...' : parsedMessage.text;

    // Show the notification
    notification.classList.remove('hidden');

    // Auto-hide after 10 seconds
    setTimeout(() => {
        closeEventNotification();
    }, 10000);
}

// Initialize SSE for event notifications
function initializeEventSSE() {
    const eventSource = new EventSource('/chat/events');

    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'new_event':
                    showEventNotification(data.event);
                    break;
                case 'update_event':
                    // Optionally refresh events list if popup is open
                    break;
                case 'delete_event':
                    // Optionally refresh events list if popup is open
                    break;
            }
        } catch (error) {
            console.error('Error parsing SSE event:', error);
        }
    };

    eventSource.onerror = function(error) {
        console.error('SSE error:', error);
        eventSource.close();
        // Reconnect after 5 seconds
        setTimeout(initializeEventSSE, 5000);
    };
}

// Initialize SSE when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeEventSSE();
});

// Redeem code
async function redeemCode() {
    const codeInput = document.getElementById('redeemCodeInput');
    const redeemBtn = document.getElementById('redeemBtn');
    const messageEl = document.getElementById('redeemMessage');

    if (!codeInput) return;

    const code = codeInput.value.trim();

    if (!code) {
        if (messageEl) {
            messageEl.textContent = 'Please enter a code';
            messageEl.className = 'redeem-message error';
        }
        return;
    }

    if (redeemBtn) redeemBtn.disabled = true;
    if (messageEl) {
        messageEl.textContent = 'Validating code...';
        messageEl.className = 'redeem-message';
    }

    try {
        const headers = {};

        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
            const token = await firebase.auth().currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch('/redeem-code', {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                ip: userIP,
                hardwareId: hardwareId
            })
        });

        const result = await response.json();

        if (response.ok) {
            if (messageEl) {
                messageEl.textContent = result.message || 'Code redeemed successfully!';
                messageEl.className = 'redeem-message success';
            }
            if (codeInput) codeInput.value = '';

            // Store discount percentage in localStorage
            if (result.discountPercentage !== null && result.discountPercentage !== undefined) {
                localStorage.setItem('discountPercentage', result.discountPercentage);
                localStorage.setItem('discountCode', code);
                // Trigger cart update to apply discount
                if (typeof updateCartDisplay === 'function') {
                    updateCartDisplay();
                }
            }

            // Close popup after 2 seconds on success
            setTimeout(() => {
                closeRedeemPopup();
            }, 2000);
        } else {
            if (messageEl) {
                messageEl.textContent = result.error || 'Failed to redeem code';
                messageEl.className = 'redeem-message error';
            }
        }
    } catch (error) {
        console.error('Redeem error:', error);
        if (messageEl) {
            messageEl.textContent = 'An error occurred. Please try again.';
            messageEl.className = 'redeem-message error';
        }
    } finally {
        if (redeemBtn) redeemBtn.disabled = false;
    }
}

// Make functions globally accessible
window.openRedeemPopup = openRedeemPopup;
window.closeRedeemPopup = closeRedeemPopup;
window.redeemCode = redeemCode;

// Close popup on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeRedeemPopup();
    }
});

// Close popup when clicking outside
document.addEventListener('click', (e) => {
    const popup = document.getElementById('redeemPopup');
    if (popup && e.target.id === 'redeemPopup') {
        closeRedeemPopup();
    }
});
