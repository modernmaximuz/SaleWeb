(() => {
    const PASTE_ID = "fZ3piaUg";
    
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
    function render() {
        const container = document.getElementById("stockContainer");
        container.innerHTML = "";
    
        const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
        const mm2 = dataCache.mm2 || {};
    
        let items = Object.entries(mm2).filter(([name, d]) => {
        const match = name.toLowerCase().includes(search);
    
        if (search) return match;
    
        const cart = getCart();
        const alreadyTaken = cart.find(i => i.name === name);
    
        return match && d.stock > 0 && !alreadyTaken;
    });
    
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;
    
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const paged = items.slice(start, start + ITEMS_PER_PAGE);
    
        for (let [name, d] of paged) {
            const card = document.createElement("div");
            card.className = "card";
            const imgSrc = d.stock > 0 ? d.img : "/images/nostock.png";
    
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
            dataCache.mm2[name].stock = +s.value;
            await saveStock();
        };
    
        const p = document.createElement("input");
        p.type = "number";
        p.step = "0.01";
        p.value = d.price;
    
        p.onchange = async () => {
            dataCache.mm2[name].price = +p.value;
            await saveStock();
        };
    
        info.appendChild(s);
        info.appendChild(p);
    } else {
                info.innerHTML += `
    <div class="stock">
    ${d.stock > 0 ? `Stock: ${d.stock}` : `Stocks Unavailable`}
    </div>
    <div class="price">₱${d.price}</div>
    
    <input type="number" class="qtyInput" value="1" min="1" style="width:60px;">
    <button class="addCartBtn">Add to Cart</button>
    `;
    
    const btn = info.querySelector(".addCartBtn");
    const qtyInput = info.querySelector(".qtyInput");
    
    if (btn && qtyInput) {
        btn.onclick = () => {
            addToCart({
                name,
                price: d.price,
                img: d.img,
                qty: parseInt(qtyInput.value) || 1
            });
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
    
    })();
    
