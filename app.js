// IMPORTANT: Replace with your Firebase project's configuration
const firebaseConfig = {
    apiKey: "AIzaSyBMQeHxv9A9zBETgvvsgHYyrNpwQFBWn4Y",
  authDomain: "toras-jeffrey.firebaseapp.com",
  projectId: "toras-jeffrey",
  storageBucket: "toras-jeffrey.appspot.com",
  messagingSenderId: "114964475333",
  appId: "1:114964475333:web:e236c773ad86e9180b2fac",
  measurementId: "G-KGQ4FESPKF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const authError = document.getElementById('auth-error');

const userEmailDisplay = document.getElementById('user-email');
const userCreditsDisplay = document.getElementById('user-credits');
const logoutBtn = document.getElementById('logout-btn');

const recipientEmailInput = document.getElementById('recipient-email');
const transferAmountInput = document.getElementById('transfer-amount');
const transferBtn = document.getElementById('transfer-btn');
const transferStatus = document.getElementById('transfer-status');

const transactionList = document.getElementById('transaction-list');
const noTransactionsMsg = document.getElementById('no-transactions');
const loadMoreTransactionsBtn = document.getElementById('load-more-transactions-btn');

// Card Management DOM Elements
const cardList = document.getElementById('card-list');
const cardNumberInput = document.getElementById('card-number-input');
const addCardBtn = document.getElementById('add-card-btn');
const cardStatus = document.getElementById('card-status');

// Admin Area DOM Elements
const adminAreaContainer = document.getElementById('admin-area-container');
const adminManageUserEmailInput = document.getElementById('admin-manage-user-email');
const adminBalanceAmountInput = document.getElementById('admin-balance-amount');
const adminActionTypeSelect = document.getElementById('admin-action-type');
const adminFromNameInput = document.getElementById('admin-from-name');
const adminUpdateBalanceBtn = document.getElementById('admin-update-balance-btn');
const adminUserStatus = document.getElementById('admin-user-status');
const adminUserList = document.getElementById('admin-user-list');
const adminTransactionList = document.getElementById('admin-transaction-list');
const adminNoTransactionsMsg = document.getElementById('admin-no-transactions');

// Admin Statement DOM Elements
const statementStartDateInput = document.getElementById('statement-start-date');
const statementEndDateInput = document.getElementById('statement-end-date');

const DEFAULT_CREDITS = 100;
const TRANSACTIONS_PER_LOAD = 5;
let unsubscribeUserCreditsListener = null;
let lastVisibleTransactionDoc = null;
let unsubscribeCardsListener = null;
let currentUserIsAdmin = false;

// Initialize Materialize components
document.addEventListener('DOMContentLoaded', function() {
    M.AutoInit();
    var elems = document.querySelectorAll('select'); // Re-initialize selects if dynamically added or for admin area
    M.FormSelect.init(elems);

    // Initialize Datepickers
    var datepickerElems = document.querySelectorAll('.datepicker');
    M.Datepicker.init(datepickerElems, { format: 'yyyy-mm-dd' });
    // M.FormSelect.init(elems); // Duplicate, already called above
});
// --- User Account Initialization and Real-time Updates ---
async function initializeUserAccount(userId, userEmail) {
    const userRef = db.collection('users').doc(userId);
    try {
        const doc = await userRef.get();
        if (!doc.exists) {
            console.log("User document not found for", userId, ". Creating with default credits.");
            await userRef.set({
                email: userEmail,
                credits: DEFAULT_CREDITS,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("New user document created.");
        }

        if (unsubscribeUserCreditsListener) {
            unsubscribeUserCreditsListener(); // Unsubscribe from previous listener
        }
        unsubscribeUserCreditsListener = userRef.onSnapshot(snapshot => {
            if (snapshot.exists) {
                userCreditsDisplay.textContent = snapshot.data().credits + " BUP";
            } else {
                console.warn("User document disappeared for user:", userId);
                userCreditsDisplay.textContent = 'N/A BUP';
                if (auth.currentUser && auth.currentUser.uid === userId) {
                    transferStatus.textContent = "Your account data is missing.";
                    transferStatus.style.color = 'red';
                }
            }
        }, error => {
            console.error("Error listening to user balance:", error);
            userCreditsDisplay.textContent = 'Error BUP';
            if (auth.currentUser && auth.currentUser.uid === userId) {
                transferStatus.textContent = "Error loading your credits.";
                transferStatus.style.color = 'red';
            }
        });

    } catch (error) {
        console.error("Error initializing user account or setting up listener:", error);
        authError.textContent = "Failed to initialize your account data.";
        userCreditsDisplay.textContent = 'Error BUP';
    }
}

// --- Check Admin Status ---
async function checkAdminStatus(userId) {
    try {
        const adminRef = db.collection('admins').doc(userId);
        const adminDoc = await adminRef.get();
        return adminDoc.exists;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// --- Auth State Observer ---
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUserIsAdmin = await checkAdminStatus(user.uid);

        authError.textContent = '';
        transferStatus.textContent = '';
        userEmailDisplay.textContent = user.email;
        await displayUserCards(user.uid); // Load user's cards
        await displayTransactionHistory(user.uid);
        await initializeUserAccount(user.uid, user.email);
    } else {
        if (unsubscribeUserCreditsListener) {
            unsubscribeUserCreditsListener();
            unsubscribeUserCreditsListener = null;
        }
        if (unsubscribeCardsListener) { // Unsubscribe from cards listener
            unsubscribeCardsListener();
            unsubscribeCardsListener = null;
        }
        currentUserIsAdmin = false;
    }
    updateUIVisibility();

    if (!user) { // Reset UI elements on logout
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
        adminAreaContainer.style.display = 'none';

        userEmailDisplay.textContent = '';
        userCreditsDisplay.textContent = '0 BUP';
        emailInput.value = '';
        passwordInput.value = '';
        recipientEmailInput.value = '';
        transferAmountInput.value = '';
        authError.textContent = '';
        transferStatus.textContent = '';
        transactionList.innerHTML = '';
        noTransactionsMsg.style.display = 'block';
        cardList.innerHTML = ''; // Clear cards
        cardStatus.textContent = '';
        adminUserList.innerHTML = '';
        adminTransactionList.innerHTML = '';
        adminUserStatus.textContent = '';
    }
});

function updateUIVisibility() {
    const user = auth.currentUser;
    authContainer.style.display = user ? 'none' : 'block';
    appContainer.style.display = user ? 'block' : 'none';
    adminAreaContainer.style.display = user && currentUserIsAdmin ? 'block' : 'none';

    if (user && currentUserIsAdmin) {
        loadAdminData();
        var elems = document.querySelectorAll('select'); // Ensure selects in admin area are initialized
        M.FormSelect.init(elems);
    }
}

// --- Auth Event Listeners ---
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    authError.textContent = '';
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        authError.textContent = error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
    } catch (error) {
        transferStatus.textContent = "Logout failed: " + error.message;
        transferStatus.style.color = 'red';
    }
});

