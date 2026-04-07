firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const discordBtn = document.getElementById("discordLogin");
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

discordBtn.onclick = () => {
    window.location.href = "/auth/discord";
};

// Optional: redirect if already logged in
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        window.location.href = "/";
    }
});
