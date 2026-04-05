const express = require("express");
const admin = require("firebase-admin");

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