// --- Credit Transfer Logic ---
transferBtn.addEventListener('click', async () => {
    const recipientEmail = recipientEmailInput.value.trim();
    const amount = parseInt(transferAmountInput.value);
    transferStatus.textContent = '';

    if (!recipientEmail || !amount || amount <= 0) {
        transferStatus.textContent = "Please enter a valid recipient email and positive amount.";
        transferStatus.style.color = 'red';
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        transferStatus.textContent = "You must be logged in.";
        transferStatus.style.color = 'red';
        return;
    }
    const senderId = currentUser.uid;

    try {
        const usersRef = db.collection('users');
        const recipientQuery = await usersRef.where("email", "==", recipientEmail).limit(1).get();

        if (recipientQuery.empty) {
            throw new Error("Recipient user not found.");
        }
        const recipientDoc = recipientQuery.docs[0];
        const recipientId = recipientDoc.id;

        if (senderId === recipientId) {
            throw new Error("You cannot transfer credits to yourself.");
        }

        await db.runTransaction(async (transaction) => {
            const senderRef = db.collection('users').doc(senderId);
            const senderDoc = await transaction.get(senderRef);
            if (!senderDoc.exists) throw new Error("Sender data not found.");

            const senderCredits = senderDoc.data().credits;
            if (senderCredits < amount) throw new Error("Insufficient credits.");

            const recipientRef = db.collection('users').doc(recipientId);
            const recipientSnapshot = await transaction.get(recipientRef); // Get recipient inside transaction
            if (!recipientSnapshot.exists) throw new Error("Recipient account no longer exists.");

            const recipientCurrentCredits = recipientSnapshot.data().credits;

            transaction.update(senderRef, { credits: senderCredits - amount });
            transaction.update(recipientRef, { credits: recipientCurrentCredits + amount });
        });

        // Log the transaction
        await db.collection('transactions').add({
            senderId: senderId,
            senderEmail: currentUser.email,
            recipientId: recipientId,
            recipientEmail: recipientEmail,
            amount: amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            involvedUsers: [senderId, recipientId] // For easier querying
        });

        transferStatus.textContent = `Successfully transferred ${amount} BUP to ${recipientEmail}.`;
        transferStatus.style.color = 'green';
        recipientEmailInput.value = '';
        transferAmountInput.value = '';
        await displayTransactionHistory(senderId); // Refresh history
        // await displayUserCards(senderId); // Not strictly needed here, but good for consistency if cards were related to transfers
        if (currentUserIsAdmin) await loadAllTransactionsForAdmin(); // Refresh admin view

    } catch (error) {
        transferStatus.textContent = "Transfer failed: " + error.message;
        transferStatus.style.color = 'red';
    }
});

