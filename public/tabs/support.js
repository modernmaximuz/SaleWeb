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
        // Check if user is logged in
        const res = await fetch('/me');
        const user = await res.json();
        
        if (user) {
            currentUser = user;
            // Check if user is admin (Firebase admin)
            isAdmin = !!(window.firebase && firebase.auth && firebase.auth().currentUser);
        }
        
        await loadMessages();
        setupEventListeners();
        connectRealTime();
        updateUI();
        
    } catch (error) {
        console.error('Failed to initialize chat:', error);
        setStatus('Disconnected', false);
    }
}

// Load existing messages
async function loadMessages() {
    try {
        const res = await fetch(`/load/${CHAT_PASTE_ID}`);
        const data = await res.json();
        
        if (data.content) {
            messages = JSON.parse(data.content) || [];
            renderMessages();
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        messages = [];
    }
}

// Save messages to paste
async function saveMessages() {
    try {
        const token = isAdmin ? await firebase.auth().currentUser.getIdToken() : null;
        
        const res = await fetch(`/save/${CHAT_PASTE_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({
                content: JSON.stringify(messages, null, 2)
            })
        });
        
        if (!res.ok) {
            throw new Error('Failed to save messages');
        }
    } catch (error) {
        console.error('Failed to save messages:', error);
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
    }
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
                   `https://cdn.discordapp.com/avatars/${message.userId}/${message.avatar}.png`;
    
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
    
    const filteredText = filterBadWords(text);
    const message = {
        id: generateId(),
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        text: filteredText,
        timestamp: Date.now(),
        isAdmin: isAdmin,
        replyTo: replyToMessage
    };
    
    try {
        const res = await fetch('/chat/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        
        if (res.ok) {
            input.value = '';
            cancelReply();
            updateSendButton();
        } else {
            throw new Error('Failed to send message');
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        // Fallback: add message locally
        messages.push(message);
        saveMessages();
        renderMessages();
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
    
    // Send typing event
    fetch('/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
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
                username: currentUser.username,
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
        messageInput.placeholder = 'Please login to chat...';
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
