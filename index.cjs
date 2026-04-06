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

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = process.env.API_KEY;
const PASTE_ID = "PKzNiJG1";
const BASE = "https://pastefy.app/api/v2";

// Load paste
app.get("/load", verifyToken, async (req, res) => {
    const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const text = await r.text();
    console.log("LOAD STATUS:", r.status);
    console.log(text);

    res.status(r.status).send(text);
});

// Save paste
app.put("/save", verifyToken, async (req, res) => {
    const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: req.body.content
        })
    });

    const text = await r.text();
    console.log("SAVE STATUS:", r.status);
    console.log(text);

    res.status(r.status).send(text);
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running")
);

// Redirect user to Discord OAuth
app.get("/auth/discord", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT)}&scope=identify guilds.join`;
    res.redirect(url);
});

// Callback from Discord
app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;

    // Exchange code for access token
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

    // Get user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const user = await userRes.json();

    // Force join to guild
    await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`, {
        method: "PUT",
        headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            access_token: tokenData.access_token
        })
    });

    // Give role
    await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}/roles/${process.env.DISCORD_ROLE_ID}`, {
        method: "PUT",
        headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
        }
    });

    res.send("Discord linked! You can close this tab.");
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
