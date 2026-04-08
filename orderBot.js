const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require("discord.js");

const client = new Client({
    intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("ready", ()=>console.log("Order bot ready"));

async function createOrderChannel(order) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(order.discordId);

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
            }
        ]
    });

    channel.send("Order:\n" + JSON.stringify(order.items, null, 2));
}

client.login(process.env.ORDER_BOT_TOKEN);

module.exports = { createOrderChannel };
