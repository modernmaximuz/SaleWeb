const { Client, GatewayIntentBits, Message } = require("discord.js");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Configuration
const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SUPPORT_CHANNEL_ID = process.env.SUPPORT_CHANNEL_ID; // The Discord channel to monitor
const WEBHOOK_URL = process.env.SUPPORT_WEBHOOK_URL; // Webhook URL to send messages to Discord
const BASE = "https://pastefy.app/api/v2";
const API_KEY = process.env.API_KEY;
const CHAT_PASTE_ID = "lBybg0MJ";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store message references for replies
const messageReferences = new Map();

// Read chat messages from pastefy
async function readChatMessages() {
    try {
        const response = await fetch(`${BASE}/paste/${CHAT_PASTE_ID}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });
        
        if (!response.ok) {
            console.error('Failed to read chat messages:', response.status);
            return [];
        }
        
        const data = await response.json();
        const chatData = JSON.parse(data.content || '{}');
        return chatData.messages || [];
    } catch (error) {
        console.error('Error reading chat messages:', error);
        return [];
    }
}

// Send message to Discord via webhook
async function sendToDiscord(messageData) {
    if (!WEBHOOK_URL) {
        console.error('Webhook URL not configured');
        return;
    }

    try {
        let content = '';
        
        // If this is a reply, format it with ping and original message
        if (messageData.replyTo) {
            const originalMessage = messageData.replyTo;
            content = `<@${messageData.userId}> ${originalMessage.username} said:\n"${originalMessage.text}"\n\n${messageData.text}`;
        } else {
            content = messageData.text;
        }

        // Validate content length (Discord limit is 2000 characters)
        if (content.length > 2000) {
            content = content.substring(0, 1997) + '...';
        }

        // Construct proper avatar URL
        let avatarUrl = 'https://github.com/modernmaximuz/SaleWeb/blob/main/public/images/hades.gif?raw=true';
        if (messageData.avatar && messageData.avatar !== 'default') {
            avatarUrl = `https://cdn.discordapp.com/avatars/${messageData.userId}/${messageData.avatar}.png`;
        }

        console.log('Support bot sending to webhook:', { 
            username: messageData.username, 
            hasReply: !!messageData.replyTo,
            contentLength: content.length 
        });

        const payload = {
            content: content,
            username: messageData.username,
            avatar_url: avatarUrl
        };

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('Message sent to Discord:', messageData.username);
        } else {
            const errorText = await response.text();
            console.error('Failed to send to Discord from support bot:', response.status, errorText);
        }
    } catch (error) {
        console.error('Error sending to Discord from support bot:', error);
    }
}

// Forward Discord message to website chat
async function forwardToWebsite(message) {
    try {
        // Read current messages
        const messages = await readChatMessages();
        
        // Create new message object
        const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            userId: message.author.id,
            username: message.author.username,
            avatar: message.author.avatar,
            text: message.content,
            timestamp: Date.now(),
            isAdmin: message.member.roles.cache.some(role => 
                ['1491763556209786950', '1492197702807851049'].includes(role.id)
            ) // Check for Support Team or Mod role
        };

        // Store message reference for replies
        messageReferences.set(message.id, newMessage);

        // Add to messages array
        messages.push(newMessage);

        // Save to pastefy
        const response = await fetch(`${BASE}/paste/${CHAT_PASTE_ID}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: JSON.stringify({
                    messages: messages,
                    lastReset: getNextResetTime().getTime()
                }, null, 2)
            })
        });

        if (response.ok) {
            console.log('Message forwarded to website:', message.author.username);
        } else {
            console.error('Failed to forward message to website');
        }
    } catch (error) {
        console.error('Error forwarding to website:', error);
    }
}

// Handle Discord message with reply support
async function handleDiscordMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Only process messages in the support channel
    if (message.channelId !== SUPPORT_CHANNEL_ID) return;

    // Check if this is a reply to a message
    if (message.reference && message.reference.messageId) {
        try {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            
            // Check if the referenced message was forwarded from the website
            if (messageReferences.has(referencedMessage.id)) {
                const originalMessage = messageReferences.get(referencedMessage.id);
                
                // Format as reply with ping
                const replyData = {
                    userId: originalMessage.userId,
                    username: message.author.username,
                    avatar: message.author.avatar,
                    text: message.content,
                    replyTo: {
                        username: originalMessage.username,
                        text: originalMessage.text
                    },
                    timestamp: Date.now(),
                    isAdmin: true
                };

                // Forward to website as a reply
                const messages = await readChatMessages();
                messages.push({
                    ...replyData,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
                });

                await fetch(`${BASE}/paste/${CHAT_PASTE_ID}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        content: JSON.stringify({
                            messages: messages,
                            lastReset: getNextResetTime().getTime()
                        }, null, 2)
                    })
                });

                console.log('Reply forwarded to website');
                return;
            }
        } catch (error) {
            console.error('Error handling reply:', error);
        }
    }

    // Regular message - forward to website
    await forwardToWebsite(message);
}

// Get next reset time (same as in index.cjs)
function getNextResetTime() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);
    return nextSunday;
}

// Bot events
client.once('ready', async () => {
    console.log('Support Bot is ready!');
    console.log(`Logged in as: ${client.user.tag}`);
    console.log(`Monitoring channel: ${SUPPORT_CHANNEL_ID}`);
    
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.error(`ERROR: Bot is not in guild ${GUILD_ID}`);
            return;
        }
        console.log(`Found guild: ${guild.name}`);
        
        const channel = await guild.channels.fetch(SUPPORT_CHANNEL_ID);
        if (!channel) {
            console.error(`ERROR: Channel ${SUPPORT_CHANNEL_ID} not found`);
            return;
        }
        console.log(`Monitoring channel: ${channel.name}`);
    } catch (error) {
        console.error('Error in ready event:', error);
    }
});

client.on('messageCreate', async (message) => {
    await handleDiscordMessage(message);
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Start bot
console.log('Attempting to login to Discord...');
client.login(SUPPORT_BOT_TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error);
    if (error.code === 'TOKEN_INVALID') {
        console.error('ERROR: Invalid Discord token!');
    } else if (error.code === 'DISALLOWED_INTENTS') {
        console.error('ERROR: Missing required gateway intents!');
    }
});
