const MM2_PASTE_ID = "fZ3piaUg";
const { Client, GatewayIntentBits } = require("discord.js");

// Cross-bot communication constants
const BOT_COMMUNICATION_PASTE_ID = "Xy7zK9pL";
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

client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);
    
    // Check for cross-bot messages
    setInterval(async () => {
        try {
            console.log(`[DEBUG] Checking for bot messages...`);
            const response = await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const messages = JSON.parse(data.content || "[]");
                const now = Date.now();
                
                console.log(`[DEBUG] Found ${messages.length} total messages in paste`);
                
                // Process messages meant for this bot ("login") and are recent (within 30 seconds)
                const loginMessages = messages.filter(msg => 
                    msg.bot === "login" && 
                    (now - msg.timestamp) < 30000
                );
                
                console.log(`[DEBUG] Found ${loginMessages.length} messages for login bot`);
                
                if (loginMessages.length > 0) {
                    const guild = client.guilds.cache.get(GUILD_ID);
                    if (guild) {
                        console.log(`[DEBUG] Found guild: ${guild.name}`);
                        for (const msg of loginMessages) {
                            const channel = guild.channels.cache.get(msg.channelId);
                            if (channel) {
                                console.log(`[DEBUG] Sending message to channel ${msg.channelId}: ${msg.message}`);
                                await channel.send(msg.message);
                            } else {
                                console.log(`[DEBUG] Channel ${msg.channelId} not found`);
                            }
                        }
                        
                        // Mark messages as processed by removing them
                        const processedMessages = messages.filter(msg => 
                            !(msg.bot === "login" && (now - msg.timestamp) < 30000)
                        );
                        
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
                        
                        console.log(`[DEBUG] Processed and removed ${loginMessages.length} messages`);
                    } else {
                        console.log(`[DEBUG] Guild ${GUILD_ID} not found`);
                    }
                }
            } else {
                console.log(`[DEBUG] Failed to fetch messages: ${response.status}`);
            }
        } catch (error) {
            console.error('Error checking bot messages:', error);
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

// Serve tabs pages
app.get("/tabs/:tab", (req, res) => {
    const { tab } = req.params;
    res.sendFile(path.join(__dirname, "public", "tabs", `${tab}.html`));
});

// Serve support page directly
app.get("/support", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tabs", "support.html"));
});

app.get("/restocks", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tabs", "restocks.html"));
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
        return res.status(500).json({ error: "Failed to remove order" });
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
const RESTOCK_TRACKING_PASTE_ID = "2K4lmN8p"; // New paste for accurate time tracking
const ADMIN_PROFILE_PASTE_ID = "Rb1bV3T6";
const restockClients = new Set();

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
        // Load restocks from restocks paste
        const restocksParsed = await readPasteContent(RESTOCK_PASTE_ID);
        const restocks = restocksParsed.ok ? parseOrdersContent(restocksParsed.content) : [];

        // Load MM2 stocks from MM2 paste
        const mm2Parsed = await readPasteContent("fZ3piaUg");
        let mm2Stocks = [];
        
        if (mm2Parsed.ok) {
            try {
                const mm2Data = JSON.parse(mm2Parsed.content || '{}');
                const mm2 = mm2Data.mm2 || {};
                
                // Convert MM2 stocks to restock format
                mm2Stocks = Object.entries(mm2)
                    .filter(([name, data]) => data.stock > 0) // Only show items with stock
                    .map(([name, data]) => ({
                        id: Date.now() + Math.random(), // Generate unique ID
                        title: "MM2 Stock Update",
                        date: new Date().toISOString(),
                        admin: "System",
                        items: [{
                            name: name,
                            price: data.price,
                            image: data.img,
                            stock: data.stock
                        }]
                    }));
            } catch (error) {
                console.error('Failed to parse MM2 data:', error);
            }
        }

        // Combine both sources
        const allRestocks = [...mm2Stocks, ...restocks];
        
        res.json({ restocks: allRestocks });
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

