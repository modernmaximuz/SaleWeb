const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require("discord.js");
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

const ORDER_PASTE_ID = "OQooMS9z";
const MM2_PASTE_ID = "fZ3piaUg";
const CUSTOMER_CATEGORY_ID = "1491299595018305566";
const SUPPORT_ROLE_ID = "1491763556209786950";
const SCAMMER_ROLE_ID = "1491771111426363562";
const BASE = "https://pastefy.app/api/v2";
const API_KEY = process.env.API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const BOT_COMMUNICATION_PASTE_ID = "Jk84rCKt"; // Same paste for bot communication

const client = new Client({
    intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();

async function readOrders() {
    const r = await fetch(`${BASE}/paste/${ORDER_PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const json = await r.json();
    if (!r.ok) return [];
    try {
        const parsed = JSON.parse(json.content || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function saveOrders(orders) {
    const current = await fetch(`${BASE}/paste/${ORDER_PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const paste = await current.json();
    paste.content = JSON.stringify(orders, null, 2);

    await fetch(`${BASE}/paste/${ORDER_PASTE_ID}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(paste)
    });
}

async function readMm2Stock() {
    const r = await fetch(`${BASE}/paste/${MM2_PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const json = await r.json();
    if (!r.ok) return null;
    try {
        return JSON.parse(json.content || "{}");
    } catch {
        return null;
    }
}

async function saveMm2Stock(stockData) {
    const current = await fetch(`${BASE}/paste/${MM2_PASTE_ID}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const paste = await current.json();
    paste.content = JSON.stringify(stockData, null, 2);
    await fetch(`${BASE}/paste/${MM2_PASTE_ID}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(paste)
    });
}

async function deductRealStockFromOrder(order) {
    const stockData = await readMm2Stock();
    if (!stockData || !stockData.mm2) return;

    for (const item of order.items || []) {
        const name = item.name;
        const qty = Math.max(0, Number(item.qty || 0));
        if (!stockData.mm2[name]) continue;
        const current = Number(stockData.mm2[name].stock || 0);
        stockData.mm2[name].stock = Math.max(0, current - qty);
    }

    await saveMm2Stock(stockData);
}

async function updateOrderResultByChannel(channelId, result, commandName) {
    const orders = await readOrders();
    const index = orders.findIndex(o => o.channelId === channelId);
    if (index < 0) return null;
    if (orders[index].commandLocked) {
        return { blocked: true, order: orders[index] };
    }
    const before = orders[index].status;
    orders[index].status = result;
    orders[index].commandLocked = true;
    orders[index].lastCommand = commandName;
    orders[index].commandAt = new Date().toISOString();
    await saveOrders(orders);
    return { order: orders[index], previousStatus: before };
}

async function registerCommands() {
    if (!client.application) return;
    await client.application.commands.set([
        { name: "success", description: "Say transaction success and close channel in 1 hour" },
        { name: "scam", description: "Mark as scammer, apply role, and close in 1 hour" },
        { name: "wrongorder", description: "Mark as wrong order and close in 1 hour" },
        { name: "cancel", description: "Mark as cancelled and close in 1 hour" }
    ], GUILD_ID);
}

client.on("ready", async () => {
    console.log("Order bot ready");
    await registerCommands();
    
    // Check for cross-bot messages
    setInterval(async () => {
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
                    console.log('[DEBUG] Invalid JSON in paste, using empty array');
                    messages = [];
                }
                const now = Date.now();
                
                // Process messages meant for this bot and are recent (within 30 seconds)
                const orderMessages = messages.filter(msg => 
                    msg.bot === "order" && 
                    (now - msg.timestamp) < 30000
                );
                
                if (orderMessages.length > 0) {
                    const guild = client.guilds.cache.get(GUILD_ID);
                    if (guild) {
                        for (const msg of orderMessages) {
                            const channel = guild.channels.cache.get(msg.channelId);
                            if (channel) {
                                await channel.send(msg.message);
                            }
                        }
                        
                        // Mark messages as processed by removing them
                        const processedMessages = messages.filter(msg => 
                            !(msg.bot === "order" && (now - msg.timestamp) < 30000)
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
                    }
                }
            }
        } catch (error) {
            console.error('Error checking bot messages:', error);
        }
    }, 5000); // Check every 5 seconds
});

async function createOrderChannel(order) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(order.discordId);

    const channel = await guild.channels.create({
        name: `${order.user}-customer`,
type: ChannelType.GuildText,
        parent: CUSTOMER_CATEGORY_ID,
        topic: `order:${order.discordId}`,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: member.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.AttachFiles
                ]
            },
            {
                id: SUPPORT_ROLE_ID,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages
                ]
            }
        ]
    });

    let total = 0;

