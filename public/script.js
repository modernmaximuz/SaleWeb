import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const contentTextarea = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");
const pasteId = "PKzNiJG1";

// Load paste on page load
async function loadPaste() {
    const docRef = doc(db, "pastes", pasteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        contentTextarea.value = docSnap.data().content;
    } else {
        contentTextarea.value = "";
    }
}

saveBtn.addEventListener("click", async () => {
    const docRef = doc(db, "pastes", pasteId);
    await setDoc(docRef, { content: contentTextarea.value });
    alert("Saved!");
});

loadPaste();
