const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    process.env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
    }
}

loadEnv();

// Bot configuration
const BOT_TOKEN = process.env.MANAGE_BOT_TOKEN;
const GUILD_ID = "1492190841987666011";
const ADMIN_ROLE_ID = "1491763556209786950"; // Support Team role or higher
const MOD_ROLE_ID = "1492197702807851049"; // Mod role
const MUTED_ROLE_ID = "1492197287487606844"; // Muted role (you'll need to create this)
const BASE = "https://pastefy.app/api/v2";
const API_KEY = process.env.API_KEY;

// Mute storage (in production, use a database)
const mutes = new Map();
const muteLogs = [];

// Cross-bot communication
const BOT_COMMUNICATION_PASTE_ID = "Xy7zK9pL"; // New paste for bot communication

async function triggerBotMessage(botType, message, channelId) {
    try {
        // Store the message in the communication paste
        const current = await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });
        
        let messages = [];
        if (current.ok) {
            const data = await current.json();
            messages = JSON.parse(data.content || "[]");
        }
        
        messages.push({
            id: Date.now().toString(),
            bot: botType,
            message: message,
            channelId: channelId,
            timestamp: Date.now()
        });
        
        // Save to paste
        await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: JSON.stringify(messages, null, 2)
            })
        });
    } catch (error) {
        console.error('Failed to trigger bot message:', error);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Time parsing functions
function parseTime(timeStr) {
    const match = timeStr.match(/^(\d+)([mhdw])$/);
    if (!match) return null;
    
    const [, amount, unit] = match;
    const multipliers = {
        'm': 60 * 1000,        // minutes
        'h': 60 * 60 * 1000,  // hours  
        'd': 24 * 60 * 60 * 1000, // days
        'w': 7 * 24 * 60 * 60 * 1000 // weeks
    };
    
    return amount * multipliers[unit];
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return 'less than a minute';
}

// Role checking
function hasAdminRole(member) {
    return member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(MOD_ROLE_ID);
}

// Creative mute messages - different bots will send these
const muteMessages = [
    { bot: "login", message: "-user, your noise claws at my ears…" },
    { bot: "order", message: "-user, your words echo like chains in the underworld…" }, 
    { bot: "manager", message: "-user, enough of this relentless barking from you…" },
    { bot: "manager", message: "I command you to be silent for -time — mute!" }
];

// Mute management functions
async function addMute(userId, duration, moderatorId, reason) {
    const expiresAt = Date.now() + duration;
    mutes.set(userId, { expiresAt, moderatorId, reason });
    
    // Store mute log
    muteLogs.push({
        userId,
        moderatorId,
        reason,
        duration,
        expiresAt,
        timestamp: Date.now()
    });
    
    return expiresAt;
}

async function removeMute(userId) {
    mutes.delete(userId);
    return true;
}

function isMuted(userId) {
    const mute = mutes.get(userId);
    return mute && mute.expiresAt > Date.now();
}

// Check expired mutes
function checkExpiredMutes() {
    const now = Date.now();
    for (const [userId, mute] of mutes.entries()) {
        if (mute.expiresAt <= now) {
            mutes.delete(userId);
            // Try to remove muted role
            const guild = client.guilds.cache.get(GUILD_ID);
            const member = guild.members.cache.get(userId);
            if (member && member.roles.cache.has(MUTED_ROLE_ID)) {
                member.roles.remove(MUTED_ROLE_ID).catch(console.error);
            }
        }
    }
}

// Command handlers
async function handleMute(interaction) {
    if (!hasAdminRole(interaction.member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command!",
            ephemeral: true
        });
    }
    
    const user = interaction.options.getUser('user');
    const timeStr = interaction.options.getString('time');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!user) {
        return interaction.reply({
            content: "❌ Please specify a user to mute!",
            ephemeral: true
        });
    }
    
    const duration = parseTime(timeStr);
    if (!duration) {
        return interaction.reply({
            content: "❌ Invalid time format! Use formats like: 1m, 1h, 1d, 1w",
            ephemeral: true
        });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(user.id);
    
    if (!member) {
        return interaction.reply({
            content: "❌ User not found in this server!",
            ephemeral: true
        });
    }
    
    if (hasAdminRole(member)) {
        return interaction.reply({
            content: "❌ You cannot mute other staff members!",
            ephemeral: true
        });
    }
    
    // Add muted role
    await member.roles.add(MUTED_ROLE_ID);
    
    // Store mute
    const expiresAt = await addMute(user.id, duration, interaction.user.id, reason);
    
    // Send creative mute messages through different bots
    const channel = interaction.channel;
    const formattedTime = formatDuration(duration);
    
    for (let i = 0; i < muteMessages.length; i++) {
        setTimeout(async () => {
            let message = muteMessages[i].message
                .replace(/-user/g, user.username)
                .replace(/-time/g, formattedTime);
            
            // Trigger the appropriate bot to send the message
            await triggerBotMessage(muteMessages[i].bot, message, channel.id);
        }, i * 2000); // 2 second delay between messages
    }
    
    // Schedule unmute
    setTimeout(async () => {
        await removeMute(user.id);
        const guildMember = await guild.members.fetch(user.id);
        if (guildMember && guildMember.roles.cache.has(MUTED_ROLE_ID)) {
            await guildMember.roles.remove(MUTED_ROLE_ID);
        }
    }, duration);
    
    return interaction.reply({
        content: `✅ **${user.username} muted for ${formatDuration(duration)}**`,
        ephemeral: true
    });
}

