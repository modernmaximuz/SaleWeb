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
