const CHAT_PASTE_ID = "lBybg0MJ";
let currentUser = null;
let isAdmin = false;
let messages = [];
let mutedUsers = new Set();
let replyToMessage = null;
let eventSource = null;
let typingTimer = null;

// Bad words filter
const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn', 'hell', 
    'cunt', 'dick', 'pussy', 'whore', 'slut', 'nigger', 'nigga',
    'fag', 'faggot', 'retard', 'idiot', 'stupid', 'dumb', 'crap'
];

function filterBadWords(text) {
    let filtered = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
}

// Initialize chat
async function initChat() {
    try {
        console.log('Initializing chat...');
        
        // Always load messages first to show chat history
        await loadMessages();
        setupEventListeners();
        connectRealTime();
        updateUI();
        
        // Then check Firebase auth state for admin features
        if (window.firebase && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (firebaseUser) => {
                console.log('Firebase auth state changed:', firebaseUser ? firebaseUser.email : 'No user');
                
                if (firebaseUser) {
                    // Firebase user is logged in
                    const token = await firebaseUser.getIdToken();
                    const headers = { Authorization: `Bearer ${token}` };
                    
                    // Set currentUser from Firebase immediately for admin users
                    currentUser = {
                        id: firebaseUser.uid,
                        username: firebaseUser.email,
                        email: firebaseUser.email,
                        type: "admin",
                        isAdmin: true
                    };
                    isAdmin = true;
                    console.log('Firebase admin user set:', currentUser);
                    
                    // Try to get user info from server
                    try {
                        const res = await fetch('/me', { headers });
                        const user = await res.json();
                        console.log('Server response:', user);
                        
                        if (user) {
                            currentUser = user;
                            isAdmin = !!user.isAdmin;
                            console.log('User set from server:', currentUser, 'Is admin:', isAdmin);
                        }
                    } catch (serverError) {
                        console.error('Server auth check failed:', serverError);
                        // Keep Firebase user if server fails
                    }
                } else {
                    // No Firebase user
                    currentUser = null;
                    isAdmin = false;
                    console.log('No Firebase user found');
                }
                
                // Update UI after auth state changes
                updateUI();
            });
        } else {
            console.error('Firebase not available');
        }
        
    } catch (error) {
        console.error('Failed to initialize chat:', error);
        setStatus('Disconnected', false);
    }
}

// Load existing messages
async function loadMessages() {
    try {
        const res = await fetch('/chat/messages');
        const data = await res.json();
        
        if (data.messages) {
            messages = data.messages;
            renderMessages();
        }
        
        // Update reset timer if available
        if (data.nextReset) {
            updateResetTimer(data.nextReset);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        messages = [];
    }
}

// Send message via chat endpoint
async function sendMessage(text, replyTo = null) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add Firebase token for admin users
        if (isAdmin && firebase.auth().currentUser) {
            const token = await firebase.auth().currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        }
        
        const res = await fetch('/chat/message', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text, replyTo })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to send message');
        }
        
        return data;
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

// Real-time connection using Server-Sent Events
function connectRealTime() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/chat/events');
    
    eventSource.onopen = () => {
        setStatus('Connected', true);
    };
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealTimeUpdate(data);
    };
    
    eventSource.onerror = () => {
        setStatus('Disconnected', false);
        // Try to reconnect after 3 seconds
        setTimeout(connectRealTime, 3000);
    };
}

// Handle real-time updates
function handleRealTimeUpdate(data) {
    switch (data.type) {
        case 'new_message':
            if (!messages.find(m => m.id === data.message.id)) {
                messages.push(data.message);
                renderMessages();
                scrollToBottom();
            }
            break;
        case 'message_deleted':
            messages = messages.filter(m => m.id !== data.messageId);
            renderMessages();
            break;
        case 'user_muted':
            mutedUsers.add(data.userId);
            renderMessages();
            break;
        case 'user_unmuted':
            mutedUsers.delete(data.userId);
            renderMessages();
            break;
        case 'typing':
            showTypingIndicator(data.user, data.isTyping);
            break;
        case 'chat_reset':
            messages = [];
            renderMessages();
            updateResetTimer(data.nextReset);
            showNotification('Chat has been reset for the week!');
            break;
    }
}

