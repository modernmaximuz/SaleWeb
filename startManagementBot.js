// Startup script for the Management Bot
console.log('Starting Discord Management Bot...');

// Check if environment variable is set
if (!process.env.MANAGE_BOT_TOKEN) {
    console.error('ERROR: MANAGE_BOT_TOKEN environment variable is not set!');
    console.log('Please set it with: export MANAGE_BOT_TOKEN="your_discord_token_here"');
    process.exit(1);
}

// Start the management bot
require('./managementBot');