// --- Transaction History Display ---
async function displayTransactionHistory(userId) {
    currentUserIdForTransactions = userId; // Store for "load more"
    transactionList.innerHTML = ''; // Clear previous entries
    noTransactionsMsg.style.display = 'none';
    loadMoreTransactionsBtn.style.display = 'none';
    lastVisibleTransactionDoc = null; // Reset for a fresh load

    try {
        const transactionsRef = db.collection('transactions');
        let query = transactionsRef
            .where('involvedUsers', 'array-contains', userId)
            .orderBy('timestamp', 'desc')
            .limit(TRANSACTIONS_PER_LOAD);

        console.log(`Initial load for user ${userId}, limit ${TRANSACTIONS_PER_LOAD}`);

        const snapshot = await query.get();

        if (snapshot.empty) {
            noTransactionsMsg.style.display = 'block';
            return;
        }

        appendTransactionsToDOM(snapshot.docs, userId);

        if (snapshot.docs.length === TRANSACTIONS_PER_LOAD) {
            loadMoreTransactionsBtn.style.display = 'block';
            lastVisibleTransactionDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
            loadMoreTransactionsBtn.style.display = 'none';
        }

    } catch (error) {
        console.error("Error fetching transaction history:", error);
        transactionList.innerHTML = '<li><span style="color:red;">Error loading history.</span></li>';
        noTransactionsMsg.style.display = 'none';
        loadMoreTransactionsBtn.style.display = 'none';
    }
}

function appendTransactionsToDOM(docs, currentUserId) {
    docs.forEach(doc => {
        const tx = doc.data();
        const li = document.createElement('li');
        li.classList.add('collection-item');
        const date = tx.timestamp ? tx.timestamp.toDate().toLocaleString() : 'Pending...';

        if (tx.senderId === currentUserId) {
            li.classList.add('sent');
            li.innerHTML = `<i class="material-icons tiny left notranslate red-text">arrow_upward</i> Sent <strong>${tx.amount}</strong> BUP to ${tx.recipientEmail || 'N/A'} <span class="grey-text text-darken-1 right">${date}</span>`;
        } else if (tx.recipientId === currentUserId) {
            li.classList.add('received');
            if (tx.senderId === "ADMIN_ADJUSTMENT") {
                const actionText = tx.type === 'ADMIN_ADD' ? 'Added' : 'Deducted';
                li.innerHTML = `<i class="material-icons tiny left notranslate ${tx.type === 'ADMIN_ADD' ? 'green-text' : 'orange-text'}">settings</i> ${actionText} <strong>${tx.amount}</strong> BUP by ${tx.senderEmail || 'Admin'} <span class="grey-text text-darken-1 right">${date}</span>`;
            } else {
                li.innerHTML = `<i class="material-icons tiny left notranslate green-text">arrow_downward</i> Received <strong>${tx.amount}</strong> BUP from ${tx.senderEmail || 'N/A'} <span class="grey-text text-darken-1 right">${date}</span>`;
            }
        } else {
            li.textContent = `Transaction involving ${tx.amount} credits on ${date}`;
        }
        transactionList.appendChild(li);
    });
}

