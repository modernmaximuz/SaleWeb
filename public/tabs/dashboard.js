// Dashboard JavaScript
let currentUser = null;
let isAdmin = false;

// Initialize dashboard
async function initDashboard() {
    try {
        // Hide loading overlay
        setTimeout(() => {
            document.getElementById('loadingOverlay').classList.add('hidden');
        }, 1000);
        
        // Check if user is logged in
        const headers = {};
        
        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
            const token = await firebase.auth().currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        }
        
        const res = await fetch('/me', { headers });
        const user = await res.json();
        
        if (user) {
            currentUser = user;
            isAdmin = !!user.isAdmin;
        }
        
        // Load dashboard data
        await loadDashboardData();
        
        // Set up auto-refresh
        setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
        
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const [statsData, discordData] = await Promise.all([
            fetch('/dashboard/stats'),
            fetch('/dashboard/discord')
        ]);
        
        const stats = await statsData.json();
        const discord = await discordData.json();
        
        // Update statistics
        updateStatistics(stats);
        updateDiscordInfo(discord);
        
        // Update last update time
        updateLastUpdateTime();
        
        // Update API status
        document.getElementById('apiStatus').textContent = 'Connected';
        document.getElementById('apiStatus').style.color = '#28a745';
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        document.getElementById('apiStatus').textContent = 'Error';
        document.getElementById('apiStatus').style.color = '#dc3545';
    }
}

// Update statistics display
function updateStatistics(stats) {
    // Success Count (HITS_COUNT equivalent)
    const successCountEl = document.getElementById('successCount');
    if (successCountEl) {
        successCountEl.textContent = stats.successCount || 0;
    }
    
    // Discord Members (ACTIVE_USERS equivalent)
    const discordMembersEl = document.getElementById('discordMembers');
    if (discordMembersEl) {
        discordMembersEl.textContent = stats.discordMembers || 0;
    }
    
    // Total Restocks (TOTAL_VALUE equivalent)
    const totalRestocksEl = document.getElementById('totalRestocks');
    if (totalRestocksEl) {
        totalRestocksEl.textContent = stats.totalRestocks || 0;
    }
}

// Update Discord information
function updateDiscordInfo(discord) {
    // Update channel name
    const channelNameEl = document.getElementById('channelName');
    if (channelNameEl && discord.channelName) {
        channelNameEl.textContent = discord.channelName;
    }
}

// Update last update time
function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Manila'
        });
        lastUpdateEl.textContent = formattedTime + ' PHT';
    }
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDashboard);
