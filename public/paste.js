import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export function initPasteEditor(contentTextarea, saveBtn, pasteId) {

    async function loadPaste() {
        const docRef = doc(db, "pastes", pasteId);
        const docSnap = await getDoc(docRef);
        contentTextarea.value = docSnap.exists() ? docSnap.data().content : "";
    }

    saveBtn.addEventListener("click", async () => {
        const docRef = doc(db, "pastes", pasteId);
        await setDoc(docRef, { content: contentTextarea.value });
        alert("Saved!");
    });

    loadPaste();
}
