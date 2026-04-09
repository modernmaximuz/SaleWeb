const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require("discord.js");
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

const ORDER_PASTE_ID = "OQooMS9z";
const CUSTOMER_CATEGORY_ID = "1491299595018305566";
const SUPPORT_ROLE_ID = "1491763556209786950";
const SCAMMER_ROLE_ID = "1491771111426363562";
const BASE = "https://pastefy.app/api/v2";
const API_KEY = process.env.API_KEY;
const GUILD_ID = process.env.GUILD_ID;

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

async function updateOrderResultByChannel(channelId, result) {
    const orders = await readOrders();
    const index = orders.findIndex(o => o.channelId === channelId);
    if (index < 0) return false;
    orders[index].status = result;
    await saveOrders(orders);
    return true;
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
            await updateOrderResultByChannel(channel.id, "success");
            await interaction.reply("Transaction Success (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Success**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "wrongorder") {
            await updateOrderResultByChannel(channel.id, "wrong_order");
            await interaction.reply("Wrong Order. Please create a new one (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Wrong Order**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "cancel") {
            await updateOrderResultByChannel(channel.id, "cancelled");
            await interaction.reply("Transaction is Cancelled (deleting channel in one hour).");
            await closeChannelInOneHour(channel, "This order is marked **Cancelled**. Channel will be deleted in 1 hour.");
            return;
        }

        if (commandName === "scam") {
            const orders = await readOrders();
            const order = orders.find(o => o.channelId === channel.id);
            if (order?.discordId && guild) {
                const member = await guild.members.fetch(order.discordId);
                await member.roles.add(SCAMMER_ROLE_ID);
            }

            await channel.setName(`${(order?.user || "user").toLowerCase()}-scammer`);
            await updateOrderResultByChannel(channel.id, "scammer_alert");
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
