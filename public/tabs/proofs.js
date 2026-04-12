const ORDER_PASTE = "OQooMS9z";
let proofsData = [];
let currentTransaction = null;
let isAdmin = false;

// Check if user is admin
async function checkAdminStatus() {
    console.log('Checking admin status...');
    
    // Check for Firebase admin user first
    try {
        if (window.firebase && firebase.auth) {
            const user = firebase.auth().currentUser;
            console.log('Firebase auth available, current user:', user);
            if (user) {
                console.log('Firebase user detected:', user.email);
                return true; // Firebase users are admins
            } else {
                console.log('No Firebase user currently logged in');
            }
        } else {
            console.log('Firebase auth not available');
        }
    } catch (error) {
        console.error("Firebase admin check failed:", error);
    }
    
    // Check for Discord admin user
    try {
        const res = await fetch("/me");
        if (res.ok) {
            const user = await res.json();
            console.log('Discord user detected, admin status:', user.isAdmin);
            return !!user.isAdmin;
        } else {
            console.log('Discord user check failed with status:', res.status);
        }
    } catch (error) {
        console.error("Failed to check Discord admin status:", error);
    }
    
    console.log('No admin user detected');
    return false;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    
    // Check for URL parameters (auto-fill from orders page)
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transactionId');
    if (transactionId) {
        const transactionInput = document.getElementById('transactionId');
        if (transactionInput) {
            transactionInput.value = transactionId;
            // Trigger the transaction lookup
            await handleTransactionInput({ target: { value: transactionId } });
        }
    }
    
    // Set up Firebase auth state listener
    if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            console.log('Firebase auth state changed:', user ? user.email : 'No user');
            isAdmin = await checkAdminStatus();
            updateUIForAdminStatus();
        });
    }
    
    // Initial check
    isAdmin = await checkAdminStatus();
    loadProofs();
    updateUIForAdminStatus();
});

function setupEventListeners() {
    const transactionInput = document.getElementById('transactionId');
    const imageInput = document.getElementById('proofImage');
    const uploadBtn = document.getElementById('uploadProof');

    // Transaction ID input handler
    transactionInput.addEventListener('input', debounce(handleTransactionInput, 500));
    
    // Image input handler
    imageInput.addEventListener('change', handleImagePreview);
    
    // Upload button handler
    uploadBtn.addEventListener('click', uploadProof);
}

function updateUIForAdminStatus() {
    const proofForm = document.querySelector('.proof-form');
    
    if (!isAdmin) {
        // Hide upload form for non-admins
        if (proofForm) {
            proofForm.style.display = 'none';
        }
    } else {
        // Make sure upload form is visible for admins
        if (proofForm) {
            proofForm.style.display = 'block';
        }
    }
    
    // Remove any existing notice
    const existingNotice = document.querySelector('.admin-only-notice');
    if (existingNotice) {
        existingNotice.remove();
    }
}

async function handleTransactionInput(e) {
    const transactionId = e.target.value.trim();
    
    if (!transactionId) {
        hideTransactionInfo();
        return;
    }

    try {
        const transaction = await loadTransaction(transactionId);
        if (transaction) {
            showTransactionInfo(transaction);
            currentTransaction = transaction;
        } else {
            hideTransactionInfo();
            showError('Transaction not found');
        }
    } catch (error) {
        console.error('Error loading transaction:', error);
        showError('Error loading transaction');
    }
}

async function loadTransaction(transactionId) {
    try {
        const response = await fetch(`/load/${ORDER_PASTE}`);
        if (!response.ok) throw new Error('Failed to load orders');
        
        const orders = await response.json();
        return orders.find(order => order.transactionId === transactionId);
    } catch (error) {
        console.error('Error loading transaction:', error);
        return null;
    }
}

function showTransactionInfo(transaction) {
    const infoDiv = document.getElementById('transactionInfo');
    const customerName = document.getElementById('customerName');
    const itemsList = document.getElementById('itemsList');
    
    customerName.textContent = transaction.username || 'Unknown';
    itemsList.textContent = transaction.items ? transaction.items.join(', ') : 'No items';
    
    infoDiv.style.display = 'block';
}

function hideTransactionInfo() {
    document.getElementById('transactionInfo').style.display = 'none';
    currentTransaction = null;
}

function handleImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Proof preview">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

