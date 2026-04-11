let currentUser = null;
let isAdmin = false;
let restocks = [];
let eventSource = null;
let groupedRestocks = {};
let statistics = {
    totalRestocks: 0,
    totalItems: 0,
    lastUpdate: null
};

// Initialize restock page
async function initRestock() {
    try {
        // Check if user is logged in
        const headers = {};
        
        // Add Firebase token for admin users
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
        
        await loadRestocks();
        setupEventListeners();
        connectRealTime();
        updateUI();
        
    } catch (error) {
        console.error('Failed to initialize restock page:', error);
    }
}

// Load existing restocks
async function loadRestocks() {
    try {
        const res = await fetch('/restock');
        const data = await res.json();
        
        if (data.restocks) {
            restocks = data.restocks;
            processRestocks();
            renderRestocks();
            updateStatistics();
        }
    } catch (error) {
        console.error('Failed to load restocks:', error);
        restocks = [];
    }
}

// Process restocks to group by hour and calculate statistics
function processRestocks() {
    groupedRestocks = {};
    statistics = {
        totalRestocks: 0,
        totalItems: 0,
        lastUpdate: null
    };
    
    restocks.forEach(restock => {
        const date = new Date(restock.date);
        // Use UTC date to avoid local timezone conversion
        const hour = date.getUTCHours();
        const dateKey = date.toLocaleDateString('en-US', { timeZone: 'UTC' });
        
        // Group by hour
        if (!groupedRestocks[dateKey]) {
            groupedRestocks[dateKey] = {};
        }
        if (!groupedRestocks[dateKey][hour]) {
            groupedRestocks[dateKey][hour] = [];
        }
        
        groupedRestocks[dateKey][hour].push(restock);
        
        // Calculate statistics
        statistics.totalRestocks++;
        statistics.totalItems += restock.items ? restock.items.length : 0;
        
        // Update last update time
        if (!statistics.lastUpdate || date > new Date(statistics.lastUpdate)) {
            statistics.lastUpdate = date;
        }
    });
}

// Update statistics display
function updateStatistics() {
    const totalRestocksEl = document.getElementById('totalRestocks');
    const itemsAddedEl = document.getElementById('itemsAdded');
    const lastUpdateEl = document.getElementById('lastUpdate');
    
    if (totalRestocksEl) {
        totalRestocksEl.textContent = statistics.totalRestocks;
    }
    
    if (itemsAddedEl) {
        itemsAddedEl.textContent = statistics.totalItems;
    }
    
    if (lastUpdateEl && statistics.lastUpdate) {
        const date = statistics.lastUpdate;
        lastUpdateEl.textContent = date.toLocaleDateString('en-US', { timeZone: 'UTC' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    }
}

// Real-time connection using Server-Sent Events
function connectRealTime() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/restock/events');
    
    eventSource.onopen = () => {
        console.log('Connected to restock updates');
    };
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealTimeUpdate(data);
    };
    
    eventSource.onerror = () => {
        console.error('Restock SSE connection error');
        // Try to reconnect after 3 seconds
        setTimeout(connectRealTime, 3000);
    };
}

// Handle real-time updates
function handleRealTimeUpdate(data) {
    switch (data.type) {
        case 'new_restock':
            restocks.unshift(data.restock);
            renderRestocks();
            break;
    }
}

// Render restocks
function renderRestocks() {
    const container = document.getElementById('restockItems');
    const noRestocks = document.getElementById('noRestocks');
    
    if (!restocks.length) {
        container.innerHTML = '';
        noRestocks.classList.remove('hidden');
        return;
    }
    
    noRestocks.classList.add('hidden');
    container.innerHTML = '';
    
    // Sort dates and render grouped restocks
    const sortedDates = Object.keys(groupedRestocks).sort((a, b) => new Date(b) - new Date(a));
    
    sortedDates.forEach(dateKey => {
        const dateGroup = groupedRestocks[dateKey];
        const sortedHours = Object.keys(dateGroup).sort((a, b) => b - a);
        
        // Create date section
        const dateSection = document.createElement('div');
        dateSection.className = 'restock-date-section';
        
        const dateHeader = document.createElement('h3');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateKey;
        dateSection.appendChild(dateHeader);
        
        // Render each hour group
        sortedHours.forEach(hour => {
            const hourGroup = dateGroup[hour];
            const hourSection = document.createElement('div');
            hourSection.className = 'restock-hour-section';
            
            const hourHeader = document.createElement('h4');
            hourHeader.className = 'hour-header';
            hourHeader.textContent = `${hour}:00 - ${hour}:59 UTC`;
            hourSection.appendChild(hourHeader);
            
            // Render restocks in this hour
            hourGroup.forEach(restock => {
                const restockEl = createRestockElement(restock);
                hourSection.appendChild(restockEl);
            });
            
            dateSection.appendChild(hourSection);
        });
        
        container.appendChild(dateSection);
    });
}

