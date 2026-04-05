import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

export function initAuth(loginDiv, editorDiv, emailInput, passwordInput, loginBtn, onLogin) {
    onAuthStateChanged(auth, user => {
        if (user) {
            loginDiv.style.display = "none";
            editorDiv.style.display = "block";
            onLogin(user.uid);
        } else {
            loginDiv.style.display = "block";
            editorDiv.style.display = "none";
        }
    });

    loginBtn.addEventListener("click", async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
            } catch (err) {
                alert("Login/Register failed: " + err.message);
            }
        }
    });
}
