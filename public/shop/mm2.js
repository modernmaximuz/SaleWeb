const PASTE_ID = "fZ3piaUg";

let token = null;
let isAdmin = false;
let dataCache = {};

// Detect Discord login
async function initDiscord() {
const res = await fetch("/me");
const user = await res.json();

```
if (user) {
    console.log("Discord user detected");
    isAdmin = false;
}
```

}

// Detect Firebase admin
firebase.auth().onAuthStateChanged(async (user) => {
if (user) {
token = await user.getIdToken();
isAdmin = true;

```
    await fetch("/logout-discord");
}

loadStock();
```

});

async function loadStock() {
const res = await fetch(`/load/${PASTE_ID}`);
const data = await res.json();

```
let json = {};

try {
    json = JSON.parse(data.content);
} catch {
    console.log("Parse error", data);
}

dataCache = json;

render();
```

}


function render() {
const container = document.getElementById("stockContainer");
container.innerHTML = "";

```
const mm2 = dataCache.mm2 || {};

for (let item in mm2) {
    const row = document.createElement("div");
    row.className = "stockRow";

    if (isAdmin) {
        row.innerHTML = `
            <span>${item}</span>
            <button onclick="change('${item}', -1)">-</button>
            <span>${mm2[item]}</span>
            <button onclick="change('${item}', 1)">+</button>
        `;
    } else {
        row.innerHTML = `
            <span>${item}</span>
            <span>${mm2[item]}</span>
        `;
    }

    container.appendChild(row);
}
```

}

async function change(item, amount) {
if (!isAdmin) return;

```
if (!dataCache.mm2) dataCache.mm2 = {};
if (!dataCache.mm2[item]) dataCache.mm2[item] = 0;

dataCache.mm2[item] += amount;

if (dataCache.mm2[item] < 0) dataCache.mm2[item] = 0;

await fetch(`/save/${PASTE_ID}`, {
    method: "PUT",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
        content: JSON.stringify(dataCache, null, 2)
    })
});

render();
```

}

// Auto refresh for viewers
setInterval(() => {
if (!isAdmin) loadStock();
}, 5000);

initDiscord();
