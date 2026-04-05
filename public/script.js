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
