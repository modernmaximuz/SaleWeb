import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

export function initAuth(emailInput, passwordInput, loginBtn, onLogin) {
    onAuthStateChanged(auth, user => {
        if (user) {
            onLogin(user.uid);
        }
    });

    loginBtn.addEventListener("click", async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            // Try to sign in
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            onLogin(userCredential.user.uid);
        } catch (err) {
            if (err.code === "auth/user-not-found") {
                // Create account if not exists
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                onLogin(userCredential.user.uid);
            } else {
                alert(err.message);
            }
        }
    });
}
