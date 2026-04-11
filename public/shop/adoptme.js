(() => {
    const PASTE_ID = "QkT4dqYG";
    
    let token = null;
    let isAdmin = false;
    let firebaseAdmin = false;
    let dataCache = {};
    
    let currentPage = 1;
    const ITEMS_PER_PAGE = 84;
    
    // ---------------- AUTH ----------------
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            token = await user.getIdToken();
            firebaseAdmin = true;
            await fetch("/logout-discord");
        } else {
            token = null;
            firebaseAdmin = false;
        }
        isAdmin = firebaseAdmin;
        await loadStock();
    });
    
    async function initDiscord() {
        const res = await fetch("/me");
        await res.json();
        // Discord login should not downgrade Firebase admin access.
        isAdmin = firebaseAdmin;
        await loadStock();
    }
    initDiscord();
    
    // ---------------- LOAD ----------------
    async function loadStock() {
        try {
            const res = await fetch(`/load/${PASTE_ID}`, {
                headers: token ? { Authorization: "Bearer " + token } : {}
            });
    
            const json = await res.json();
            if (!json.content) return;
    
            dataCache = JSON.parse(json.content);
            render();
    
        } catch (err) {
            console.error("Load failed:", err);
        }
    }
    
    // ---------------- RENDER ----------------
    function getCartQty(name) {
        if (typeof getCart !== "function") return 0;
        const cart = getCart();
        const item = cart.find(i => i.name === name);
        return item ? item.qty : 0;
    }

    function render() {
        const container = document.getElementById("stockContainer");
        container.innerHTML = "";
    
        const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
        const adoptme = dataCache.adoptme || {};
    
        let items = Object.entries(adoptme).filter(([name, d]) => {
        const match = name.toLowerCase().includes(search);
    
        if (search) return match;

        return match && d.stock > 0;
    });
    
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;
    
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const paged = items.slice(start, start + ITEMS_PER_PAGE);
    
        for (let [name, d] of paged) {
            const card = document.createElement("div");
            card.className = "card";
            const imgSrc = d.stock > 0 ? d.img : "/images/nostock.png";
            const inCartQty = getCartQty(name);
            const availableStock = Math.max(0, d.stock - inCartQty);
    
    card.innerHTML = `
        <div class="imgBox"><img src="${imgSrc}"></div>
        <div class="info"><span class="name">${name}</span></div>
    `;
    
            const info = card.querySelector(".info");
    
           if (isAdmin) {
        const s = document.createElement("input");
        s.type = "number";
        s.value = d.stock;
    
        s.onchange = async () => {
            dataCache.adoptme[name].stock = +s.value;
            await saveStock();
        };
    
        const p = document.createElement("input");
        p.type = "number";
        p.step = "0.01";
        p.value = d.price;
    
        p.onchange = async () => {
            dataCache.adoptme[name].price = +p.value;
            await saveStock();
        };
    
        info.appendChild(s);
        info.appendChild(p);
    } else {
                info.innerHTML += `
    <div class="stock">
    ${availableStock > 0 ? `Stock: ${availableStock}` : `Stocks Unavailable`}
    </div>
    ${inCartQty > 0 ? `<div class="atc">ATC: ${inCartQty}</div>` : ""}
    <div class="price">&#8369;${d.price}</div>
    
    <input type="number" class="qtyInput" value="1" min="1" max="${Math.max(1, availableStock)}" style="width:60px;" ${availableStock <= 0 ? "disabled" : ""}>
    <button class="addCartBtn" ${availableStock <= 0 ? "disabled" : ""}>Add to Cart</button>
    `;
    
    const btn = info.querySelector(".addCartBtn");
    const qtyInput = info.querySelector(".qtyInput");
    
    if (btn && qtyInput) {
        btn.onclick = () => {
            if (availableStock <= 0) {
                alert("No available stock left for this item.");
                return;
            }
            const qty = Math.max(1, parseInt(qtyInput.value) || 1);
            addToCart({
                name,
                price: d.price,
                img: d.img,
                qty,
                maxQty: d.stock
            });
            render();
        };
    }
            }
    
            container.appendChild(card);
        }
    
        document.getElementById("pageInfo").textContent =
            `Page ${currentPage} of ${totalPages}`;
    }
    
    // ---------------- SAVE ----------------
    async function saveStock() {
        if (!isAdmin) return;
    
        await fetch(`/save/${PASTE_ID}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content: JSON.stringify(dataCache, null, 2) })
        });
    
        render();
    }
    
    // ---------------- EVENTS ----------------
    document.getElementById("searchInput")?.addEventListener("input", () => {
        currentPage = 1;
        render();
    });
    
    document.getElementById("prevPage")?.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            render();
        }
    });
    
    document.getElementById("nextPage")?.addEventListener("click", () => {
        currentPage++;
        render();
    });
    
    // Auto refresh viewers
    setInterval(() => {
        if (!isAdmin) loadStock();
    }, 5000);

    document.addEventListener("cartUpdated", () => {
        if (!isAdmin) render();
    });
    
    })();