// Create restock element
function createRestockElement(restock) {
    const div = document.createElement('div');
    div.className = 'restock-entry';
    
    const date = new Date(restock.date);
    const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    
    let itemsHtml = '';
    restock.items.forEach(item => {
        itemsHtml += `
            <div class="restock-item">
                <img src="${item.img || '/images/default-item.png'}" alt="${item.name}" class="item-image">
                <div class="item-details">
                    <h4 class="item-name">${item.name}</h4>
                    <p class="item-price">&#8369;${item.price.toFixed(2)}</p>
                </div>
            </div>
        `;
    });
    
    div.innerHTML = `
        <div class="restock-header">
            <h3 class="restock-title">Restocked Items</h3>
            <div class="restock-meta">
                <span class="restock-date">${formattedDate}</span>
                <span class="restock-admin">by ${restock.adminName}</span>
            </div>
        </div>
        <div class="restock-items-grid">
            ${itemsHtml}
        </div>
    `;
    
    return div;
}

// Setup event listeners
function setupEventListeners() {
    // Add restock button
    const addRestockBtn = document.getElementById('addRestockBtn');
    if (addRestockBtn) {
        addRestockBtn.addEventListener('click', openAddRestockModal);
    }
    
    // Profile configuration buttons
    const profileConfigBtns = document.querySelectorAll('#profileConfigBtn');
    profileConfigBtns.forEach(btn => {
        btn.addEventListener('click', openProfileConfigModal);
    });
    
    // Avatar URL input preview
    const avatarUrlInput = document.getElementById('avatarUrl');
    if (avatarUrlInput) {
        avatarUrlInput.addEventListener('input', updateAvatarPreview);
    }
}

// Update UI based on user state
function updateUI() {
    const adminControls = document.getElementById('adminControls');
    
    if (isAdmin) {
        adminControls.classList.remove('hidden');
    } else {
        adminControls.classList.add('hidden');
    }
}

// Restock modal functions
function openAddRestockModal() {
    document.getElementById('addRestockModal').classList.remove('hidden');
}

function closeAddRestockModal() {
    document.getElementById('addRestockModal').classList.add('hidden');
    // Reset form
    const container = document.getElementById('restockItemsContainer');
    container.innerHTML = `
        <div class="restock-item">
            <input type="text" placeholder="Item name" class="item-name">
            <input type="number" placeholder="Price" class="item-price" min="0" step="0.01">
            <input type="text" placeholder="Image URL" class="item-img">
            <button class="remove-item-btn" onclick="removeRestockItem(this)">×</button>
        </div>
    `;
}

function addRestockItem() {
    const container = document.getElementById('restockItemsContainer');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'restock-item';
    itemDiv.innerHTML = `
        <input type="text" placeholder="Item name" class="item-name">
        <input type="number" placeholder="Price" class="item-price" min="0" step="0.01">
        <input type="text" placeholder="Image URL" class="item-img">
        <button class="remove-item-btn" onclick="removeRestockItem(this)">×</button>
    `;
    container.appendChild(itemDiv);
}

function removeRestockItem(button) {
    const container = document.getElementById('restockItemsContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

async function submitRestock() {
    const container = document.getElementById('restockItemsContainer');
    const itemElements = container.querySelectorAll('.restock-item');
    
    const items = [];
    let isValid = true;
    
    itemElements.forEach(itemEl => {
        const name = itemEl.querySelector('.item-name').value.trim();
        const price = parseFloat(itemEl.querySelector('.item-price').value);
        const img = itemEl.querySelector('.item-img').value.trim();
        
        if (!name || isNaN(price) || price < 0) {
            isValid = false;
            return;
        }
        
        items.push({
            name,
            price,
            img: img || '/images/default-item.png'
        });
    });
    
    if (!isValid || !items.length) {
        alert('Please fill in all item details correctly.');
        return;
    }
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/restock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ items })
        });
        
        if (res.ok) {
            closeAddRestockModal();
        } else {
            const error = await res.json();
            alert('Failed to add restock: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to submit restock:', error);
        alert('Failed to submit restock. Please try again.');
    }
}

// Profile configuration functions
function openProfileConfigModal() {
    loadProfileData();
    document.getElementById('profileConfigModal').classList.remove('hidden');
}

function closeProfileConfigModal() {
    document.getElementById('profileConfigModal').classList.add('hidden');
}

async function loadProfileData() {
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/admin/profile', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            const profile = await res.json();
            document.getElementById('displayName').value = profile.displayName || '';
            document.getElementById('avatarUrl').value = profile.avatar || '';
            updateAvatarPreview();
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

function updateAvatarPreview() {
    const avatarUrl = document.getElementById('avatarUrl').value.trim();
    const previewImg = document.getElementById('avatarPreviewImg');
    
    if (avatarUrl) {
        previewImg.src = avatarUrl;
        previewImg.onerror = () => {
            previewImg.src = '/images/default-avatar.png';
        };
    } else {
        previewImg.src = '/images/default-avatar.png';
    }
}

async function saveProfile() {
    const displayName = document.getElementById('displayName').value.trim();
    const avatarUrl = document.getElementById('avatarUrl').value.trim();
    
    if (!displayName) {
        alert('Display name is required.');
        return;
    }
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/admin/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ displayName, avatar })
        });
        
        if (res.ok) {
            closeProfileConfigModal();
            // Update profile display if needed
            if (document.getElementById('profileName')) {
                document.getElementById('profileName').textContent = displayName;
            }
        } else {
            const error = await res.json();
            alert('Failed to save profile: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile. Please try again.');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initRestock);

// Clean up on unload
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});