async function fetchAndDisplayMoreTransactions() {
    if (!lastVisibleTransactionDoc || !currentUserIdForTransactions) {
        loadMoreTransactionsBtn.style.display = 'none';
        return;
    }

    loadMoreTransactionsBtn.disabled = true;
    loadMoreTransactionsBtn.textContent = 'Loading...';

    try {
        const transactionsRef = db.collection('transactions');
        const query = transactionsRef
            .where('involvedUsers', 'array-contains', currentUserIdForTransactions)
            .orderBy('timestamp', 'desc')
            .startAfter(lastVisibleTransactionDoc)
            .limit(TRANSACTIONS_PER_LOAD);

        const snapshot = await query.get();

        appendTransactionsToDOM(snapshot.docs, currentUserIdForTransactions);

        if (snapshot.docs.length < TRANSACTIONS_PER_LOAD) {
            loadMoreTransactionsBtn.style.display = 'none';
        } else {
            lastVisibleTransactionDoc = snapshot.docs[snapshot.docs.length - 1];
            loadMoreTransactionsBtn.style.display = 'block';
        }
    } catch (error) {
        console.error("Error fetching more transactions:", error);
        // Optionally show an error message to the user
    } finally {
        loadMoreTransactionsBtn.disabled = false;
        loadMoreTransactionsBtn.textContent = 'Load More Transactions';
    }
}

// Add event listener for the "Load More" button
if (loadMoreTransactionsBtn) {
    loadMoreTransactionsBtn.addEventListener('click', fetchAndDisplayMoreTransactions);
}

// --- Card Management Functions ---
async function displayUserCards(userId) {
    cardList.innerHTML = ''; // Clear previous entries
    cardStatus.textContent = '';

    const userCardsRef = db.collection('users').doc(userId).collection('cards');

    if (unsubscribeCardsListener) {
        unsubscribeCardsListener(); // Unsubscribe from previous listener
    }

    unsubscribeCardsListener = userCardsRef.orderBy('addedAt', 'desc').onSnapshot(snapshot => {
        cardList.innerHTML = ''; // Clear list before adding
        if (snapshot.empty) {
            const li = document.createElement('li');
            li.classList.add('collection-item');
            li.textContent = 'No loyalty cards added yet.';
            cardList.appendChild(li);
            return;
        }

        snapshot.forEach(doc => {
            const cardData = doc.data();
            const li = document.createElement('li');
            li.classList.add('collection-item');
            // Display masked number and type (if available)
            li.innerHTML = `<div>Loyalty Card: <strong>${cardData.maskedNumber || 'N/A'}</strong> (Ends: ${cardData.last4 || 'N/A'})<a href="#!" class="secondary-content delete-card-btn" data-card-id="${doc.id}"><i class="material-icons red-text notranslate">delete</i></a></div>`;
            cardList.appendChild(li);
        });
    }, error => {
        console.error("Error listening to user cards:", error);
        cardStatus.textContent = "Error loading loyalty cards.";
        cardStatus.style.color = 'red';
    });
}

// --- Delete Card Logic ---
cardList.addEventListener('click', async (event) => {
    if (event.target.classList.contains('material-icons') && event.target.parentElement.classList.contains('delete-card-btn')) {
        const deleteButton = event.target.parentElement;
        const cardId = deleteButton.dataset.cardId;
        const currentUser = auth.currentUser;

        if (!currentUser) {
            cardStatus.textContent = "You must be logged in to delete cards.";
            cardStatus.style.color = 'red';
            return;
        }

        try {
            await db.collection('users').doc(currentUser.uid).collection('cards').doc(cardId).delete();
            cardStatus.textContent = "Card deleted successfully.";
            cardStatus.style.color = 'green';
        } catch (error) {
            console.error("Error deleting card:", error);
            cardStatus.textContent = "Failed to delete card: " + error.message;
            cardStatus.style.color = 'red';
        }
    }
});

