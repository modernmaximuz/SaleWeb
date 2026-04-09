const MM2_PASTE_ID = "fZ3piaUg";
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`${client.user.tag} is online!`));
client.login(process.env.DISCORD_BOT_TOKEN);

const fetch = (...args) =>
  import("node-fetch").then(({default: fetch}) => fetch(...args));
const express = require("express");
const admin = require("firebase-admin");

if (!process.env.FIREBASE_KEY) {
    throw new Error("FIREBASE_KEY is missing in environment variables");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const crypto = require("crypto");
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));
app.get("/*", (req, res, next) => {
    const path = req.params[0];

    // skip API routes
if (
    path.startsWith("auth") ||
    path === "me" ||
    path.startsWith("load") ||
    path.startsWith("save")
) {
    return next();
}
    const filePath = __dirname + "/public/" + path + (path.includes(".") ? "" : ".html");

    res.sendFile(filePath, (err) => {
        if (err) next();
    });
});

function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;
    if (!rc) return list;

    rc.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        list[parts.shift().trim()] = decodeURI(parts.join("="));
    });

    return list;
}

const SECRET = "hades-secret";

function sign(data) {
    return crypto
        .createHmac("sha256", SECRET)
        .update(data)
        .digest("hex");
}

function getDiscordUser(req) {
    const cookies = parseCookies(req);
    if (!cookies.discord) return null;

    const [data, sig] = cookies.discord.split(".");
    if (!data || !sig) return null;

    const payload = Buffer.from(data, "base64").toString();
    if (sign(payload) !== sig) return null;

    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

async function verifyToken(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized");
    }

    const token = header.split("Bearer ")[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send("Invalid token");
    }
}

const API_KEY = process.env.API_KEY;
const PASTE_ID = "PKzNiJG1";
const ORDER_PASTE_ID = "OQooMS9z";
const BASE = "https://pastefy.app/api/v2";

async function readPasteContent(pasteId) {
    const r = await fetch(`${BASE}/paste/${pasteId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const json = await r.json();
    return {
        ok: r.ok,
        status: r.status,
        paste: json,
        content: json.content
    };
}

async function writePasteContent(pasteId, content) {
    const current = await fetch(`${BASE}/paste/${pasteId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const paste = await current.json();
    paste.content = content;

    const r = await fetch(`${BASE}/paste/${pasteId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(paste)
    });
    return r;
}

function parseOrdersContent(rawContent) {
    try {
        const parsed = JSON.parse(rawContent || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Load paste
app.get("/load/:id", async (req, res) => {
    const pasteId = req.params.id;

    const r = await fetch(`${BASE}/paste/${pasteId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const json = await r.json();   // ✅ NOT text
    res.status(r.status).json(json);  // ✅ send JSON
});

// Save paste
app.put("/save/:id", verifyToken, async (req, res) => {
    const pasteId = req.params.id;

    // STEP 1 — get current paste
    const current = await fetch(`${BASE}/paste/${pasteId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const paste = await current.json();

    // STEP 2 — replace content only
    paste.content = req.body.content;

    // STEP 3 — send FULL paste object back
    const r = await fetch(`${BASE}/paste/${pasteId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(paste)
    });

    const text = await r.text();
    res.status(r.status).send(text);
});

app.post("/orders/finalize", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!items.length) return res.status(400).json({ error: "Cart is empty" });

        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) return res.status(parsed.status).json({ error: "Failed to load orders" });

        const orders = parseOrdersContent(parsed.content);
        const hasPending = orders.some(o => o.discordId === user.id && o.status === "pending");
        if (hasPending) {
            return res.status(409).json({ error: "You already have a pending order" });
        }

        const cleanItems = items.map(i => ({
            name: String(i.name || ""),
            price: Number(i.price || 0),
            img: String(i.img || ""),
            qty: Math.max(1, Number(i.qty || 1))
        })).filter(i => i.name);

        if (!cleanItems.length) return res.status(400).json({ error: "No valid items" });

        const order = {
            user: user.username,
            discordId: user.id,
            date: new Date().toISOString(),
            items: cleanItems,
            status: "pending"
        };

        orders.push(order);

        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) return res.status(writeRes.status).json({ error: "Failed to save order" });

        return res.json({ ok: true });
    } catch (err) {
        console.error("Finalize order failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put("/orders/:index/status", verifyToken, async (req, res) => {
    try {
        const index = Number(req.params.index);
        const status = req.body?.status;
        if (!Number.isInteger(index) || index < 0) {
            return res.status(400).json({ error: "Invalid order index" });
        }
        if (!["accepted", "declined"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) return res.status(parsed.status).json({ error: "Failed to load orders" });
        const orders = parseOrdersContent(parsed.content);
        if (!orders[index]) return res.status(404).json({ error: "Order not found" });

        const wasAccepted = orders[index].status === "accepted";
        orders[index].status = status;

        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) return res.status(writeRes.status).json({ error: "Failed to save order status" });

        if (status === "accepted" && !wasAccepted) {
            await createOrderChannel(orders[index]);
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error("Update order status failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running")
);

// Discord callback
app.get("/auth/discord/callback", async (req, res) => {
    try {
        const code = req.query.code;

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.DISCORD_REDIRECT
            })
        });

        const tokenData = await tokenRes.json();

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const user = await userRes.json();

        // Force join guild & assign role
        await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ access_token: tokenData.access_token })
        });

        await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}/roles/${process.env.DISCORD_ROLE_ID}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        // Prepare cookie
        const payload = JSON.stringify({
            id: user.id,
            username: user.username,
            avatar: user.avatar
        });
        const signature = sign(payload);
        const domain = req.hostname; // just the host
        const isLocalhost = domain === "localhost" || domain === "127.0.0.1";

        const cookie = `discord=${Buffer.from(payload).toString("base64")}.${signature}; Path=/; HttpOnly; SameSite=${isLocalhost ? 'Lax' : 'None'};${!isLocalhost ? ' Secure;' : ''}${!isLocalhost ? ` Domain=${domain}` : ''}`;

        res.setHeader("Set-Cookie", cookie);
        res.redirect("/");

    } catch (err) {
        console.error("Discord callback error:", err);
        res.status(500).send("Internal Server Error");
    }
});

const BASE_DISCORD = "https://discord.com/api";

// Step A — Redirect user to Discord
app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        response_type: "code",
        redirect_uri: process.env.DISCORD_REDIRECT,
        scope: "identify guilds.join"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/me", (req, res) => {
    const cookies = parseCookies(req);
    if (!cookies.discord) return res.json(null);

    const [data, sig] = cookies.discord.split(".");
    const payload = Buffer.from(data, "base64").toString();

    if (sign(payload) !== sig) return res.json(null);

    res.json(JSON.parse(payload));
});

// Logout Discord
app.get("/logout-discord", (req, res) => {
    const domain = req.hostname;
    const isLocalhost = domain === "localhost" || domain === "127.0.0.1";

    const cookie = `discord=; Path=/; Max-Age=0; HttpOnly; SameSite=${isLocalhost ? 'Lax' : 'None'};${!isLocalhost ? ' Secure;' : ''}${!isLocalhost ? ` Domain=${domain}` : ''}`;

    res.setHeader("Set-Cookie", cookie);
    res.redirect("/");
});

const { createOrderChannel } = require("./orderBot");

app.post("/accept-order", async (req,res)=>{
    const order = req.body;
    await createOrderChannel(order);
    res.send("ok");
});

async function acceptOrder(i){
    const o = window._orders[i];
    await fetch("/accept-order",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(o)
    });
}