async function handleUnmute(interaction) {
    if (!hasAdminRole(interaction.member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command!",
            ephemeral: true
        });
    }
    
    const user = interaction.options.getUser('user');
    
    if (!user) {
        return interaction.reply({
            content: "❌ Please specify a user to unmute!",
            ephemeral: true
        });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(user.id);
    
    if (!member) {
        return interaction.reply({
            content: "❌ User not found in this server!",
            ephemeral: true
        });
    }
    
    await removeMute(user.id);
    
    if (member.roles.cache.has(MUTED_ROLE_ID)) {
        await member.roles.remove(MUTED_ROLE_ID);
    }
    
    return interaction.reply({
        content: `✅ **${user.username} has been unmuted**`,
        ephemeral: true
    });
}

async function handleKick(interaction) {
    if (!hasAdminRole(interaction.member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command!",
            ephemeral: true
        });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!user) {
        return interaction.reply({
            content: "❌ Please specify a user to kick!",
            ephemeral: true
        });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(user.id);
    
    if (!member) {
        return interaction.reply({
            content: "❌ User not found in this server!",
            ephemeral: true
        });
    }
    
    if (hasAdminRole(member)) {
        return interaction.reply({
            content: "❌ You cannot kick other staff members!",
            ephemeral: true
        });
    }
    
    await member.kick(reason);
    
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('👢 User Kicked')
        .setDescription(`**${user.username}** has been kicked from the server`)
        .addFields(
            { name: 'Reason', value: reason, inline: true },
            { name: 'Moderator', value: interaction.user.username, inline: true }
        )
        .setTimestamp();
    
    await interaction.channel.send({ embeds: [embed] });
    
    return interaction.reply({
        content: `✅ **${user.username} has been kicked**`,
        ephemeral: true
    });
}

async function handleBan(interaction) {
    if (!hasAdminRole(interaction.member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command!",
            ephemeral: true
        });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!user) {
        return interaction.reply({
            content: "❌ Please specify a user to ban!",
            ephemeral: true
        });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(user.id);
    
    if (!member) {
        return interaction.reply({
            content: "❌ User not found in this server!",
            ephemeral: true
        });
    }
    
    if (hasAdminRole(member)) {
        return interaction.reply({
            content: "❌ You cannot ban other staff members!",
            ephemeral: true
        });
    }
    
    await member.ban({ reason });
    
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 User Banned')
        .setDescription(`**${user.username}** has been banned from the server`)
        .addFields(
            { name: 'Reason', value: reason, inline: true },
            { name: 'Moderator', value: interaction.user.username, inline: true }
        )
        .setTimestamp();
    
    await interaction.channel.send({ embeds: [embed] });
    
    return interaction.reply({
        content: `✅ **${user.username} has been banned**`,
        ephemeral: true
    });
}

