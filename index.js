const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

async function verifyUser(req, res, next) {
  try {
    const token = req.headers.authorization.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Unauthorized");
  }
}

const express = require("express");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = "z0MhmE2ONMjVKhPplhphYnQ6AR7q4lcXkX7q4DazdRlrJaqXlBkhqSK1DnRY";
const PASTE_ID = "PKzNiJG1";
const BASE = "https://pastefy.app/api/v2";

// Load paste
app.get("/load", verifyUser, async (req, res) => {
    const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const text = await r.text();
    console.log("LOAD STATUS:", r.status);
    console.log(text);

    res.status(r.status).send(text);
});

// Save paste
app.put("/save", verifyUser, async (req, res) => {
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
