const content = document.getElementById("content");

async function load() {
    const res = await fetch("/load");
    const data = await res.json();
    content.value = data.paste.content;
}

async function save() {
    await fetch("/save", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.value })
    });
    alert("Saved!");
}

load();