addCardBtn.addEventListener('click', async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        cardStatus.textContent = "You must be logged in.";
        cardStatus.style.color = 'red';
        return;
    }

    // const cardNumber = cardNumberInput.value.trim(); // No longer taking user input for card number
    cardStatus.textContent = '';

    // if (!cardNumber || cardNumber.length < 1) { // Simple check for non-empty
    //     cardStatus.textContent = "Please enter a loyalty card number.";
    //     cardStatus.style.color = 'red';
    //     return;
    // }

    try {
        // Auto-generate a card number
        // Generate a 7-digit number (between 1000000 and 9999999)
        const generated7DigitNumber = Math.floor(1000000 + Math.random() * 9000000).toString();

        // Display the generated number in the input field
        cardNumberInput.value = generated7DigitNumber;

        await db.collection('users').doc(currentUser.uid).collection('cards').add({
            maskedNumber: generated7DigitNumber,
            last4: generated7DigitNumber.slice(-4), // Extract last 4 digits
            type: 'Loyalty',
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        cardStatus.textContent = "Loyalty card added successfully.";
        cardStatus.style.color = 'green';
        cardNumberInput.value = ''; // Clear input
    } catch (error) {
        console.error("Error adding card:", error);
        cardStatus.textContent = "Failed to add loyalty card: " + error.message;
        cardStatus.style.color = 'red';
    }
});


// --- Admin Area Functions ---
async function loadAdminData() {
    if (!currentUserIsAdmin) return;
    await loadAllUsersForAdmin();
    await loadAllTransactionsForAdmin();
}

async function loadAllUsersForAdmin() {
    adminUserList.innerHTML = '<li>Loading users...</li>';
    try {
        const usersSnapshot = await db.collection('users').orderBy('email').get();
        adminUserList.innerHTML = ''; // Clear loading
        if (usersSnapshot.empty) {
            adminUserList.innerHTML = '<li>No users found.</li>';
            return;
        }
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const li = document.createElement('li');
            li.classList.add('collection-item'); 
            li.innerHTML = `<div>Email: ${userData.email} <span class="secondary-content">Balance: <strong>${userData.credits}</strong> BUP <a href="#!" class="statement-btn" data-user-id="${doc.id}"><i class="material-icons tiny blue-text notranslate">description</i></a></span></div><small class="grey-text">UID: ${doc.id}</small>`;
            adminUserList.appendChild(li);
        });
    } catch (error) {
        console.error("Error loading all users for admin:", error);
        adminUserList.innerHTML = '<li><span style="color:red;">Error loading users.</span></li>';
    }
}

// --- Admin Statement Logic ---
adminUserList.addEventListener('click', (event) => {
    console.log("Admin user list clicked. Target:", event.target); // DEBUG
    // Check if the clicked element or its parent is the statement button
    const statementButton = event.target.closest('.statement-btn');
    console.log("Statement button found by .closest():", statementButton); // DEBUG

    if (statementButton) {
        console.log("Statement button is valid, proceeding."); // DEBUG
        const userId = statementButton.dataset.userId;
        const startDate = statementStartDateInput.value;
        const endDate = statementEndDateInput.value;
        console.log("User ID:", userId, "Start Date:", startDate, "End Date:", endDate); // DEBUG

        let url = `statement.html?userId=${userId}`;
        if (startDate) {
            url += `&startDate=${startDate}`;
        }
        if (endDate) {
            url += `&endDate=${endDate}`;
        }
        console.log("Generated URL:", url); // DEBUG

        // Open the statement page in a new tab
        window.open(url, '_blank');
        console.log("window.open called for statement."); // DEBUG
    } else {
        console.log("Clicked target was not a statement button or its child."); // DEBUG
    }
});



async function loadAllTransactionsForAdmin() {
    adminTransactionList.innerHTML = '<li>Loading transactions...</li>';
    adminNoTransactionsMsg.style.display = 'none';
    try {
        const transactionsSnapshot = await db.collection('transactions').orderBy('timestamp', 'desc').limit(50).get();
        adminTransactionList.innerHTML = ''; // Clear loading

        if (transactionsSnapshot.empty) {
            adminNoTransactionsMsg.style.display = 'block';
            return;
        }
        transactionsSnapshot.forEach(doc => {
            const tx = doc.data();
            const li = document.createElement('li');
            li.classList.add('collection-item'); // Materialize class
            const date = tx.timestamp ? tx.timestamp.toDate().toLocaleString() : 'Processing...'; // Materialize class
            li.innerHTML = `FROM: <strong>${tx.senderEmail}</strong> TO: <strong>${tx.recipientEmail || tx.type || 'N/A'}</strong>, Amount: <strong class="${tx.type === 'ADMIN_DEDUCT' ? 'red-text' : (tx.type === 'ADMIN_ADD' ? 'green-text' : '')}">${tx.amount}</strong> BUP <span class="grey-text text-darken-1 right">${date}</span>`;
            adminTransactionList.appendChild(li);
        });
    } catch (error) {
        console.error("Error loading all transactions for admin:", error);
        adminTransactionList.innerHTML = '<li><span style="color:red;">Error loading transactions.</span></li>';
    }
}

