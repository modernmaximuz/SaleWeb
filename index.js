const express = require("express");
const fetch = require("node-fetch"); // Node 18+ has global fetch
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Firebase
if (!process.env.FIREBASE_KEY) throw new Error("FIREBASE_KEY missing");
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Firebase auth middleware
async function verifyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return res.status(401).send("Unauthorized");

    const token = header.split("Bearer ")[1];
    try {
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch {
        return res.status(401).send("Invalid token");
    }
}

// Discord config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ROLE_ID = process.env.DISCORD_ROLE_ID;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// Discord OAuth callback
app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;
    try {
        // Exchange code for token
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });
        const tokenData = await tokenRes.json();

        // Get user info
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const user = await userRes.json();

        // Join server
        await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ access_token: tokenData.access_token })
        });

        // Assign role
        await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_ID}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });

        res.send(`<h2>Welcome ${user.username}, you are verified!</h2><a href="/">Back to main page</a>`);
    } catch (err) {
        console.error(err);
        res.send("Error verifying Discord user");
    }
});

// Example: Load paste (your existing Firebase-protected route)
app.get("/load", verifyToken, async (req, res) => {
    const API_KEY = process.env.API_KEY;
    const PASTE_ID = "PKzNiJG1";
    const BASE = "https://pastefy.app/api/v2";
    const r = await fetch(`${BASE}/paste/${PASTE_ID}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
    const text = await r.text();
    res.status(r.status).send(text);
});

// Start server
app.listen(process.env.PORT || 3000, () => console.log("Server running"));
