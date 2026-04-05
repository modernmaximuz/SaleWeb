import { initAuth } from './auth.js';
import { initPasteEditor } from './paste.js';

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const contentTextarea = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

initAuth(emailInput, passwordInput, loginBtn, (uid) => {
    initPasteEditor(contentTextarea, saveBtn, uid);
});

const content = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

async function load() {
    const res = await fetch("/load");
    const data = await res.json();
    content.value = data.content || "";
}

async function savePaste() {
    await fetch("/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.value })
    });
    alert("Saved!");
}

saveBtn.addEventListener("click", savePaste);

load();