adminUpdateBalanceBtn.addEventListener('click', async () => {
    if (!currentUserIsAdmin) {
        adminUserStatus.textContent = "You are not authorized for this action.";
        adminUserStatus.style.color = 'red';
        return;
    }

    const targetEmail = adminManageUserEmailInput.value.trim();
    const amountStr = adminBalanceAmountInput.value;
    const actionType = adminActionTypeSelect.value;
    const adminFromName = adminFromNameInput.value.trim() || "Admin Adjustment"; // Default "From" name

    adminUserStatus.textContent = '';

    if (!targetEmail || amountStr === '') {
        adminUserStatus.textContent = "Please enter user email and amount/balance.";
        adminUserStatus.style.color = 'red';
        return;
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount) || (actionType !== 'deduct' && amount < 0) || (actionType === 'deduct' && amount <=0) ) {
        adminUserStatus.textContent = "Please enter a valid, positive amount.";
        adminUserStatus.style.color = 'red';
        return;
    }
    if (actionType === 'set' && amount < 0) {
        adminUserStatus.textContent = "New balance cannot be negative when setting.";
        adminUserStatus.style.color = 'red';
        return;
    }

    try {
        const usersRef = db.collection('users');
        const userQuery = await usersRef.where("email", "==", targetEmail).limit(1).get();

        if (userQuery.empty) {
            throw new Error(`User with email ${targetEmail} not found.`);
        }

        const userDoc = userQuery.docs[0];
        const targetUserId = userDoc.id;
        const userData = userDoc.data();
        const currentBalance = userData.credits;

        let newBalance;
        let changeAmount = 0;
        let transactionLogType; // For the 'type' field in the transaction log

        if (actionType === 'add') {
            newBalance = currentBalance + amount;
            changeAmount = amount;
            transactionLogType = 'ADMIN_ADD';
        } else if (actionType === 'deduct') {
            newBalance = currentBalance - amount;
            changeAmount = amount;
            transactionLogType = 'ADMIN_DEDUCT';
            if (newBalance < 0) {
                throw new Error("Deduction results in a negative balance. Operation cancelled.");
            }
        } else { // 'set'
            newBalance = amount;
            if (newBalance > currentBalance) {
                changeAmount = newBalance - currentBalance;
                transactionLogType = 'ADMIN_ADD';
            } else if (newBalance < currentBalance) {
                changeAmount = currentBalance - newBalance;
                transactionLogType = 'ADMIN_DEDUCT';
            } else {
                // Balance is not changing
                adminUserStatus.textContent = `Balance for ${targetEmail} is already ${newBalance}. No change made.`;
                adminUserStatus.style.color = 'blue';
                return;
            }
        }

        await db.collection('users').doc(targetUserId).update({
            credits: newBalance
        });

        // Log the admin action as a transaction
        if (changeAmount > 0) { // Only log if there was an actual change
            await db.collection('transactions').add({
                senderId: "ADMIN_ADJUSTMENT", // Special ID for admin actions
                senderEmail: adminFromName,    // Custom name from admin input
                recipientId: targetUserId,
                recipientEmail: targetEmail,
                amount: changeAmount,
                type: transactionLogType, // 'ADMIN_ADD' or 'ADMIN_DEDUCT'
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                involvedUsers: [targetUserId] // So it appears in the user's history
            });
        }

        adminUserStatus.textContent = `Successfully updated balance for ${targetEmail}. New balance: ${newBalance} BUP.`;
        adminUserStatus.style.color = 'green';
        adminManageUserEmailInput.value = '';
        adminBalanceAmountInput.value = '';
        adminFromNameInput.value = '';
        await loadAllUsersForAdmin(); // Refresh user list in admin panel
        var elems = document.querySelectorAll('select'); // Re-initialize selects after potential DOM changes
        M.FormSelect.init(elems);
        await displayTransactionHistory(targetUserId); // Refresh target user's history if they are viewing it
        if (currentUserIsAdmin) await loadAllTransactionsForAdmin(); // Refresh admin transaction list

    } catch (error) {
        console.error("Error updating user balance by admin:", error);
        adminUserStatus.textContent = "Failed to update balance: " + error.message;
        adminUserStatus.style.color = 'red';
    }
});
