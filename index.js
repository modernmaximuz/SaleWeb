const express = require("express");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // make sure node-fetch is installed

// Check environment variables
if (!process.env.FIREBASE_KEY || !process.env.API_KEY) {
    throw new Error("FIREBASE_KEY or API_KEY missing in environment variables");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = process.env.API_KEY;
const PASTE_ID = "PKzNiJG1";
const BASE = "https://pastefy.app/api/v2";

// --- Middleware: verify Firebase token ---
async function verifyToken(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: no token" });
    }

    const token = header.split("Bearer ")[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token verification failed:", err);
        return res.status(401).json({ error: "Invalid token" });
    }
}

// --- Load paste ---
app.get("/load", verifyToken, async (req, res) => {
    try {
        const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });

        const data = await r.json(); // ensure JSON
        console.log("LOAD STATUS:", r.status, data);

        res.status(r.status).json(data);
    } catch (err) {
        console.error("Load error:", err);
        res.status(500).json({ error: "Failed to load paste" });
    }
});

// --- Save paste ---
app.put("/save", verifyToken, async (req, res) => {
    const content = req.body.content;
    if (!content) return res.status(400).json({ error: "Content missing" });

    try {
        const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });

        const data = await r.json();
        console.log("SAVE STATUS:", r.status, data);

        res.status(r.status).json(data);
    } catch (err) {
        console.error("Save error:", err);
        res.status(500).json({ error: "Failed to save paste" });
    }
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running on port", process.env.PORT || 3000)
);
