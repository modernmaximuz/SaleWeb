// script.js
import { db, auth } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const loginDiv = document.getElementById("loginDiv");
const editorDiv = document.getElementById("editorDiv");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

const content = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

let pasteId = "";

// Show editor only when logged in
onAuthStateChanged(auth, user => {
    if (user) {
        loginDiv.style.display = "none";
        editorDiv.style.display = "block";
        pasteId = user.uid; // each user gets their own paste
        loadPaste();
    } else {
        loginDiv.style.display = "block";
        editorDiv.style.display = "none";
    }
});

// Login / Register
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (err2) {
            alert("Login/Register failed: " + err2.message);
        }
    }
});

// Load user's paste
async function loadPaste() {
    const docRef = doc(db, "pastes", pasteId);
    const docSnap = await getDoc(docRef);
    content.value = docSnap.exists() ? docSnap.data().content : "";
}

// Save paste
saveBtn.addEventListener("click", async () => {
    const docRef = doc(db, "pastes", pasteId);
    await setDoc(docRef, { content: content.value });
    alert("Saved!");
});
