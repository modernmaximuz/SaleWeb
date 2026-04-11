const MM2_PASTE_ID = "fZ3piaUg";
const { Client, GatewayIntentBits } = require("discord.js");

// Cross-bot communication constants
const BOT_COMMUNICATION_PASTE_ID = "Jk84rCKt";
const BASE = "https://pastefy.app/api/v2";
const API_KEY = process.env.API_KEY;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

async function initializePaste() {
    try {
        const response = await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: "[]"
            })
        });
        
        if (response.ok) {
            // Paste initialized
        } else {
            console.error('Failed to initialize paste:', response.status);
        }
    } catch (error) {
        console.error('Failed to initialize paste:', error);
    }
}

// Read member count from channel name (updated by separate member counting bot)
async function getMemberCountFromChannel() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.error('[AUTH-BOT] Guild not found');
            return 0;
        }
        
        // Get the statistics channel
        const channel = await guild.channels.fetch('1492478671775207449');
        if (!channel) {
            console.error('[AUTH-BOT] Statistics channel not found');
            return 0;
        }
        
        // Extract member count from channel name "Ghosts: X"
        const channelName = channel.name;
        const match = channelName.match(/Ghosts: (\d+)/);
        
        if (match) {
            const memberCount = parseInt(match[1], 10);
            console.log(`[AUTH-BOT] Read member count from channel: ${memberCount}`);
            return memberCount;
        } else {
            console.log('[AUTH-BOT] Could not parse member count from channel name:', channelName);
            return 0;
        }
    } catch (error) {
        console.error('[AUTH-BOT] Error reading member count from channel:', error);
        return 0;
    }
}

async function sendMemberCountToBackend(memberCount) {
    try {
        const stats = {
            memberCount: memberCount,
            lastUpdated: new Date().toISOString()
        };
        
        console.log(`[AUTH-BOT] Sending to backend: memberCount=${memberCount}`);
        
        const response = await fetch('https://saleweb.onrender.com/discord/update-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stats)
        });
        
        if (response.ok) {
            console.log(`[AUTH-BOT] Successfully sent member count: ${memberCount}`);
        } else {
            console.error(`[AUTH-BOT] Failed to save member count: ${response.status}`);
        }
    } catch (error) {
        console.error('[AUTH-BOT] Error saving member count:', error);
    }
}

