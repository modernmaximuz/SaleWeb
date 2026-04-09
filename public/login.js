firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errorP = document.getElementById("error");

loginBtn.onclick = async () => {
    try {
        await firebase.auth().signInWithEmailAndPassword(
            emailInput.value,
            passInput.value
        );

        // redirect to home/editor after login
        window.location.href = "/";
    } catch (err) {
        errorP.textContent = err.message;
    }
};

// Optional: redirect if already logged in
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        window.location.href = "/";
    }
});
