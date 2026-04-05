const express = require("express");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = "z0MhmE2ONMjVKhPplhphYnQ6AR7q4lcXkX7q4DazdRlrJaqXlBkhqSK1DnRY";
const PASTE_ID = "PKzNiJG1";
const BASE = "https://pastefy.app/api/v2";

// Load paste
app.get("/load", async (req, res) => {
    const r = await fetch(`${BASE}/paste/${PASTE_ID}`, {
        headers: {
            Authorization: `Bearer ${API_KEY}`
        }
    });
    const data = await r.json();
    res.json(data);
});

// Save paste (PUT)
app.put("/save", async (req, res) => {
    await fetch(`${BASE}/paste/${PASTE_ID}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: req.body.content
        })
    });
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running")
);