client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);
    
    // Update member count from channel name immediately
    getMemberCountFromChannel();
    
    // Update every 5 minutes
    setInterval(getMemberCountFromChannel, 300000);
    
    // Track processed message IDs to prevent duplicates
    const processedMessageIds = new Set();
    let isProcessing = false; // Prevent concurrent processing
    
    // Check for cross-bot messages
    setInterval(async () => {
        if (isProcessing) {
            return;
        }
        isProcessing = true;
        try {
            const response = await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                let messages = [];
                try {
                    messages = JSON.parse(data.content || "[]");
                    if (!Array.isArray(messages)) messages = [];
                } catch (error) {
                    messages = [];
                    await initializePaste();
                }
            
            const now = Date.now();
            
            // Process messages meant for this bot ("login") and are recent (within 30 seconds)
            // Also filter out already processed messages
            const loginMessages = messages.filter(msg => 
                msg.bot === "login" && 
                (now - msg.timestamp) < 30000 &&
                !processedMessageIds.has(msg.id)
            );
                
                if (loginMessages.length > 0) {
                    const guild = client.guilds.cache.get(GUILD_ID);
                    if (guild) {
                        for (const msg of loginMessages) {
                            const channel = guild.channels.cache.get(msg.channelId);
                            if (channel) {
                                await channel.send(msg.message);
                                // Mark this message as processed
                                processedMessageIds.add(msg.id);
                            } else {
                                // Still mark as processed even if channel not found
                                processedMessageIds.add(msg.id);
                            }
                        }
                        
                        // Mark messages as processed by removing them
                        const beforeCount = messages.length;
                        const processedMessages = messages.filter(msg => 
                            !(msg.bot === "login" && processedMessageIds.has(msg.id))
                        );
                        const afterCount = processedMessages.length;
                        
                        // Clean up old message IDs (older than 2 minutes) to prevent memory leaks
                        const twoMinutesAgo = now - 120000;
                        for (const msgId of processedMessageIds) {
                            const msg = messages.find(m => m.id === msgId);
                            if (msg && (now - msg.timestamp) > 120000) {
                                processedMessageIds.delete(msgId);
                            }
                        }
                        
                        await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
                            method: "PUT",
                            headers: {
                                Authorization: `Bearer ${API_KEY}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                content: JSON.stringify(processedMessages, null, 2)
                            })
                        });
                    } else {
                        console.error(`Guild ${GUILD_ID} not found`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            isProcessing = false;
        }
    }, 5000); // Check every 5 seconds
});

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
const fs = require("fs/promises");
const path = require("path");
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));
// Redirect /proofs to /tabs/proofs.html
app.get("/proofs", (req, res) => {
    res.redirect("/tabs/proofs.html");
});

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

const PASTE_ID = "PKzNiJG1";
const ORDER_PASTE_ID = "OQooMS9z";

// Generate transaction ID function
function generateTransactionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9).toUpperCase();
}

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

const CART_DB_PATH = path.join(__dirname, "cart-db.json");

async function readCartDb() {
    try {
        const raw = await fs.readFile(CART_DB_PATH, "utf8");
        const parsed = JSON.parse(raw || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

async function writeCartDb(db) {
    await fs.writeFile(CART_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

// Authentication middleware for tabs
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify Firebase token
    admin.auth().verifyIdToken(token)
        .then(decodedToken => {
            req.user = decodedToken;
            next();
        })
        .catch(error => {
            console.error('Token verification failed:', error);
            res.status(401).json({ error: 'Invalid token' });
        });
}

// Serve tabs pages (with auth check for HTML)
app.get("/tabs/:tab", async (req, res) => {
    const { tab } = req.params;
    
    try {
        // Check if user is authenticated via Firebase
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            // User is authenticated, serve the page
            res.sendFile(path.join(__dirname, "public", "tabs", `${tab}.html`));
        } else {
            // User not authenticated, return 401 for popup handling
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        // Authentication failed, return 401 for popup handling
        res.status(401).json({ error: 'Authentication required' });
    }
});

// Serve orders page with auth check
app.get("/tabs/orders", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            res.sendFile(path.join(__dirname, "public", "tabs", "orders.html"));
        } else {
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication required' });
    }
});

// Dashboard statistics endpoint
app.get("/dashboard/stats", async (req, res) => {
    try {
        // Get total restocks count
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        const restocks = restocksParsed.ok ? parseOrdersContent(restocksParsed.content) : [];
        
        // Calculate total items restocked
        let totalItemsRestocked = 0;
        restocks.forEach(restock => {
            if (restock.items && Array.isArray(restock.items)) {
                restock.items.forEach(item => {
                    if (item.stockAdded) {
                        totalItemsRestocked += item.stockAdded;
                    } else {
                        totalItemsRestocked += 1; // Count as 1 if stockAdded not specified
                    }
                });
            }
        });
        
        // Get Discord member count (will be updated by Discord bot)
        const discordMembers = await getDiscordMemberCount();
        
        res.json({
            successCount: discordMembers || 0, // Success Count = Active Users (Discord members)
            discordMembers: discordMembers || 0,
            totalRestocks: totalItemsRestocked,
            totalRestockEntries: restocks.length
        });
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Discord information endpoint
app.get("/dashboard/discord", async (req, res) => {
    try {
        const memberCount = await getDiscordMemberCount();
        const channelName = await updateDiscordChannelName(memberCount);
        
        res.json({
            memberCount: memberCount || 0,
            channelName: channelName || `ghosts: #${memberCount || 0}`
        });
    } catch (error) {
        console.error('Failed to get Discord info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Discord member count storage
const DISCORD_STATS_PASTE_ID = "IWEJETFl";

// Get Discord member count (excluding bots)
async function getDiscordMemberCount() {
    try {
        const statsParsed = await readPasteContent(DISCORD_STATS_PASTE_ID);
        if (statsParsed.ok) {
            // Handle empty or invalid content
            let content = statsParsed.content || '{}';
            if (!content.trim()) {
                content = '{}';
            }
            
            // Try to parse JSON, handle errors gracefully
            try {
                const stats = JSON.parse(content);
                return stats.memberCount || 0;
            } catch (parseError) {
                console.error('JSON parse error, initializing paste:', parseError.message);
                // Initialize with valid JSON if parsing fails
                await writePasteContent(DISCORD_STATS_PASTE_ID, JSON.stringify({ memberCount: 0, lastUpdated: new Date().toISOString() }, null, 2));
                return 0;
            }
        }
        // Initialize the paste if it doesn't exist
        await writePasteContent(DISCORD_STATS_PASTE_ID, JSON.stringify({ memberCount: 0, lastUpdated: new Date().toISOString() }, null, 2));
        return 0;
    } catch (error) {
        console.error('Failed to get Discord member count:', error);
        return 0;
    }
}

// Update Discord channel name with member count
async function updateDiscordChannelName(memberCount) {
    try {
        return `ghosts: #${memberCount || 0}`;
    } catch (error) {
        console.error('Failed to update Discord channel name:', error);
        return 'ghosts: #0';
    }
}

// Update Discord member count (called by bot)
app.post('/discord/update-stats', async (req, res) => {
    try {
        const stats = req.body;
        
        if (!stats || typeof stats.memberCount !== 'number') {
            return res.status(400).json({ error: 'Invalid stats object' });
        }
        
        // Save full stats to paste
        const fullStats = {
            memberCount: stats.memberCount,
            lastUpdated: stats.lastUpdated || new Date().toISOString(),
            channelName: stats.channelName || `ghosts: #${stats.memberCount}`
        };
        
        const writeRes = await writePasteContent(DISCORD_STATS_PASTE_ID, JSON.stringify(fullStats, null, 2));
        
        if (writeRes.ok) {
            res.json({ success: true, stats: fullStats });
        } else {
            res.status(500).json({ error: 'Failed to save stats to /IWEJETFl' });
        }
    } catch (error) {
        console.error('Failed to update Discord stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve support page with auth check
app.get("/support", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            res.sendFile(path.join(__dirname, "public", "tabs", "support.html"));
        } else {
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication required' });
    }
});

// Serve restocks page with auth check
app.get("/restocks", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            res.sendFile(path.join(__dirname, "public", "tabs", "restocks.html"));
        } else {
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication required' });
    }
});

// Serve shop pages with auth check
app.get("/shop/:shop", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            res.sendFile(path.join(__dirname, "public", "shop", `${req.params.shop}.html`));
        } else {
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication required' });
    }
});

// Serve dashboard page with auth check
app.get("/dashboard", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await admin.auth().verifyIdToken(token);
            res.sendFile(path.join(__dirname, "public", "tabs", "dashboard.html"));
        } else {
            res.status(401).json({ error: 'Authentication required' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication required' });
    }
});

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
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
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

app.get("/cart", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });

        const db = await readCartDb();
        const items = Array.isArray(db[user.id]) ? db[user.id] : [];
        return res.json({ items });
    } catch (err) {
        console.error("Get cart failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put("/cart", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });

        const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
        const cleanItems = incoming
            .map(i => ({
                name: String(i.name || ""),
                price: Number(i.price || 0),
                img: String(i.img || ""),
                qty: Math.max(1, Number(i.qty || 1)),
                maxQty: Number.isFinite(+i.maxQty) ? Math.max(1, Number(i.maxQty)) : null
            }))
            .filter(i => i.name);

        const db = await readCartDb();
        db[user.id] = cleanItems;
        await writeCartDb(db);
        return res.json({ ok: true });
    } catch (err) {
        console.error("Save cart failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.delete("/cart", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });

        const db = await readCartDb();
        delete db[user.id];
        await writeCartDb(db);
        return res.json({ ok: true });
    } catch (err) {
        console.error("Clear cart failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put("/orders/:index/status", verifyToken, async (req, res) => {
    try {
        const index = Number(req.params.index);
        const status = req.body?.status;
        const declineReason = String(req.body?.declineReason || "").trim();
        if (!Number.isInteger(index) || index < 0) {
            return res.status(400).json({ error: "Invalid order index" });
        }
        if (!["accepted", "declined", "cancelled"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        if (status === "declined" && !declineReason) {
            return res.status(400).json({ error: "Decline reason is required" });
        }

        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) return res.status(parsed.status).json({ error: "Failed to load orders" });
        const orders = parseOrdersContent(parsed.content);
        if (!orders[index]) return res.status(404).json({ error: "Order not found" });

        const wasAccepted = orders[index].status === "accepted";
        const previousStatus = orders[index].status;
        orders[index].status = status;
        if (status === "declined") {
            orders[index].declineReason = declineReason;
        }

        
        if (status === "accepted" && !wasAccepted) {
            const channelId = await createOrderChannel(orders[index]);
            if (channelId) orders[index].channelId = channelId;
        }

        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) return res.status(writeRes.status).json({ error: "Failed to save order status" });

        return res.json({ ok: true });
    } catch (err) {
        console.error("Update order status failed:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete order (admin only)
app.delete("/orders/:index", verifyToken, async (req, res) => {
    try {
        const index = Number(req.params.index);
        
        if (!Number.isInteger(index) || index < 0) {
            return res.status(400).json({ error: "Invalid order index" });
        }

        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: "Failed to load orders" });
        }

        const orders = parseOrdersContent(parsed.content);
        
        if (!orders[index]) {
            return res.status(404).json({ error: "Order not found" });
        }

        const order = orders[index];
        
        // Only allow deletion of accepted orders or final results
        const deletableStatuses = ['accepted', 'success', 'declined', 'scammer_alert', 'wrong_order', 'cancelled'];
        if (!deletableStatuses.includes(order.status)) {
            return res.status(400).json({ error: "Can only remove accepted or completed orders" });
        }

        // Remove the order
        orders.splice(index, 1);
        
        // Save the updated orders
        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: "Failed to save orders" });
        }

        return res.json({ message: "Order removed successfully" });
    } catch (error) {
        console.error("Error removing order:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete order by ID (for final results)
app.delete("/orders/id/:orderId", verifyToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return res.status(400).json({ error: "Order ID required" });
        }

        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: "Failed to load orders" });
        }

        const orders = parseOrdersContent(parsed.content);
        const orderIndex = orders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ error: "Order not found" });
        }

        const order = orders[orderIndex];
        
        // Only allow deletion of accepted orders or final results
        const deletableStatuses = ['accepted', 'success', 'declined', 'scammer_alert', 'wrong_order', 'cancelled'];
        if (!deletableStatuses.includes(order.status)) {
            return res.status(400).json({ error: "Can only remove accepted or completed orders" });
        }

        // Remove the order
        orders.splice(orderIndex, 1);
        
        // Save the updated orders
        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: "Failed to save orders" });
        }

        return res.json({ message: "Order removed successfully" });
    } catch (error) {
        console.error("Error removing order:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Chat System
const CHAT_PASTE_ID = "lBybg0MJ";
const chatClients = new Set();
const typingUsers = new Map();

// Rate limiting for chat spam prevention
const messageRateLimit = new Map(); // userId -> { count: number, resetTime: number }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 5; // max 5 messages per minute

// Weekly reset functionality (Philippines time - UTC+8)
function getNextResetTime() {
    const now = new Date();
    // Convert to Philippines time (UTC+8)
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    // Get next Sunday at midnight (00:00)
    const daysUntilSunday = (7 - phTime.getDay()) % 7 || 7;
    const nextSunday = new Date(phTime);
    nextSunday.setDate(phTime.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0, 0);
    
    // Convert back to UTC for storage
    return new Date(nextSunday.getTime() - (8 * 60 * 60 * 1000));
}

function isRateLimited(userId) {
    const now = Date.now();
    const userLimit = messageRateLimit.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
        // Reset or create new limit
        messageRateLimit.set(userId, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return false;
    }
    
    if (userLimit.count >= RATE_LIMIT_MAX_MESSAGES) {
        return true;
    }
    
    userLimit.count++;
    return false;
}

// Weekly reset check and execution
async function checkAndResetChat() {
    try {
        const parsed = await readPasteContent(CHAT_PASTE_ID);
        if (!parsed.ok) return;
        
        const chatData = JSON.parse(parsed.content || '{}');
        const now = Date.now();
        
        // Check if reset is needed
        if (!chatData.lastReset || now >= chatData.lastReset) {
            // Reset chat messages
            await writePasteContent(CHAT_PASTE_ID, JSON.stringify({
                messages: [],
                lastReset: getNextResetTime().getTime()
            }, null, 2));
            
            // Broadcast reset to all clients
            broadcastToClients({
                type: 'chat_reset',
                nextReset: getNextResetTime().getTime()
            });
        }
    } catch (error) {
        console.error('Failed to check/reset chat:', error);
    }
}

// Schedule weekly reset check
setInterval(checkAndResetChat, 60000); // Check every minute

// Server-Sent Events for real-time updates
app.get('/chat/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const clientId = Date.now().toString();
    chatClients.add({ id: clientId, res });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Remove client on disconnect
    req.on('close', () => {
        chatClients.forEach(client => {
            if (client.id === clientId) {
                chatClients.delete(client);
            }
        });
    });
});

// Broadcast message to all connected clients
function broadcastToClients(data) {
    chatClients.forEach(client => {
        try {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            // Remove dead clients
            chatClients.delete(client);
        }
    });
}

// Get chat messages
app.get('/chat/messages', async (req, res) => {
    try {
        const parsed = await readPasteContent(CHAT_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: 'Failed to load chat messages' });
        }

        const chatData = JSON.parse(parsed.content || '{}');
        const messages = chatData.messages || [];
        
        res.json({
            messages,
            nextReset: chatData.lastReset || getNextResetTime().getTime()
        });
    } catch (error) {
        console.error('Failed to get chat messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send new message
app.post('/chat/message', async (req, res) => {
    try {
        // Check for both Discord and Firebase admin users
        let user = getDiscordUser(req);
        let isAdmin = false;

        if (!user) {
            // Check for Firebase admin user
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.split("Bearer ")[1];
                try {
                    const decoded = await admin.auth().verifyIdToken(token);
                    user = {
                        id: decoded.uid,
                        username: "Admin",
                        email: decoded.email,
                        avatar: "admin"
                    };
                    isAdmin = true;
                } catch {
                    return res.status(401).json({ error: 'Authentication required' });
                }
            } else {
                return res.status(401).json({ error: 'Authentication required' });
            }
        }

        const { text, replyTo } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        // Apply rate limiting (except for admins)
        if (!isAdmin && isRateLimited(user.id)) {
            return res.status(429).json({ error: 'Please wait before sending another message' });
        }

        // Load existing messages
        const parsed = await readPasteContent(CHAT_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: 'Failed to load chat messages' });
        }

        const chatData = JSON.parse(parsed.content || '{}');
        const messages = chatData.messages || [];
        
        // Check if user is muted
        const mutedUsers = new Set();
        // You could store muted users in a separate paste or database
        
        if (mutedUsers.has(user.id)) {
            return res.status(403).json({ error: 'You are muted' });
        }

        // Create new message
        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            text: text.trim(),
            timestamp: Date.now(),
            isAdmin: isAdmin,
            replyTo: replyTo || null
        };

        messages.push(message);

        // Save messages
        const writeRes = await writePasteContent(CHAT_PASTE_ID, JSON.stringify(messages, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save message' });
        }

        // Broadcast to all clients
        broadcastToClients({
            type: 'new_message',
            message
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete message (admin only)
app.delete('/chat/message/:messageId', verifyToken, async (req, res) => {
    try {
        const { messageId } = req.params;

        // Load messages
        const parsed = await readPasteContent(CHAT_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: 'Failed to load chat messages' });
        }

        const messages = parseOrdersContent(parsed.content);
        const messageIndex = messages.findIndex(m => m.id === messageId);

        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Remove message
        messages.splice(messageIndex, 1);

        // Save messages
        const writeRes = await writePasteContent(CHAT_PASTE_ID, JSON.stringify(messages, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save messages' });
        }

        // Broadcast deletion
        broadcastToClients({
            type: 'message_deleted',
            messageId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mute user (admin only)
app.post('/chat/mute', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        
        // In a real implementation, you'd store muted users in a database or separate paste
        // For now, we'll broadcast the mute event
        broadcastToClients({
            type: 'user_muted',
            userId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to mute user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Unmute user (admin only)
app.post('/chat/unmute', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        
        broadcastToClients({
            type: 'user_unmuted',
            userId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to unmute user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete all user messages (admin only)
app.post('/chat/delete-user-messages', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;

        // Load messages
        const parsed = await readPasteContent(CHAT_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: 'Failed to load chat messages' });
        }

        const messages = parseOrdersContent(parsed.content);
        
        // Filter out user's messages
        const filteredMessages = messages.filter(m => m.userId !== userId);

        // Save messages
        const writeRes = await writePasteContent(CHAT_PASTE_ID, JSON.stringify(filteredMessages, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save messages' });
        }

        // Broadcast that messages were deleted
        broadcastToClients({
            type: 'user_messages_deleted',
            userId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete user messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Typing indicator
app.post('/chat/typing', (req, res) => {
    try {
        const { userId, username, isTyping } = req.body;

        if (isTyping) {
            typingUsers.set(userId, username);
            // Clear typing indicator after 3 seconds
            setTimeout(() => {
                typingUsers.delete(userId);
                broadcastToClients({
                    type: 'typing',
                    userId,
                    username,
                    isTyping: false
                });
            }, 3000);
        } else {
            typingUsers.delete(userId);
        }

        broadcastToClients({
            type: 'typing',
            userId,
            username,
            isTyping
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to handle typing:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Restock System
const RESTOCK_PASTE_ID = "1J0ghD9n";
const RESTOCK_TRACKING_PASTE_ID = "1J0ghD9n"; // Use the same paste ID as requested
const ADMIN_PROFILE_PASTE_ID = "Rb1bV3T6";
const restockClients = new Set();

// Stock monitoring system
let previousMM2Stock = {};
const STOCK_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Initialize stock tracking
async function initializeStockTracking() {
    try {
        // Initialize restocks paste if needed
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        if (!restocksParsed.ok || restocksParsed.status === 404) {
            console.log('[STOCK] Initializing restocks paste...');
            const initRes = await writePasteContent(RESTOCK_PASTE_ID, JSON.stringify([], null, 2));
            if (initRes.ok) {
                console.log('[STOCK] Restocks paste initialized successfully');
            } else {
                console.error('[STOCK] Failed to initialize restocks paste');
            }
        } else {
            // Clean existing invalid restocks
            await cleanInvalidRestocks();
        }

        // Initialize MM2 stock tracking
        const mm2Parsed = await readPasteContent(MM2_PASTE_ID);
        if (mm2Parsed.ok) {
            const mm2Data = JSON.parse(mm2Parsed.content || '{}');
            previousMM2Stock = mm2Data.mm2 || {};
            console.log('[STOCK] Initial stock tracking initialized');
            console.log(`[STOCK] Tracking ${Object.keys(previousMM2Stock).length} items`);
        } else {
            console.error('[STOCK] Failed to load MM2 paste for initialization');
        }
    } catch (error) {
        console.error('[STOCK] Failed to initialize stock tracking:', error);
    }
}

// Clean invalid restocks function
async function cleanInvalidRestocks() {
    try {
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        if (!restocksParsed.ok) {
            return;
        }

        const restocks = parseOrdersContent(restocksParsed.content);
        const originalCount = restocks.length;
        
        // Filter out invalid restocks
        const validRestocks = restocks.filter(restock => {
            // Check if restock has valid items
            if (!restock.items || !Array.isArray(restock.items)) {
                return false;
            }
            
            // Check if all items in restock are valid
            return restock.items.some(item => 
                item && 
                item.name && 
                item.name.trim() && 
                item.price > 0
            );
        });
        
        // Only save if there are changes
        if (validRestocks.length !== originalCount) {
            const writeRes = await writePasteContent(RESTOCK_PASTE_ID, JSON.stringify(validRestocks, null, 2));
            if (writeRes.ok) {
                const removedCount = originalCount - validRestocks.length;
                console.log(`[STOCK] Auto-cleaned ${removedCount} invalid restock entries during initialization`);
            }
        }
    } catch (error) {
        console.error('[STOCK] Failed to clean invalid restocks:', error);
    }
}

// Monitor stock changes
async function monitorStockChanges() {
    try {
        const mm2Parsed = await readPasteContent(MM2_PASTE_ID);
        if (!mm2Parsed.ok) {
            console.log('[STOCK] Failed to fetch current stock');
            return;
        }

        const mm2Data = JSON.parse(mm2Parsed.content || '{}');
        const currentStock = mm2Data.mm2 || {};
        
        const changes = detectStockChanges(previousMM2Stock, currentStock);
        
        if (changes.length > 0) {
            console.log(`[STOCK] Detected ${changes.length} stock changes:`, changes.map(c => `${c.item} (${c.previousStock}→${c.newStock})`));
            await recordStockChanges(changes);
            previousMM2Stock = JSON.parse(JSON.stringify(currentStock)); // Deep copy
        }
    } catch (error) {
        console.error('[STOCK] Error monitoring stock changes:', error);
    }
}

// Detect changes between previous and current stock
function detectStockChanges(previous, current) {
    const changes = [];
    const allItems = new Set([...Object.keys(previous), ...Object.keys(current)]);
    
    for (const itemName of allItems) {
        const prevItem = previous[itemName];
        const currItem = current[itemName];
        
        const prevStock = prevItem ? prevItem.stock : 0;
        const currStock = currItem ? currItem.stock : 0;
        
        // Check for stock increase (restock) - this covers both new items and restocks
        if (currStock > prevStock) {
            const changeType = prevStock === 0 ? 'new_item' : 'restock';
            changes.push({
                type: changeType,
                item: itemName,
                previousStock: prevStock,
                newStock: currStock,
                change: currStock - prevStock,
                price: currItem ? currItem.price : (prevItem ? prevItem.price : 0),
                img: currItem ? currItem.img : (prevItem ? prevItem.img : '/images/default-item.png'),
                timestamp: new Date().toISOString()
            });
        }
    }
    
    return changes;
}

// Record stock changes to restock tracking
async function recordStockChanges(changes) {
    try {
        // Load existing restocks
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        const restocks = restocksParsed.ok ? parseOrdersContent(restocksParsed.content) : [];
        
        // Filter out invalid items and create restock entry
        const validChanges = changes.filter(change => 
            change.item && 
            change.item.trim() && 
            change.price > 0
        );
        
        if (validChanges.length === 0) {
            console.log('[STOCK] No valid items to record (all items had 0 price or no name)');
            return;
        }
        
        const restockItems = validChanges.map(change => ({
            name: change.item,
            price: change.price,
            img: change.img,
            stockAdded: change.change,
            previousStock: change.previousStock,
            newStock: change.newStock
        }));
        
        const restock = {
            id: `stock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            items: restockItems,
            date: new Date().toISOString(),
            adminName: 'MM2 Shop Monitor',
            type: 'automatic_restock',
            source: 'mm2_shop_monitoring'
        };
        
        restocks.unshift(restock);
        
        // Broadcast restock update
        broadcastRestockUpdate({
            type: 'new_restock',
            restock
        });
        
        // Save updated restocks
        const writeRes = await writePasteContent(RESTOCK_PASTE_ID, JSON.stringify(restocks, null, 2));
        if (writeRes.ok) {
            console.log(`[STOCK] Successfully recorded restock with ${changes.length} items`);
            console.log(`[STOCK] Restock ID: ${restock.id}, Items: ${restockItems.map(i => i.name).join(', ')}`);
        } else {
            console.error('[STOCK] Failed to save stock changes');
        }
        
    } catch (error) {
        console.error('[STOCK] Error recording stock changes:', error);
    }
}

// Start stock monitoring (independent of Discord bot)
async function startStockMonitoring() {
    try {
        // Initialize stock tracking
        await initializeStockTracking();
        
        // Start monitoring interval
        setInterval(monitorStockChanges, STOCK_CHECK_INTERVAL);
        console.log(`[STOCK] Stock monitoring started with ${STOCK_CHECK_INTERVAL/1000}s interval`);
    } catch (error) {
        console.error('[STOCK] Failed to start stock monitoring:', error);
    }
}

// Initialize stock monitoring when server starts
startStockMonitoring();

// Server-Sent Events for restock updates
app.get('/restock/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const clientId = Date.now().toString();
    restockClients.add({ id: clientId, res });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Remove client on disconnect
    req.on('close', () => {
        restockClients.forEach(client => {
            if (client.id === clientId) {
                restockClients.delete(client);
            }
        });
    });
});

// Broadcast restock updates to all connected clients
function broadcastRestockUpdate(data) {
    restockClients.forEach(client => {
        try {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            // Remove dead clients
            restockClients.delete(client);
        }
    });
}

// Get restocks
app.get('/restock', async (req, res) => {
    try {
        // Load restocks from restocks paste only
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        const restocks = restocksParsed.ok ? parseOrdersContent(restocksParsed.content) : [];
        
        console.log(`[STOCK] Loaded ${restocks.length} restocks from storage`);
        
        res.json({ restocks });
    } catch (error) {
        console.error('Failed to load restocks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add restock (admin only)
app.post('/restock', verifyToken, async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'Items are required' });
        }

        // Get admin info
        const decoded = req.user;
        const adminName = decoded.email || 'Admin';

        // Load existing restocks
        const parsed = await readPasteContent(RESTOCK_PASTE_ID);
        if (!parsed.ok) {
            return res.status(500).json({ error: 'Failed to load restocks' });
        }

        const restocks = parseOrdersContent(parsed.content);

        // Create new restock entry
        const restock = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            items: items,
            date: new Date().toISOString(),
            adminName: adminName
        };

        restocks.unshift(restock); // Add to beginning for newest first

        // Save restocks
        const writeRes = await writePasteContent(RESTOCK_PASTE_ID, JSON.stringify(restocks, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save restock' });
        }

        // Broadcast new restock
        broadcastRestockUpdate({
            type: 'new_restock',
            restock
        });

        res.json({ success: true, restock });
    } catch (error) {
        console.error('Failed to add restock:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get admin profile
app.get('/admin/profile', verifyToken, async (req, res) => {
    try {
        const decoded = req.user;
        const adminId = decoded.uid;

        const parsed = await readPasteContent(ADMIN_PROFILE_PASTE_ID);
        if (!parsed.ok) {
            return res.json({ displayName: decoded.email || 'Admin', avatar: null });
        }

        const profiles = parseOrdersContent(parsed.content);
        const profile = profiles.find(p => p.adminId === adminId);

        if (profile) {
            res.json(profile);
        } else {
            res.json({ displayName: decoded.email || 'Admin', avatar: null });
        }
    } catch (error) {
        console.error('Failed to load admin profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clean invalid restocks (admin only)
app.delete('/restock/clean', verifyToken, async (req, res) => {
    try {
        // Load existing restocks
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        if (!restocksParsed.ok) {
            return res.status(500).json({ error: 'Failed to load restocks' });
        }

        const restocks = parseOrdersContent(restocksParsed.content);
        const originalCount = restocks.length;
        
        // Filter out invalid restocks
        const validRestocks = restocks.filter(restock => {
            // Check if restock has valid items
            if (!restock.items || !Array.isArray(restock.items)) {
                return false;
            }
            
            // Check if all items in the restock are valid
            return restock.items.some(item => 
                item && 
                item.name && 
                item.name.trim() && 
                item.price > 0
            );
        });
        
        // Save cleaned restocks
        const writeRes = await writePasteContent(RESTOCK_PASTE_ID, JSON.stringify(validRestocks, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save cleaned restocks' });
        }
        
        const removedCount = originalCount - validRestocks.length;
        console.log(`[STOCK] Cleaned ${removedCount} invalid restock entries`);
        
        res.json({ 
            success: true, 
            message: `Removed ${removedCount} invalid restock entries`,
            remaining: validRestocks.length
        });
    } catch (error) {
        console.error('Failed to clean restocks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update admin profile
app.put('/admin/profile', verifyToken, async (req, res) => {
    try {
        const decoded = req.user;
        const adminId = decoded.uid;
        const { displayName, avatar } = req.body;

        if (!displayName || !displayName.trim()) {
            return res.status(400).json({ error: 'Display name is required' });
        }

        // Load existing profiles
        const parsed = await readPasteContent(ADMIN_PROFILE_PASTE_ID);
        const profiles = parsed.ok ? parseOrdersContent(parsed.content) : [];

        // Find or create profile
        let profileIndex = profiles.findIndex(p => p.adminId === adminId);
        const profile = {
            adminId,
            displayName: displayName.trim(),
            avatar: avatar || null,
            updatedAt: new Date().toISOString()
        };

        if (profileIndex >= 0) {
            profiles[profileIndex] = profile;
        } else {
            profiles.push(profile);
        }

        // Save profiles
        const writeRes = await writePasteContent(ADMIN_PROFILE_PASTE_ID, JSON.stringify(profiles, null, 2));
        if (!writeRes.ok) {
            return res.status(500).json({ error: 'Failed to save profile' });
        }

        res.json({ success: true, profile });
    } catch (error) {
        console.error('Failed to update admin profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const { createOrderChannel } = require("./orderBot");
const { addMute, removeMute, isMuted, muteLogs } = require("./managementBot");

app.post("/accept-order", async (req,res)=>{
    const order = req.body;
    await createOrderChannel(order);
    res.send("ok");
});

// Load proofs
app.get("/load/TK7bewK1", async (req, res) => {
    try {
        const parsed = await readPasteContent("TK7bewK1");
        if (!parsed.ok) {
            if (parsed.status === 404) {
                return res.json([]);
            }
            return res.status(parsed.status).json({ error: "Failed to load proofs" });
        }
        
        const proofs = JSON.parse(parsed.content || "[]");
        return res.json(proofs);
    } catch (error) {
        console.error("Load proofs failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Save proofs
app.post("/save/TK7bewK1", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });
        
        // Check if user is admin
        const adminUsers = await readAdminUsers();
        if (!adminUsers.includes(user.id)) {
            return res.status(403).json({ error: "Admin access required" });
        }
        
        const proofs = req.body;
        if (!Array.isArray(proofs)) {
            return res.status(400).json({ error: "Invalid proofs data" });
        }
        
        const writeRes = await writePasteContent("TK7bewK1", JSON.stringify(proofs, null, 2));
        if (!writeRes.ok) {
            return res.status(writeRes.status).json({ error: "Failed to save proofs" });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error("Save proofs failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update channel name based on proof count
app.post("/update-channel", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });
        
        // Check if user is admin
        const adminUsers = await readAdminUsers();
        if (!adminUsers.includes(user.id)) {
            return res.status(403).json({ error: "Admin access required" });
        }
        
        const { channelId, proofCount } = req.body;
        if (!channelId || typeof proofCount !== "number") {
            return res.status(400).json({ error: "Invalid request data" });
        }
        
        // This would require Discord bot integration to update channel name
        // For now, we'll just log it and return success
        console.log(`Channel ${channelId} should be renamed to:  Success: ${proofCount}`);
        
        return res.json({ success: true });
    } catch (error) {
        console.error("Update channel failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Load order final results (for transaction lookup)
app.get("/load/orderFinalResults", async (req, res) => {
    try {
        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) {
            return res.status(parsed.status).json({ error: "Failed to load orders" });
        }
        
        const orders = parseOrdersContent(parsed.content);
        const finalResults = orders.filter(order => 
            ["success", "wrong_order", "scammer_alert", "cancelled", "declined"].includes(order.status)
        );
        
        return res.json(finalResults);
    } catch (error) {
        console.error("Load order final results failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete order final result (admin only)
app.post("/delete-order-result", async (req, res) => {
    try {
        const user = getDiscordUser(req);
        if (!user) return res.status(401).json({ error: "Discord login required" });
        
        // Check if user is admin
        const adminUsers = await readAdminUsers();
        if (!adminUsers.includes(user.id)) {
            return res.status(403).json({ error: "Admin access required" });
        }
        
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ error: "Order ID required" });
        }
        
        const parsed = await readPasteContent(ORDER_PASTE_ID);
        if (!parsed.ok) {
            return res.status(parsed.status).json({ error: "Failed to load orders" });
        }
        
        const orders = parseOrdersContent(parsed.content);
        const orderIndex = orders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ error: "Order not found" });
        }
        
        // Reset order to pending status
        orders[orderIndex].status = "pending";
        delete orders[orderIndex].commandLocked;
        delete orders[orderIndex].lastCommand;
        delete orders[orderIndex].commandAt;
        delete orders[orderIndex].transactionId;
        
        const writeRes = await writePasteContent(ORDER_PASTE_ID, JSON.stringify(orders, null, 2));
        if (!writeRes.ok) {
            return res.status(writeRes.status).json({ error: "Failed to update order" });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error("Delete order result failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

async function readAdminUsers() {
    try {
        const parsed = await readPasteContent(ADMIN_PASTE_ID);
        if (!parsed.ok) return [];
        return JSON.parse(parsed.content || "[]");
    } catch (error) {
        console.error("Failed to read admin users:", error);
        return [];
    }
}

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

app.get("/me", async (req, res) => {
    const cookies = parseCookies(req);
    let user = null;
    let isAdmin = false;

    // Check Discord user first
    if (cookies.discord) {
        const [data, sig] = cookies.discord.split(".");
        const payload = Buffer.from(data, "base64").toString();

        if (sign(payload) === sig) {
            try {
                user = JSON.parse(payload);
                user.type = "discord";
            } catch {
                // Invalid Discord token
            }
        }
    }

    // Check Firebase admin user
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            if (!user) {
                user = {
                    id: decoded.uid,
                    username: decoded.email,
                    email: decoded.email,
                    type: "admin"
                };
            }
            isAdmin = true;
        } catch {
            // Invalid Firebase token
        }
    }

    if (user) {
        res.json({ ...user, isAdmin });
    } else {
        res.json(null);
    }
});

// Logout Discord
app.get("/logout-discord", (req, res) => {
    const domain = req.hostname;
    const isLocalhost = domain === "localhost" || domain === "127.0.0.1";

    const cookie = `discord=; Path=/; Max-Age=0; HttpOnly; SameSite=${isLocalhost ? 'Lax' : 'None'};${!isLocalhost ? ' Secure;' : ''}${!isLocalhost ? ` Domain=${domain}` : ''}`;

    res.setHeader("Set-Cookie", cookie);
    res.redirect("/");
});

