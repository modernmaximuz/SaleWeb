const express = require("express");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = "z0MhmE2ONMjVKhPplhphYnQ6AR7q4lcXkX7q4DazdRlrJaqXlBkhqSK1DnRY";
const PASTE_ID = "PKzNiJG1";

// Load paste
app.get("/load", async (req, res) => {
    const r = await fetch(`https://api.pastefy.app/paste/${PASTE_ID}`, {
        headers: { Authorization: API_KEY }
    });
    const data = await r.json();
    res.json(data);
});

// Save paste
app.patch("/save", async (req, res) => {
    await fetch(`https://api.pastefy.app/paste/${PASTE_ID}`, {
        method: "PATCH",
        headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: req.body.content })
    });
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running")
);
