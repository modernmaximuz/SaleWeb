const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require("discord.js");

const client = new Client({
    intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("ready", ()=>console.log("Order bot ready"));

async function createOrderChannel(order) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(order.discordId);
    const supportRoleId = "1491763556209786950";
    const formatPeso = (value) => Number((Number(value || 0) + Number.EPSILON).toFixed(2)).toString();

    const channel = await guild.channels.create({
        name: `${order.user}-customer`,
type: ChannelType.GuildText,
        parent: "1491299595018305566",
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
                id: supportRoleId,
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

channel.send(msg);
}

client.login(process.env.ORDER_BOT_TOKEN);

module.exports = { createOrderChannel };
