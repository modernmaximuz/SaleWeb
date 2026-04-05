const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

let token = null;

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        token = await user.getIdToken();
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline";
        load(); // your existing function
    } else {
        token = null;
        loginBtn.style.display = "inline";
        logoutBtn.style.display = "none";
    }
});

loginBtn.onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
};

logoutBtn.onclick = () => firebase.auth().signOut();


const content = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

async function load() {
    const res = await fetch("/load", {
    headers: { Authorization: `Bearer ${token}` }
});
    const data = await res.json();
    content.value = data.content || data.paste?.content || "";
}

async function savePaste() {
    await fetch("/save", {
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    },
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.value })
    });
    alert("Saved!");
}

saveBtn.addEventListener("click", savePaste);

load();
