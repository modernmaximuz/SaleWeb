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
        // Load stats from backend
        const statsData = await fetch('/dashboard/stats');
        const stats = await statsData.json();
        
        // Load Discord data directly from /IWEJETFl paste
        const discordData = await fetch('/load/IWEJETFl');
        const discord = await discordData.json();
        
        // Update statistics
        updateStatistics(stats);
        updateDiscordInfo(discord);
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
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
    // Update Discord members count from /IWEJETFl paste
    const discordMembersEl = document.getElementById('discordMembers');
    if (discordMembersEl && discord.memberCount !== undefined) {
        discordMembersEl.textContent = discord.memberCount;
    }
    
    // Update success count to match Discord members
    const successCountEl = document.getElementById('successCount');
    if (successCountEl && discord.memberCount !== undefined) {
        successCountEl.textContent = discord.memberCount;
    }
    
    console.log(`[DASHBOARD] Updated Discord members: ${discord.memberCount}`);
    console.log(`[DASHBOARD] Updated success count: ${discord.memberCount}`);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDashboard);
