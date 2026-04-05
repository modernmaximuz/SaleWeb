import express from "express";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseServer.js"; // Node-friendly firebase init

const app = express();
app.use(express.json());
app.use(express.static("public"));

// You can still call it PASTE_ID, backend controls the doc
const PASTE_ID = "PKzNiJG1";

// Load paste
app.get("/load", async (req, res) => {
    try {
        const docRef = doc(db, "pastes", PASTE_ID);
        const docSnap = await getDoc(docRef);
        res.json(docSnap.exists() ? docSnap.data() : { content: "" });
    } catch (err) {
        console.error("Load error:", err);
        res.status(500).send({ error: "Failed to load paste" });
    }
});

// Save paste
app.put("/save", async (req, res) => {
    try {
        const docRef = doc(db, "pastes", PASTE_ID);
        await setDoc(docRef, { content: req.body.content });
        res.send({ success: true });
    } catch (err) {
        console.error("Save error:", err);
        res.status(500).send({ error: "Failed to save paste" });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
