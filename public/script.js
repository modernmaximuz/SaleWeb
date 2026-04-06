const profileBox = document.getElementById("profileBox");
const profileName = document.getElementById("profileName");
const profileDropdown = document.getElementById("profileDropdown");
const loginToggle = document.getElementById("loginToggle");
const discordBtn = document.getElementById("discordBtn");

async function initDiscordUI() {
    const res = await fetch("/me");
    const user = await res.json();

    if (!user) return;

    profileBox.classList.remove("hidden");
    loginToggle.style.display = "none";
    discordBtn.style.display = "none";

    profileName.textContent = user.username;

    const avatar = document.querySelector(".avatar");
    avatar.style.backgroundImage =
        `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png)`;
    avatar.style.backgroundSize = "cover";
}

initDiscordUI();

const loginBox = document.getElementById("loginBox");
const editor = document.getElementById("editor");
const errorP = document.getElementById("error");

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");

const content = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

let token = null;

// When auth state changes
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        token = await user.getIdToken();

        editor.style.display = "block";
        discordBtn.style.display = "none";

        // Show profile only for Firebase users
        profileBox.classList.remove("hidden");
        loginToggle.style.display = "none";
        profileName.textContent = "Administrator";

        load();
    }
});

loginToggle.onclick = () => {
    if (loginBox.style.display === "block") {
        loginBox.style.display = "none";
    } else {
        loginBox.style.display = "block";
    }
};

const profileMain = document.getElementById("profileMain");

profileMain.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("hidden");
});

profileDropdown.addEventListener("click", (e) => {
    e.stopPropagation(); // allow clicking logout
});

document.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
});

let saveTimeout = null;

content.addEventListener("input", () => {
    if (!token) return;

    // Reset timer every keystroke
    clearTimeout(saveTimeout);

    // Wait 800ms after user stops typing
    saveTimeout = setTimeout(async () => {
        await fetch("/save", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content: content.value })
        });

        console.log("Auto-saved");
    }, 800);
});

// Login
document.getElementById("loginBtn").onclick = async () => {
    try {
        await firebase.auth().signInWithEmailAndPassword(
            emailInput.value,
            passInput.value
        );
    } catch (err) {
        errorP.textContent = err.message;
    }
};

// Logout
document.getElementById("logoutBtn").onclick = async () => {
    try {
        // logout firebase
        await firebase.auth().signOut();

        // logout discord (cookie)
        window.location.href = "/logout-discord";
    } catch (err) {
        console.error(err);
    }
};

// Load paste
async function load() {
    const res = await fetch("/load", {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    content.value = data.content || data.paste?.content || "";
}

// Save paste
saveBtn.onclick = async () => {
    await fetch("/save", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: content.value })
    });
};