async function handleNickname(interaction) {
    if (!hasAdminRole(interaction.member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command!",
            ephemeral: true
        });
    }
    
    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    
    if (!user) {
        return interaction.reply({
            content: "❌ Please specify a user to change nickname!",
            ephemeral: true
        });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(user.id);
    
    if (!member) {
        return interaction.reply({
            content: "❌ User not found in this server!",
            ephemeral: true
        });
    }
    
    await member.setNickname(nickname);
    
    return interaction.reply({
        content: `✅ **${user.username}**'s nickname changed to **${nickname}**`,
        ephemeral: true
    });
}

// Register slash commands
async function registerCommands() {
    const commands = [
        {
            name: 'mute',
            description: 'Mute a user for a specified duration',
            options: [
                {
                    name: 'user',
                    description: 'The user to mute',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'time',
                    description: 'Duration (1m, 1h, 1d, 1w)',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for mute',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'unmute',
            description: 'Unmute a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to unmute',
                    type: 6, // USER
                    required: true
                }
            ]
        },
        {
            name: 'kick',
            description: 'Kick a user from the server',
            options: [
                {
                    name: 'user',
                    description: 'The user to kick',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for kick',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'ban',
            description: 'Ban a user from the server',
            options: [
                {
                    name: 'user',
                    description: 'The user to ban',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for ban',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'nickname',
            description: 'Change a user\'s nickname',
            options: [
                {
                    name: 'user',
                    description: 'The user to change nickname for',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'nickname',
                    description: 'New nickname',
                    type: 3, // STRING
                    required: true
                }
            ]
        }
    ];
    
    await client.application.commands.set(commands, GUILD_ID);
}

// Bot events
client.once('ready', async () => {
    console.log('Management Bot is ready!');
    console.log(`Logged in as: ${client.user.tag}`);
    console.log(`Bot ID: ${client.user.id}`);
    console.log(`Guild ID: ${GUILD_ID}`);
    
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.error(`ERROR: Bot is not in guild ${GUILD_ID}`);
            return;
        }
        console.log(`Found guild: ${guild.name}`);
        
        await registerCommands();
        console.log('Commands registered successfully!');
        
        // Check expired mutes every minute
        setInterval(checkExpiredMutes, 60000);
    } catch (error) {
        console.error('Error in ready event:', error);
    }
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('shardError', (error) => {
    console.error('Shard error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    switch (interaction.commandName) {
        case 'mute':
            await handleMute(interaction);
            break;
        case 'unmute':
            await handleUnmute(interaction);
            break;
        case 'kick':
            await handleKick(interaction);
            break;
        case 'ban':
            await handleBan(interaction);
            break;
        case 'nickname':
            await handleNickname(interaction);
            break;
    }
});

// Check for cross-bot messages
setInterval(async () => {
    try {
        const response = await fetch(`${BASE}/paste/${BOT_COMMUNICATION_PASTE_ID}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const messages = JSON.parse(data.content || "[]");
            const now = Date.now();
            
            // Process messages meant for this bot and are recent (within 30 seconds)
            const managerMessages = messages.filter(msg => 
                msg.bot === "manager" && 
                (now - msg.timestamp) < 30000
            );
            
            if (managerMessages.length > 0) {
                const guild = client.guilds.cache.get(GUILD_ID);
                if (guild) {
                    for (const msg of managerMessages) {
                        const channel = guild.channels.cache.get(msg.channelId);
                        if (channel) {
                            await channel.send(msg.message);
                        }
                    }
                    
                    // Mark messages as processed by removing them
                    const processedMessages = messages.filter(msg => 
                        !(msg.bot === "manager" && (now - msg.timestamp) < 30000)
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

// Start bot with better error handling
console.log('Attempting to login to Discord...');
client.login(BOT_TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error);
    if (error.code === 'TOKEN_INVALID') {
        console.error('ERROR: Invalid Discord token!');
    } else if (error.code === 'DISALLOWED_INTENTS') {
        console.error('ERROR: Missing required gateway intents!');
    }
});

module.exports = { addMute, removeMute, isMuted, muteLogs };
