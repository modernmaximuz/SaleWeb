// Simple test bot to debug connection issues
const { Client, GatewayIntentBits } = require("discord.js");

const BOT_TOKEN = process.env.MANAGE_BOT_TOKEN;
const GUILD_ID = "1490558125303009280";

console.log('=== BOT DEBUG TEST ===');
console.log('Token exists:', !!BOT_TOKEN);
console.log('Token length:', BOT_TOKEN ? BOT_TOKEN.length : 0);
console.log('Guild ID:', GUILD_ID);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('ready', () => {
    console.log('✅ Bot connected successfully!');
    console.log('Bot user:', client.user.tag);
    console.log('Bot ID:', client.user.id);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
        console.log('✅ Found guild:', guild.name);
        console.log('Guild member count:', guild.memberCount);
    } else {
        console.log('❌ ERROR: Bot not in guild', GUILD_ID);
        console.log('Available guilds:', client.guilds.cache.map(g => g.name));
    }
});

client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

console.log('=== ATTEMPTING LOGIN ===');
client.login(BOT_TOKEN).catch(error => {
    console.error('❌ Login failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
});