// Update reset timer display
function updateResetTimer(nextResetTime) {
    const timerEl = document.getElementById('resetTimer');
    if (!timerEl) return;
    
    if (nextResetTime) {
        const updateTimer = () => {
            const now = Date.now();
            const timeLeft = nextResetTime - now;
            
            if (timeLeft <= 0) {
                timerEl.textContent = 'Chat will reset soon...';
                return;
            }
            
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeString = '';
            if (days > 0) timeString += `${days}d `;
            if (hours > 0) timeString += `${hours}h `;
            timeString += `${minutes}m`;
            
            timerEl.textContent = `Chat resets in: ${timeString}`;
        };
        
        updateTimer();
        setInterval(updateTimer, 60000); // Update every minute
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Render messages
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageEl = createMessageElement(message);
        container.appendChild(messageEl);
    });
    
    scrollToBottom();
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.isAdmin ? 'admin-message' : 'user-message'}`;
    div.dataset.messageId = message.id;
    
    const isMuted = mutedUsers.has(message.userId);
    if (isMuted) {
        div.classList.add('muted');
    }
    
    const avatar = message.isAdmin ? '/hades.gif' : 
                   (message.avatar === 'admin' ? '/hades.gif' : `https://cdn.discordapp.com/avatars/${message.userId}/${message.avatar}.png`);
    
    div.innerHTML = `
        <div class="message-avatar" onclick="showUserActions('${message.userId}', '${message.username}', '${message.avatar}', ${message.isAdmin})">
            <img src="${avatar}" alt="${message.username}" onerror="this.src='/images/default-avatar.png'">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.isAdmin ? 'Admin' : message.username}</span>
                <span class="message-time">${formatTime(message.timestamp)}</span>
                ${message.replyTo ? `<span class="reply-indicator">Replying to ${message.replyTo.username}</span>` : ''}
            </div>
            <div class="message-text">${isMuted ? '[Muted]' : message.text}</div>
            ${message.replyTo ? `
                <div class="reply-preview">
                    <div class="reply-content">
                        <span class="reply-user">${message.replyTo.username}:</span>
                        <span class="reply-text">${message.replyTo.text}</span>
                    </div>
                </div>
            ` : ''}
            <div class="message-actions">
                <button class="reply-btn" onclick="setReply('${message.id}', '${message.username}', '${message.text.replace(/'/g, "\\'")}')">Reply</button>
                ${isAdmin && !message.isAdmin ? `
                    <button class="delete-btn" onclick="showDeleteConfirm('${message.id}')">Delete</button>
                ` : ''}
            </div>
        </div>
    `;
    
    return div;
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !currentUser) return;
    
    try {
        const headers = { 'Content-Type': 'application/json' };
        
        // Add Firebase token for admin users
        if (isAdmin && window.firebase && firebase.auth && firebase.auth().currentUser) {
            const token = await firebase.auth().currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        }
        
        const res = await fetch('/chat/message', {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
                text: filterBadWords(text),
                replyTo: replyToMessage?.id || null
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            input.value = '';
            cancelReply();
            updateSendButton();
        } else {
            throw new Error(data.error || 'Failed to send message');
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message: ' + error.message);
    }
}

// Set reply
function setReply(messageId, username, text) {
    replyToMessage = { id: messageId, username, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') };
    updateReplyPreview();
    document.getElementById('messageInput').focus();
}

// Cancel reply
function cancelReply() {
    replyToMessage = null;
    updateReplyPreview();
}

// Update reply preview
function updateReplyPreview() {
    const preview = document.getElementById('replyPreview');
    const replyUser = preview.querySelector('.replyUser');
    const replyMessage = preview.querySelector('.replyMessage');
    
    if (replyToMessage) {
        replyUser.textContent = replyToMessage.username;
        replyMessage.textContent = replyToMessage.text;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

// Show user actions modal
function showUserActions(userId, username, avatar, isAdminUser) {
    if (!isAdmin || isAdminUser) return;
    
    const modal = document.getElementById('userActionsModal');
    const modalAvatar = document.getElementById('modalUserAvatar');
    const modalUserName = document.getElementById('modalUserName');
    const modalUserStatus = document.getElementById('modalUserStatus');
    const muteBtn = modal.querySelector('.muteBtn');
    const unmuteBtn = modal.querySelector('.unmuteBtn');
    
    modalAvatar.src = `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
    modalUserName.textContent = username;
    modalUserStatus.textContent = mutedUsers.has(userId) ? 'Muted' : 'Active';
    
    if (mutedUsers.has(userId)) {
        muteBtn.classList.add('hidden');
        unmuteBtn.classList.remove('hidden');
    } else {
        muteBtn.classList.remove('hidden');
        unmuteBtn.classList.add('hidden');
    }
    
    modal.dataset.userId = userId;
    modal.classList.remove('hidden');
}

// Close user actions modal
function closeUserActionsModal() {
    document.getElementById('userActionsModal').classList.add('hidden');
}

// Mute user
async function muteUser() {
    const modal = document.getElementById('userActionsModal');
    const userId = modal.dataset.userId;
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/chat/mute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ userId })
        });
        
        if (res.ok) {
            mutedUsers.add(userId);
            renderMessages();
            closeUserActionsModal();
        }
    } catch (error) {
        console.error('Failed to mute user:', error);
    }
}

// Unmute user
async function unmuteUser() {
    const modal = document.getElementById('userActionsModal');
    const userId = modal.dataset.userId;
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/chat/unmute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ userId })
        });
        
        if (res.ok) {
            mutedUsers.delete(userId);
            renderMessages();
            closeUserActionsModal();
        }
    } catch (error) {
        console.error('Failed to unmute user:', error);
    }
}

// Delete user messages
async function deleteUserMessages() {
    const modal = document.getElementById('userActionsModal');
    const userId = modal.dataset.userId;
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch('/chat/delete-user-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ userId })
        });
        
        if (res.ok) {
            messages = messages.filter(m => m.userId !== userId);
            saveMessages();
            renderMessages();
            closeUserActionsModal();
        }
    } catch (error) {
        console.error('Failed to delete user messages:', error);
    }
}

// Show delete confirmation
function showDeleteConfirm(messageId) {
    const modal = document.getElementById('deleteConfirmModal');
    modal.dataset.messageId = messageId;
    modal.classList.remove('hidden');
}

// Close delete confirmation modal
function closeDeleteConfirmModal() {
    document.getElementById('deleteConfirmModal').classList.add('hidden');
}

// Confirm delete message
async function confirmDeleteMessage() {
    const modal = document.getElementById('deleteConfirmModal');
    const messageId = modal.dataset.messageId;
    
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch(`/chat/message/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            messages = messages.filter(m => m.id !== messageId);
            saveMessages();
            renderMessages();
            closeDeleteConfirmModal();
        }
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
}

// Show typing indicator
function showTypingIndicator(username, isTyping) {
    const indicator = document.getElementById('typingIndicator');
    const typingText = document.getElementById('typingText');
    
    if (isTyping) {
        typingText.textContent = `${username} is typing...`;
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messageInput.addEventListener('input', () => {
        updateSendButton();
        handleTyping();
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });
}

// Handle typing indicator
function handleTyping() {
    if (!currentUser) return;
    
    clearTimeout(typingTimer);
    
    // Get proper display name
    const displayName = currentUser.isAdmin ? 'Admin' : (currentUser.username || currentUser.email || 'User');
    
    // Send typing event
    fetch('/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            username: displayName,
            isTyping: true
        })
    });
    
    // Stop typing after 3 seconds
    typingTimer = setTimeout(() => {
        fetch('/chat/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                username: displayName,
                isTyping: false
            })
        });
    }, 3000);
}

// Update send button state
function updateSendButton() {
    const input = document.getElementById('messageInput');
    const button = document.getElementById('sendMessage');
    button.disabled = !input.value.trim() || !currentUser;
}

// Update UI based on user state
function updateUI() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    
    if (currentUser) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
        updateSendButton();
    } else {
        messageInput.disabled = true;
        messageInput.placeholder = 'Chat unavailable';
        sendButton.disabled = true;
    }
}

// Set connection status
function setStatus(text, isOnline) {
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    
    statusText.textContent = text;
    statusIndicator.className = isOnline ? 'status-online' : 'status-offline';
}

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initChat);

// Clean up on unload
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});
