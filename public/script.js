import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// --- Firebase setup ---
const firebaseConfig = {
  apiKey: "<YOUR_FIREBASE_API_KEY>",
  authDomain: "<YOUR_FIREBASE_AUTH_DOMAIN>",
  projectId: "<YOUR_FIREBASE_PROJECT_ID>",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- DOM elements ---
const loginDiv = document.getElementById("loginDiv");
const editorDiv = document.getElementById("editorDiv");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");
const content = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

let currentToken = null;

// --- Login ---
loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    const userCred = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    currentToken = await userCred.user.getIdToken();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// --- Logout ---
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentToken = null;
  editorDiv.style.display = "none";
  loginDiv.style.display = "block";
});

// --- Watch auth state ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    editorDiv.style.display = "block";
    currentToken = await user.getIdToken();
    loadPaste();
  } else {
    loginDiv.style.display = "block";
    editorDiv.style.display = "none";
  }
});

// --- Load paste ---
async function loadPaste() {
  try {
    const res = await fetch("/load", {
      headers: { Authorization: `Bearer ${currentToken}` }
    });
    const data = await res.json();
    content.value = data.content || data.paste?.content || "";
  } catch (err) {
    console.error("Load failed", err);
  }
}

// --- Save paste ---
saveBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/save", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify({ content: content.value })
    });
    await res.json();
    alert("Saved!");
  } catch (err) {
    console.error("Save failed", err);
  }
});
