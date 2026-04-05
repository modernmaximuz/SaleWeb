import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_ID"
});

const auth = getAuth(app);

const email = document.getElementById("email");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
  }
  alert("Logged in!");
};

// 🔥 Automatically attach token to ALL fetch requests
const oldFetch = window.fetch;
window.fetch = async (...args) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    args[1] = args[1] || {};
    args[1].headers = {
      ...(args[1].headers || {}),
      Authorization: `Bearer ${token}`
    };
  }
  return oldFetch(...args);
};
