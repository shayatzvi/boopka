document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Replace with your BOOPKA Firebase project's configuration
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
    const posProductSelect = document.getElementById('pos-product-select');
    const posQuantityInput = document.getElementById('pos-quantity');
    const posAddToCartBtn = document.getElementById('pos-add-to-cart-btn');
    const posCartList = document.getElementById('pos-cart-list');
    const posCartTotal = document.getElementById('pos-cart-total');
    const posCustomerCardInput = document.getElementById('pos-customer-card');
    const posProcessPaymentBtn = document.getElementById('pos-process-payment-btn');
    const posCheckoutStatus = document.getElementById('pos-checkout-status');

    const posAddProductModalBtn = document.getElementById('pos-add-product-modal-btn');
    const posProductListTable = document.getElementById('pos-product-list-table');
    const addProductModal = $('#addProductModal'); // jQuery for Bootstrap modal
    const posProductForm = document.getElementById('pos-product-form');
    const posProductIdInput = document.getElementById('pos-product-id');
    const posProductNameInput = document.getElementById('pos-product-name');
    const posProductPriceInput = document.getElementById('pos-product-price');
    const posSaveProductBtn = document.getElementById('pos-save-product-btn');

    const posSalesHistoryTable = document.getElementById('pos-sales-history-table');

    let currentMerchantId = null;
    let merchantProducts = []; // To store merchant's products for checkout
    let cart = [];

    // --- Authentication and Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Removed merchant role check. Any authenticated user can access POS.
            // The user's UID will be used as the currentMerchantId for storing their products and sales.
            currentMerchantId = user.uid;
            console.log("User authenticated for POS:", currentMerchantId);
            initializePOS();

        } else {
            // No user logged in
            window.location.href = 'index.html'; // Redirect to login
        }
    });

    function initializePOS() {
        loadMerchantProducts();
        loadSalesHistory();
        setupEventListeners();
        updateCartDisplay(); // Initial cart display
    }

    // --- Product Management ---
    async function loadMerchantProducts() {
        if (!currentMerchantId) return;
        posProductListTable.innerHTML = '<tr><td colspan="3">Loading products...</td></tr>';
        posProductSelect.innerHTML = '<option>Loading products...</option>';

        try {
            const productsRef = db.collection('users').doc(currentMerchantId).collection('products');
            const snapshot = await productsRef.orderBy('name').get();

            merchantProducts = []; // Clear existing
            posProductListTable.innerHTML = '';
            posProductSelect.innerHTML = '';

            if (snapshot.empty) {
                posProductListTable.innerHTML = '<tr><td colspan="3">No products added yet.</td></tr>';
                posProductSelect.innerHTML = '<option value="">No products available</option>';
                return;
            }

            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                merchantProducts.push(product);

                // Populate table
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${product.name}</td>
                    <td>${parseFloat(product.price).toFixed(2)} BUP</td>
                    <td>
                        <button class="btn btn-xs btn-warning edit-product-btn" data-id="${product.id}">Edit</button>
                        <button class="btn btn-xs btn-danger delete-product-btn" data-id="${product.id}">Delete</button>
                    </td>
                `;
                posProductListTable.appendChild(tr);

                // Populate select dropdown
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} - ${parseFloat(product.price).toFixed(2)} BUP`;
                posProductSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading merchant products:", error);
            posProductListTable.innerHTML = '<tr><td colspan="3" class="text-danger">Error loading products.</td></tr>';
            posProductSelect.innerHTML = '<option value="">Error loading products</option>';
        }
    }

    posSaveProductBtn.addEventListener('click', async () => {
        if (!currentMerchantId) return;

        const name = posProductNameInput.value.trim();
        const price = parseFloat(posProductPriceInput.value);
        const productId = posProductIdInput.value;

        if (!name || isNaN(price) || price <= 0) {
            alert("Please enter a valid product name and price.");
            return;
        }

        const productData = { name, price };
        const productsRef = db.collection('users').doc(currentMerchantId).collection('products');

        try {
            posSaveProductBtn.disabled = true;
            posSaveProductBtn.textContent = 'Saving...';
            if (productId) {
                // Update existing product
                await productsRef.doc(productId).update(productData);
            } else {
                // Add new product
                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await productsRef.add(productData);
            }
            addProductModal.modal('hide');
            posProductForm.reset();
            posProductIdInput.value = ''; // Clear hidden ID
            loadMerchantProducts(); // Refresh list
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Failed to save product: " + error.message);
        } finally {
            posSaveProductBtn.disabled = false;
            posSaveProductBtn.textContent = 'Save Product';
        }
    });

    posProductListTable.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-product-btn')) {
            const productId = e.target.dataset.id;
            const product = merchantProducts.find(p => p.id === productId);
            if (product) {
                posProductIdInput.value = product.id;
                posProductNameInput.value = product.name;
                posProductPriceInput.value = product.price;
                $('#addProductModalLabel').text('Edit Product');
                addProductModal.modal('show');
            }
        } else if (e.target.classList.contains('delete-product-btn')) {
            const productId = e.target.dataset.id;
            if (confirm("Are you sure you want to delete this product?")) {
                try {
                    await db.collection('users').doc(currentMerchantId).collection('products').doc(productId).delete();
                    loadMerchantProducts(); // Refresh list
                } catch (error) {
                    console.error("Error deleting product:", error);
                    alert("Failed to delete product: " + error.message);
                }
            }
        }
    });

    // Reset modal when "Add New Product" is clicked
    posAddProductModalBtn.addEventListener('click', () => {
        posProductForm.reset();
        posProductIdInput.value = '';
        $('#addProductModalLabel').text('Add New Product');
    });


    // --- Checkout Logic ---
    posAddToCartBtn.addEventListener('click', () => {
        const productId = posProductSelect.value;
        const quantity = parseInt(posQuantityInput.value);

        if (!productId || quantity <= 0) {
            alert("Please select a product and enter a valid quantity.");
            return;
        }

        const product = merchantProducts.find(p => p.id === productId);
        if (!product) {
            alert("Selected product not found.");
            return;
        }

        // Check if product already in cart, if so, update quantity
        const existingCartItem = cart.find(item => item.id === productId);
        if (existingCartItem) {
            existingCartItem.quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                quantity: quantity
            });
        }
        updateCartDisplay();
        posQuantityInput.value = 1; // Reset quantity
    });

    function updateCartDisplay() {
        posCartList.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            posCartList.innerHTML = '<li class="list-group-item">Cart is empty</li>';
            posCartTotal.textContent = '0.00';
            return;
        }

        cart.forEach((item, index) => {
            const li = document.createElement('li');
            li.classList.add('list-group-item');
            li.innerHTML = `
                ${item.name} (x${item.quantity}) - ${(item.price * item.quantity).toFixed(2)} BUP
                <button class="btn btn-xs btn-danger pull-right remove-cart-item-btn" data-index="${index}">&times;</button>
            `;
            posCartList.appendChild(li);
            total += item.price * item.quantity;
        });
        posCartTotal.textContent = total.toFixed(2);
    }

    posCartList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-cart-item-btn')) {
            const index = parseInt(e.target.dataset.index);
            cart.splice(index, 1); // Remove item from cart array
            updateCartDisplay();
        }
    });

    posProcessPaymentBtn.addEventListener('click', async () => {
        if (!currentMerchantId) return;

        const customerCardNumber = posCustomerCardInput.value.trim();
        const cartTotal = parseFloat(posCartTotal.textContent);

        if (cart.length === 0) {
            posCheckoutStatus.textContent = "Cart is empty.";
            posCheckoutStatus.className = 'text-warning';
            return;
        }
        if (!customerCardNumber) {
            posCheckoutStatus.textContent = "Please enter customer's BOOPKA card number.";
            posCheckoutStatus.className = 'text-warning';
            return;
        }

        posProcessPaymentBtn.disabled = true;
        posProcessPaymentBtn.textContent = 'Processing...';
        posCheckoutStatus.textContent = 'Processing payment...';
        posCheckoutStatus.className = 'text-info';

        try {
            // 1. Find Customer by BOOPKA Card
            const cardsRef = db.collectionGroup('cards').where('maskedNumber', '==', customerCardNumber).limit(1);
            const customerCardSnapshot = await cardsRef.get();

            if (customerCardSnapshot.empty) {
                throw new Error("Customer's BOOPKA card not found.");
            }
            const customerCardDoc = customerCardSnapshot.docs[0];
            const customerId = customerCardDoc.ref.parent.parent.id; // User ID from card path
            const customerUserRef = db.collection('users').doc(customerId);

            if (customerId === currentMerchantId) {
                throw new Error("Merchant cannot checkout themselves.");
            }

            // 2. Perform Transaction (Atomically update balances)
            await db.runTransaction(async (transaction) => {
                const merchantRef = db.collection('users').doc(currentMerchantId);
                const merchantDoc = await transaction.get(merchantRef);
                if (!merchantDoc.exists) throw new Error("Merchant account not found.");

                const customerDoc = await transaction.get(customerUserRef);
                if (!customerDoc.exists) throw new Error("Customer account not found.");

                const merchantCredits = merchantDoc.data().credits || 0;
                const customerCredits = customerDoc.data().credits || 0;

                if (customerCredits < cartTotal) {
                    throw new Error(`Customer has insufficient balance. Needs ${cartTotal.toFixed(2)}, has ${customerCredits.toFixed(2)} BUP.`);
                }

                transaction.update(merchantRef, { credits: merchantCredits + cartTotal });
                transaction.update(customerUserRef, { credits: customerCredits - cartTotal });
            });

            // 3. Log Sale for Merchant
            const saleData = {
                merchantId: currentMerchantId,
                customerId: customerId,
                customerEmail: (await customerUserRef.get()).data().email, // Get customer email for receipt
                items: cart.map(item => ({ productId: item.id, name: item.name, quantity: item.quantity, price: item.price })),
                totalAmount: cartTotal,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            const saleRef = await db.collection('users').doc(currentMerchantId).collection('sales').add(saleData);

            // 4. Log General Transaction (optional, but good for overall system audit)
            await db.collection('transactions').add({
                senderId: customerId,
                senderEmail: saleData.customerEmail,
                recipientId: currentMerchantId,
                recipientEmail: (await db.collection('users').doc(currentMerchantId).get()).data().email,
                amount: cartTotal,
                type: 'POS_SALE',
                note: `POS Sale ID: ${saleRef.id}`,
                involvedUsers: [customerId, currentMerchantId],
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            posCheckoutStatus.textContent = `Payment successful! Sale ID: ${saleRef.id}`;
            posCheckoutStatus.className = 'text-success';
            cart = []; // Clear cart
            updateCartDisplay();
            posCustomerCardInput.value = '';
            loadSalesHistory(); // Refresh sales history

        } catch (error) {
            console.error("Error processing payment:", error);
            posCheckoutStatus.textContent = "Payment failed: " + error.message;
            posCheckoutStatus.className = 'text-danger';
        } finally {
            posProcessPaymentBtn.disabled = false;
            posProcessPaymentBtn.textContent = 'Process Payment';
        }
    });


    // --- Sales History ---
    async function loadSalesHistory() {
        if (!currentMerchantId) return;
        posSalesHistoryTable.innerHTML = '<tr><td colspan="5">Loading sales history...</td></tr>';

        try {
            const salesRef = db.collection('users').doc(currentMerchantId).collection('sales');
            const snapshot = await salesRef.orderBy('timestamp', 'desc').limit(20).get(); // Load recent 20

            posSalesHistoryTable.innerHTML = '';
            if (snapshot.empty) {
                posSalesHistoryTable.innerHTML = '<tr><td colspan="5">No sales recorded yet.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const sale = doc.data();
                const tr = document.createElement('tr');
                const itemsSummary = sale.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
                tr.innerHTML = `
                    <td>${sale.timestamp ? sale.timestamp.toDate().toLocaleString() : 'N/A'}</td>
                    <td>${doc.id}</td>
                    <td>${sale.customerEmail || 'N/A'}</td>
                    <td>${parseFloat(sale.totalAmount).toFixed(2)} BUP</td>
                    <td>${itemsSummary}</td>
                `;
                posSalesHistoryTable.appendChild(tr);
            });
        } catch (error) {
            console.error("Error loading sales history:", error);
            posSalesHistoryTable.innerHTML = '<tr><td colspan="5" class="text-danger">Error loading sales history.</td></tr>';
        }
    }

    // --- General Event Listeners Setup ---
    function setupEventListeners() {
        // Event listeners for product save, edit, delete are already set up above
        // Event listeners for add to cart, remove from cart, process payment are also set up

        // Bootstrap tab shown event to refresh data if needed (e.g., if data could change while on another tab)
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            const targetTab = $(e.target).attr("href"); // activated tab
            if (targetTab === '#pos-products') {
                // loadMerchantProducts(); // Potentially reload if products can be changed externally
            } else if (targetTab === '#pos-sales-history') {
                loadSalesHistory(); // Refresh sales history when tab is viewed
            } else if (targetTab === '#pos-checkout') {
                // loadMerchantProducts(); // Ensure product dropdown is up-to-date
            }
        });
    }

    // Helper to format currency (if needed elsewhere, though toFixed(2) is used directly now)
    // function formatCurrency(amount) {
    //     return parseFloat(amount).toFixed(2);
    // }
});