let msg = `🧾 **Order Summary**\n\n`;

order.items.forEach(i=>{
    const subtotal = i.price * i.qty;
    total += subtotal;

    msg += `• ${i.name} x${i.qty} = ₱${formatPeso(subtotal)}\n`;
});

msg += `\n💰 **Total: ₱${formatPeso(total)}**`;

await channel.send(msg);
return channel.id;
}

function inCustomerChannel(interaction) {
    const channel = interaction.channel;
    return !!channel && channel.parentId === CUSTOMER_CATEGORY_ID;
}

function hasRequiredRole(interaction, requiredRoleIds = [SUPPORT_ROLE_ID]) {
    const member = interaction.member;
    if (!member) return false;
    
    // Check if user has any of the required roles
    return requiredRoleIds.some(roleId => member.roles.cache.has(roleId));
}

async function closeChannelInOneHour(channel, note) {
    await channel.send(note);
    setTimeout(async () => {
        try {
            await channel.delete("Order flow completed");
        } catch (err) {
            console.error("Failed to delete channel:", err);
        }
    }, 60 * 60 * 1000);
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (!["success", "scam", "wrongorder", "cancel"].includes(commandName)) return;

    // Check if user has required role permissions
    if (!hasRequiredRole(interaction)) {
        await interaction.reply({
            content: "You don't have permission to use this command. Required role: Support Team or higher.",
            ephemeral: true
        });
        return;
    }

    if (!inCustomerChannel(interaction)) {
        await interaction.reply({
            content: "This command only works in customer channels.",
            ephemeral: true
        });
        return;
    }

    const channel = interaction.channel;
    const guild = interaction.guild;

    try {
        if (commandName === "success") {
            const update = await updateOrderResultByChannel(channel.id, "success", commandName);
            if (update?.blocked) {
                await interaction.reply({ content: "A command was already used for this ticket.", ephemeral: true });
                return;
            }
            if (update?.order && update.previousStatus !== "success") {
                await deductRealStockFromOrder(update.order);
            }
            await interaction.reply("Transaction Success (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Success**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "wrongorder") {
            const update = await updateOrderResultByChannel(channel.id, "wrong_order", commandName);
            if (update?.blocked) {
                await interaction.reply({ content: "A command was already used for this ticket.", ephemeral: true });
                return;
            }
            await interaction.reply("Wrong Order. Please create a new one (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Wrong Order**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "cancel") {
            const update = await updateOrderResultByChannel(channel.id, "cancelled", commandName);
            if (update?.blocked) {
                await interaction.reply({ content: "A command was already used for this ticket.", ephemeral: true });
                return;
            }
            await interaction.reply("Transaction is Cancelled (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Cancelled**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "scam") {
            const orders = await readOrders();
            const order = orders.find(o => o.channelId === channel.id);
            if (order?.commandLocked) {
                await interaction.reply({ content: "A command was already used for this ticket.", ephemeral: true });
                return;
            }
            if (order?.discordId && guild) {
                const member = await guild.members.fetch(order.discordId);
                await member.roles.add(SCAMMER_ROLE_ID);
            }

            await channel.setName(`${(order?.user || "user").toLowerCase()}-scammer`);
            await updateOrderResultByChannel(channel.id, "scammer_alert", commandName);
            await interaction.reply("Scammer Detected (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Scammer Alert**. Channel will be deleted in 1 hour.");
        }
    } catch (err) {
        console.error("Command handling failed:", err);
        if (!interaction.replied) {
            await interaction.reply({ content: "Command failed.", ephemeral: true });
        }
    }
});

client.login(process.env.ORDER_BOT_TOKEN);

module.exports = { createOrderChannel };
