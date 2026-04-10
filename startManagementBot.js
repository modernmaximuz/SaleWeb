// Startup script for the Management Bot
console.log('Starting Discord Management Bot...');

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

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

// Check if environment variable is set
if (!process.env.MANAGE_BOT_TOKEN || process.env.MANAGE_BOT_TOKEN === 'your_discord_token_here') {
    console.error('ERROR: MANAGE_BOT_TOKEN environment variable is not set!');
    console.log('Please edit the .env file and replace "your_discord_token_here" with your actual Discord bot token.');
    process.exit(1);
}

// Start the management bot
require('./managementBot');
