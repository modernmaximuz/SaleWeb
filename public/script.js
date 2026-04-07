firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
const profileBox = document.getElementById("profileBox");
const profileName = document.getElementById("profileName");
const profileDropdown = document.getElementById("profileDropdown");
const loginToggle = document.getElementById("loginToggle");
const discordBtn = document.getElementById("discordBtn");

async function initDiscordUI() {
    const res = await fetch("/me");
    const user = await res.json();

    if (!user) return;

    if (firebase.auth().currentUser) {
        await firebase.auth().signOut();
    }

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

let token = null;

// When auth state changes
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {

        await fetch("/logout-discord");

        token = await user.getIdToken();

        editor.style.display = "block";
        discordBtn.style.display = "none";

        profileBox.classList.remove("hidden");
        loginToggle.style.display = "none";
        profileName.textContent = user.email || "User";

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
    await firebase.auth().signOut();
    await fetch("/logout-discord");

    // reset UI manually
    profileBox.classList.add("hidden");
    editor.style.display = "none";
    loginToggle.style.display = "inline-block";
    discordBtn.style.display = "inline-block";
};

// Load paste
let currentData = {};

async function load() {
    const res = await fetch("/load", {
        headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    currentData = JSON.parse(data.content || "{}");

    renderEditor();
}

function renderEditor() {
    const container = document.getElementById("editorItems");
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

async function changeStock(item, amount) {
    if (!token) return;

    if (!currentData.mm2) currentData.mm2 = {};
    if (!currentData.mm2[item]) currentData.mm2[item] = 0;

    currentData.mm2[item] += amount;

    if (currentData.mm2[item] < 0) currentData.mm2[item] = 0;

    await fetch("/save", {
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