async function uploadProof() {
    console.log('Upload proof called, isAdmin:', isAdmin);
    
    // Check admin permissions
    if (!isAdmin) {
        console.error('Upload failed: Not an admin');
        showError('Only administrators can upload proofs');
        return;
    }

    const transactionId = document.getElementById('transactionId').value.trim();
    const imageFile = document.getElementById('proofImage').files[0];
    
    console.log('Transaction ID:', transactionId);
    console.log('Image file:', imageFile);
    
    if (!transactionId) {
        showError('Please enter a transaction ID');
        return;
    }
    
    if (!currentTransaction) {
        showError('Please select a valid transaction');
        return;
    }
    
    if (!imageFile) {
        showError('Please select an image to upload');
        return;
    }

    const uploadBtn = document.getElementById('uploadProof');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
        // Upload image to imgbb
        console.log('Starting image upload to imgbb...');
        const imageUrl = await uploadToImgbb(imageFile);
        console.log('Image uploaded successfully, URL:', imageUrl);
        
        // Create proof entry with improved data
        const proof = {
            id: Date.now().toString(),
            transactionId: transactionId,
            customer: currentTransaction.user || currentTransaction.username,
            customerDiscordId: currentTransaction.discordId,
            items: currentTransaction.items,
            imageUrl: imageUrl,
            uploadedBy: 'Admin',
            uploadDate: new Date().toISOString(),
            formattedDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        };
        
        console.log('Saving proof:', proof);
        // Save proof
        await saveProof(proof);
        
        // Update channel name
        await updateChannelName();
        
        // Clear form
        document.getElementById('transactionId').value = '';
        document.getElementById('proofImage').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        hideTransactionInfo();
        
        showSuccess('Proof uploaded successfully!');
        loadProofs();
        
    } catch (error) {
        console.error('Error uploading proof:', error);
        showError('Error uploading proof: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Proof';
    }
}

async function uploadToImgbb(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', 'bdcb671a7075bed44f862ba62f369966');
    
    console.log('Uploading to imgbb...');
    
    try {
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        console.log('Imgbb response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Imgbb error response:', errorText);
            throw new Error('Failed to upload image: ' + errorText);
        }
        
        const result = await response.json();
        console.log('Imgbb result:', result);
        
        if (!result.success) {
            throw new Error('Imgbb upload failed: ' + (result.error?.message || 'Unknown error'));
        }
        
        return result.data.url;
    } catch (error) {
        console.error('Error uploading to imgbb:', error);
        throw error;
    }
}

async function saveProof(proof) {
    proofsData.push(proof);
    
    try {
        const response = await fetch('/save/TK7bewK1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proofsData)
        });
        
        if (!response.ok) throw new Error('Failed to save proof');
        
    } catch (error) {
        console.error('Error saving proof:', error);
        throw error;
    }
}

async function loadProofs() {
    try {
        const response = await fetch('/load/TK7bewK1');
        if (!response.ok) {
            if (response.status === 404) {
                proofsData = [];
            } else {
                throw new Error('Failed to load proofs');
            }
        } else {
            proofsData = await response.json();
        }
        
        displayProofs();
    } catch (error) {
        console.error('Error loading proofs:', error);
        proofsData = [];
        displayProofs();
    }
}

function displayProofs() {
    const container = document.getElementById('proofsContainer');
    
    if (proofsData.length === 0) {
        container.innerHTML = '<p class="loading">No proofs uploaded yet.</p>';
        return;
    }
    
    // Sort proofs by date (newest first)
    const sortedProofs = [...proofsData].sort((a, b) => 
        new Date(b.uploadDate || b.timestamp) - new Date(a.uploadDate || a.timestamp)
    );
    
    container.innerHTML = sortedProofs.map(proof => {
        const items = proof.items ? proof.items.map(item => 
            typeof item === 'object' ? item.name : item
        ).join(', ') : 'No items';
        
        const uploadDate = proof.formattedDate || new Date(proof.uploadDate || proof.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="proof-item">
                <div class="proof-header">
                    <div class="proof-transaction">
                        <span class="transaction-label">Transaction ID:</span>
                        <span class="transaction-value">${proof.transactionId}</span>
                    </div>
                    <div class="proof-date">${uploadDate}</div>
                </div>
                <div class="proof-content">
                    <div class="proof-details">
                        <div class="detail-row">
                            <span class="detail-label">Customer:</span>
                            <span class="detail-value">${proof.customer || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Items:</span>
                            <span class="detail-value">${items}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Uploaded by:</span>
                            <span class="detail-value">${proof.uploadedBy || 'Admin'}</span>
                        </div>
                    </div>
                    <div class="proof-image-container">
                        <img src="${proof.imageUrl}" alt="Proof for ${proof.transactionId}" class="proof-image" onclick="openImageModal('${proof.imageUrl}')">
                    </div>
                </div>
                ${isAdmin ? `
                <div class="proof-actions">
                    <button class="btn-delete" onclick="deleteProof('${proof.id}')">Delete Proof</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function deleteProof(proofId) {
    // Check admin permissions
    if (!isAdmin) {
        showError('Only administrators can delete proofs');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this proof? This action cannot be undone.')) return;
    
    try {
        proofsData = proofsData.filter(proof => proof.id !== proofId);
        
        const response = await fetch('/save/TK7bewK1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proofsData)
        });
        
        if (!response.ok) throw new Error('Failed to delete proof');
        
        await updateChannelName();
        showSuccess('Proof deleted successfully!');
        loadProofs();
        
    } catch (error) {
        console.error('Error deleting proof:', error);
        showError('Error deleting proof: ' + error.message);
    }
}

function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <img src="${imageUrl}" alt="Proof Image" class="modal-image">
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function updateChannelName() {
    try {
        const response = await fetch('/update-channel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                channelId: '1492379548686356560',
                proofCount: proofsData.length
            })
        });
        
        if (!response.ok) throw new Error('Failed to update channel name');
        
    } catch (error) {
        console.error('Error updating channel name:', error);
        // Don't show error to user as it's not critical
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
