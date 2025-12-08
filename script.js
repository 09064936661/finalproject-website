// script.js
// Full updated client script with login redirect + header update behavior
// Edited to include product id in forms, store id in cart items, and performCheckout API call
// ------------------------------------
// --- 1. Variable Initialization ---
// ------------------------------------

// Build a robust API_URL. If the page is served over HTTP(S) we construct an absolute path
// to api.php in the same directory as the current page.
const API_URL = (() => {
    try {
        if (location.protocol.startsWith('http')) {
            const path = location.pathname;
            const base = location.origin + path.substring(0, path.lastIndexOf('/') + 1);
            const url = base + 'api.php';
            console.debug('API_URL built as:', url);
            return url;
        }
    } catch (err) {
        console.warn('Could not build API_URL automatically:', err);
    }
    // fallback - change if your folder name is different
    return 'http://localhost/blonde_shop/api.php';
})();

console.debug('Using API:', API_URL);

// Retrieve cart data from browser storage or start with an empty array
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Retrieve favorites data from browser storage or start with an empty array
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Store all products fetched from the database
let products = []; 

// Store user session data
let user = null;


// ------------------------------------
// --- 2. Utility Functions ---
// ------------------------------------

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: 'Server responded with an error status.' }));
                throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorBody.message || JSON.stringify(errorBody)}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message || error);
            if (i === retries - 1) {
                if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    displayMessage('Network error: failed to reach server. Make sure Apache is running and you opened the site using http://localhost/...', 'error');
                } else {
                    displayMessage(`Server error or maximum retries reached: ${error.message}`, 'error');
                }
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

function displayMessage(message, type = 'success') {
    const msgBox = document.createElement('div');
    msgBox.textContent = message;
    msgBox.style.position = 'fixed';
    msgBox.style.top = '100px';
    msgBox.style.right = '20px';
    msgBox.style.padding = '15px';
    msgBox.style.borderRadius = '5px';
    msgBox.style.zIndex = '10000';
    msgBox.style.color = '#fff';
    msgBox.style.fontSize = '1.6rem';
    msgBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    msgBox.style.transition = 'all 0.3s ease-in-out';
    msgBox.style.opacity = '0';
    msgBox.style.transform = 'translateX(100%)';

    if (type === 'success') {
        msgBox.style.backgroundColor = 'var(--green)';
    } else {
        msgBox.style.backgroundColor = '#a00';
    }

    document.body.appendChild(msgBox);

    setTimeout(() => {
        msgBox.style.opacity = '1';
        msgBox.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        msgBox.style.opacity = '0';
        msgBox.style.transform = 'translateX(100%)';
        setTimeout(() => msgBox.remove(), 500);
    }, 4000);
}

function saveAndDisplayCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    displayCart();
    syncCartWithServer();
}

function saveAndDisplayFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
    displayFavorites();
    syncFavoritesWithServer();
}


// ------------------------------------
// --- 3. Product Display & Interaction ---
// ------------------------------------

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function(s) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
            "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
        })[s];
    });
}

/**
 * Renders the products on the main webpage.
 * Uses .product-container if present; falls back to .box-container.
 * NOTE: includes a hidden id field so cart items carry product id.
 */
function renderProducts() {
    // Prefer the explicit products section container, then product-container, then any box-container
    const container = document.querySelector('#products .box-container') ||
                      document.querySelector('.product-container') ||
                      document.querySelector('.box-container');

    if (!container) return; // Not on a page that shows products

    // Clear existing content to avoid duplication
    container.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-size:2rem; padding: 5rem 0; color:#666;">No products found in the database. Please check your SQL script!</p>`;
        return;
    }

    let html = '';
    products.forEach(item => {
        const isFavorited = Array.isArray(favorites) && favorites.some(fav => fav.name === item.name);
        const favoriteIconClass = isFavorited ? 'fas' : 'far';
        const imageUrl = item.image ? item.image : 'https://placehold.co/300x300/e0e0e0/333?text=No+Image';
        const sizes = Array.isArray(item.sizes) ? item.sizes : ['S','M','L','XL'];

        html += `
            <div class="box">
                <div class="icons">
                    <a href="#" class="${favoriteIconClass} fa-heart" onclick="handleAddToFavoriteClick(event, '${escapeHtml(item.name)}', '${item.price}', '${imageUrl}')"></a>
                    <a href="#" class="fas fa-share"></a>
                    <a href="webpage.html#products" class="fas fa-eye"></a>
                </div>
                <div class="image">
                    <img src="${imageUrl}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e0e0e0/333?text=Image+Error';">
                </div>
                <div class="content">
                    <h3>${escapeHtml(item.name)}</h3>
                    <div class="price">$${parseFloat(item.price).toFixed(2)}</div>
                    
                    <form onsubmit="handleAddToCartClick(event, this)">
                        <input type="hidden" name="id" value="${item.id}">
                        <input type="hidden" name="name" value="${escapeHtml(item.name)}">
                        <input type="hidden" name="price" value="${item.price}">
                        <input type="hidden" name="image" value="${imageUrl}">
                        
                        <select name="size" class="size-select" required style="display: block; width: 80%; margin: 1rem auto; padding: 0.8rem; border: 1px solid #ccc; border-radius: 0.5rem; font-size: 1.7rem; cursor: pointer;">
                            <option value="" disabled selected>Select Size</option>
                            ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>

                        <button type="submit" class="btn">Add to Cart</button>
                    </form>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function handleAddToCartClick(e, form) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const idField = form.querySelector('[name="id"]');
    const id = idField ? idField.value : null;
    const name = form.querySelector('[name="name"]').value;
    const price = parseFloat(form.querySelector('[name="price"]').value);
    const image = form.querySelector('[name="image"]').value; 
    const size = form.querySelector('[name="size"]').value;

    if (!size) {
        displayMessage('Please select a size before adding to cart.', 'error');
        return;
    }

    const existingItemIndex = cart.findIndex(item => (item.id == id) && item.size === size);

    if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity += 1;
        displayMessage(`${name} (${size}) quantity increased in cart!`);
    } else {
        cart.push({
            id: id ? parseInt(id) : null,
            name,
            price,
            image,
            size,
            quantity: 1,
            selected: true
        });
        displayMessage(`${name} (${size}) added to cart!`);
    }

    saveAndDisplayCart();
    updateCartCount();
}

function handleAddToFavoriteClick(e, name, price, image) {
    e.preventDefault();

    const existingIndex = favorites.findIndex(item => item.name === name);
    const icon = e.target;

    if (existingIndex !== -1) {
        favorites.splice(existingIndex, 1);
        displayMessage(`${name} removed from favorites.`, 'error');
        if (icon) {
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    } else {
        favorites.push({ name, price: parseFloat(price), image, size: 'One Size' });
        displayMessage(`${name} added to favorites!`);
        if (icon) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
    }

    saveAndDisplayFavorites();
}


// ------------------------------------
// --- 4. Cart Page Functions ---
// ------------------------------------


function displayCart() {
  const listEl = document.getElementById('cart-list');
  const totalEl = document.getElementById('cart-total');
  const loadingEl = document.getElementById('cart-loading');
  const checkoutBtn = document.getElementById('checkout-btn');

  if (!listEl || !totalEl) return;

  // Remove loading message once we render
  if (loadingEl) loadingEl.remove();

  // If cart empty
  if (!Array.isArray(cart) || cart.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding: 2rem;">
        <p style="font-size:1.1rem; color:#666;">Your cart is empty.</p>
        <a href="webpage.html#products" class="checkout-btn" style="background:#f3f3f3; color:#333; padding:.6rem 1rem; border-radius:8px; text-decoration:none;">Continue Shopping</a>
      </div>
    `;
    totalEl.textContent = '$0.00';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  // Build HTML
  let total = 0;
  const html = cart.map((item, idx) => {
    const image = item.image || 'https://placehold.co/300x300/e0e0e0/333?text=IMG';
    const qty = item.quantity || 1;
    const subtotal = item.price * qty;
    total += subtotal;

    return `
      <div class="cart-item" data-index="${idx}">
        <div class="image"><img src="${image}" alt="${escapeHtml(item.name)}"></div>

        <div class="info">
          <h4>${escapeHtml(item.name)}</h4>
          <div class="meta">Size: ${escapeHtml(item.size || '—')}</div>
          <div class="price">$${parseFloat(item.price).toFixed(2)}</div>

          <div class="cart-actions">
            <div class="qty-controls" role="group" aria-label="Quantity controls">
              <button class="qty-btn" onclick="updateQuantity(${idx}, -1)" title="Decrease">−</button>
              <div class="qty-display">${qty}</div>
              <button class="qty-btn" onclick="updateQuantity(${idx}, 1)" title="Increase">+</button>
            </div>

            <button class="remove-btn" onclick="removeItem(${idx})" title="Remove item">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div style="min-width:110px; text-align:right;">
          <div style="color:#666; font-size:.95rem;">Subtotal</div>
          <div style="font-weight:700; color:var(--green);">$${subtotal.toFixed(2)}</div>
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = html;
  totalEl.textContent = `$${total.toFixed(2)}`;
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

// quantity change (index = item index, change = +1 or -1)
function updateQuantity(index, change) {
  if (!cart[index]) return;
  cart[index].quantity = (cart[index].quantity || 1) + change;
  if (cart[index].quantity <= 0) {
    // confirm removal
    const ok = confirm(`Remove ${cart[index].name} from cart?`);
    if (ok) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = 1;
    }
  }
  saveAndDisplayCart();
  displayCart(); // re-render
}

// remove item immediately
function removeItem(index) {
  if (!cart[index]) return;
  const ok = confirm(`Remove ${cart[index].name} from cart?`);
  if (!ok) return;
  cart.splice(index, 1);
  saveAndDisplayCart();
  displayCart();
}


// ------------------------------------
// --- Checkout: server call to update stock ---
// ------------------------------------

async function performCheckout() {
  if (!cart || cart.length === 0) {
    displayMessage('Your cart is empty.', 'error');
    return;
  }

  // Build payload: only id and quantity are required by server to update stock
  const payload = {
    cart: cart.map(item => ({ id: item.id, quantity: item.quantity }))
  };

  try {
    const response = await fetch(`${API_URL}?action=checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      displayMessage(data.message || 'Checkout successful', 'success');
      // Clear cart client-side and refresh product list (so stock & "Add to Cart" reflect new stock)
      cart = [];
      saveAndDisplayCart();
      // Re-fetch products to show updated stock
      fetchProducts();
    } else {
      displayMessage(data.message || 'Checkout failed', 'error');
      console.error('Checkout failed response:', data);
    }
  } catch (err) {
    console.error('Checkout request failed:', err);
    displayMessage('Checkout request failed. See console for details.', 'error');
  }
}


// ------------------------------------
// --- 5. Favorites Page Functions ---
// ------------------------------------

function showCustomConfirmation(message, onConfirm, onCancel = () => {}) {
    let modal = document.getElementById('custom-confirm-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.6); z-index: 10001;
        display: flex; justify-content: center; align-items: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #fff; padding: 30px; border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); max-width: 400px;
        text-align: center; font-size: 1.8rem;
    `;
    
    const messageP = document.createElement('p');
    messageP.textContent = message;
    messageP.style.marginBottom = '20px';
    messageP.style.color = '#333';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Yes, Remove';
    confirmBtn.className = 'btn';
    confirmBtn.style.margin = '0 10px';
    confirmBtn.style.backgroundColor = '#a00';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn';
    cancelBtn.style.margin = '0 10px';
    cancelBtn.style.backgroundColor = '#666';

    confirmBtn.onclick = () => {
        modal.remove();
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.remove();
        onCancel();
    };

    content.appendChild(messageP);
    content.appendChild(confirmBtn);
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function displayFavorites() {
    const container = document.querySelector('.favorites-container');
    if (!container) return;

    if (favorites.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-size:2rem; padding: 5rem 0; color:#666;">You have no favorite items yet.</p>`;
        return;
    }

    let html = '';
    favorites.forEach((item, idx) => {
        const imageUrl = item.image ? item.image : 'https://placehold.co/60x60/e0e0e0/333?text=IMG';

        html += `
            <div class="fav-item" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;padding:1.5rem 0;">
                <img src="${imageUrl}" alt="${item.name}" style="height:6rem;width:6rem;object-fit:cover;border-radius:.5rem;" onerror="this.onerror=null;this.src='https://placehold.co/60x60/e0e0e0/333?text=IMG';">
                <div style="flex:1;margin-left:1rem;">
                    <h4 style="font-size:1.8rem;color:#333;margin-bottom:.3rem;">${item.name}</h4>
                    <p style="color:#666;margin-bottom:.3rem;">Size: ${item.size ? item.size : '—'}</p>
                    <p style="font-size:1.6rem;color:var(--green);font-weight:bold;">$${parseFloat(item.price).toFixed(2)}</p>
                </div>
                <div style="display:flex;flex-direction:column;gap:.5rem;">
                    <a href="#" class="btn" onclick="removeFavoriteByIndex(${idx})" style="background:#a00;">Remove</a>
                    <a href="webpage.html#products" class="btn">Buy</a>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function removeFavoriteByIndex(index) {
    if (favorites[index]) {
        showCustomConfirmation(`Are you sure you want to remove ${favorites[index].name} from your favorites?`, () => {
            favorites.splice(index, 1);
            displayMessage('Item removed from favorites.', 'error');
            saveAndDisplayFavorites();
            renderProducts(); 
        });
    }
}


// ------------------------------------
// --- 6. Server Communication (Sync & Fetch) ---
// ------------------------------------

async function syncCartWithServer() {
    if (!user) return;

    try {
        const payload = { cart: cart };
        await fetchWithRetry(`${API_URL}?action=sync_cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Cart sync failed:', error.message);
    }
}

// safe, normalized fetchCartFromServer
async function fetchCartFromServer() {
    try {
        const response = await fetchWithRetry(`${API_URL}?action=get_cart`);
        if (response.success) {
            let arr = response.data;
            if (arr && arr.data) arr = arr.data;
            if (!Array.isArray(arr)) arr = [];
            cart = arr.map(item => ({ ...item, selected: true }));
            saveAndDisplayCart();
            updateCartCount();
        }
    } catch (error) {
        console.error('Failed to fetch cart from server:', error.message);
    }
}

async function syncFavoritesWithServer() {
    if (!user) return;

    try {
        const payload = { favorites: favorites };
        await fetchWithRetry(`${API_URL}?action=sync_favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Favorites sync failed:', error.message);
    }
}

// safe, normalized fetchFavoritesFromServer
async function fetchFavoritesFromServer() {
    try {
        const response = await fetchWithRetry(`${API_URL}?action=get_favorites`);
        if (response.success) {
            let arr = response.data;
            if (arr && arr.data) arr = arr.data;
            if (!Array.isArray(arr)) arr = [];
            favorites = arr;
            saveAndDisplayFavorites();
        }
    } catch (error) {
        console.error('Failed to fetch favorites from server:', error.message);
    }
}

/**
 * Fetches all products from the database for display.
 * Accepts both `response.data = [ ... ]` and `response.data = { data: [ ... ] }`.
 */
async function fetchProducts() {
    try {
        const response = await fetchWithRetry(`${API_URL}?action=get_products`);
        if (response.success) {
            let arr = response.data;
            if (arr && arr.data) arr = arr.data;
            products = Array.isArray(arr) ? arr : [];
            renderProducts();
        } else {
            console.warn('get_products returned success:false', response);
        }
    } catch (error) {
        console.error('Failed to fetch products from server:', error.message);
    }
}


// ------------------------------------
// --- 7. Authentication Logic ---
// ------------------------------------

/**
 * Updates header UI to show logged-in state
 * - Sets "Welcome, {username}" in #user-display
 * - Hides #login-link and #guest-icon
 * - Shows #logout-btn
 */
function updateHeaderForLoggedIn(username) {
    const userDisplay = document.getElementById('user-display');
    const loginLink = document.getElementById('login-link');
    const guestIcon = document.getElementById('guest-icon');
    const logoutBtn = document.getElementById('logout-btn');

    if (userDisplay) {
        userDisplay.textContent = `Welcome, ${username}`;
    }
    if (loginLink) {
        loginLink.style.display = 'none';
    }
    if (guestIcon) {
        guestIcon.style.display = 'none';
    }
    if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';
    }
}

/**
 * Updates header UI to show logged-out (guest) state
 */
function updateHeaderForLoggedOut() {
    const userDisplay = document.getElementById('user-display');
    const loginLink = document.getElementById('login-link');
    const guestIcon = document.getElementById('guest-icon');
    const logoutBtn = document.getElementById('logout-btn');

    if (userDisplay) {
        userDisplay.textContent = 'Welcome, Guest';
    }
    if (loginLink) {
        loginLink.style.display = 'inline-block';
    }
    if (guestIcon) {
        guestIcon.style.display = 'inline-block';
    }
    if (logoutBtn) {
        logoutBtn.style.display = 'none';
    }
}

/**
 * Handles the successful login or session check process.
 * After login we want to:
 * - show a welcome message at top
 * - show the logout button
 * - redirect to main page if login occurred on a separate page (login.html)
 */
async function handleLoginSuccess(username, showMsg = true, redirectToMain = false) {
    if (showMsg) {
        displayMessage(`Welcome back, ${username}! Data sync initiated.`);
    }

    // set user and update header immediately if header present on this page
    user = { username };

    updateHeaderForLoggedIn(username);

    // Sync client state -> server then re-fetch merged state
    await syncCartWithServer();
    await syncFavoritesWithServer();
    await fetchCartFromServer();
    await fetchFavoritesFromServer();

    // re-fetch products to update UI (favorite icons etc.)
    await fetchProducts();

    // If we want to redirect (login was on login.html), do that after a tiny delay so user sees message
    if (redirectToMain) {
        setTimeout(() => {
            window.location.href = 'webpage.html';
        }, 300); // short delay
    }
}

/**
 * Checks if a session exists on the server.
 */
async function checkSession() {
    try {
        const response = await fetchWithRetry(`${API_URL}?action=get_session`);
        if (response.success && response.data && response.data.user) {
            user = response.data.user;
            // Update header in case we're on main page
            updateHeaderForLoggedIn(user.username);
            // Sync and fetch server data
            await handleLoginSuccess(user.username, false);
        } else {
            // ensure header shows guest if present
            updateHeaderForLoggedOut();
            // proceed as guest
            fetchProducts();
        }
    } catch (error) {
        console.warn('Session check failed, proceeding as guest.');
        updateHeaderForLoggedOut();
        fetchProducts();
    }
}

function initAuthAndForms() {
    // perform initial check
    checkSession();
    
    // register form handler (if present)
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const payload = Object.fromEntries(formData.entries());

            try {
                const response = await fetchWithRetry(`${API_URL}?action=register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.success) {
                    displayMessage('Registration successful! Please log in.', 'success');
                    registerForm.reset();
                } else {
                    displayMessage(response.message, 'error');
                }
            } catch (error) {
                // handled in fetchWithRetry
            }
        });
    }

    // login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const payload = Object.fromEntries(formData.entries());

            try {
                const response = await fetchWithRetry(`${API_URL}?action=login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.success) {
                    // If login form is on login.html, redirect to main page and let checkSession update header there.
                    // If login form is on the main page, update header immediately.
                    user = response.data.user;
                    // If current page is not the main page, redirect after success
                    const onMainPage = location.pathname.endsWith('webpage.html') || location.pathname.endsWith('/') || location.pathname.endsWith('index.html');
                    
                    // Use handleLoginSuccess to sync and update header. If not on main page, ask it to redirect.
                    await handleLoginSuccess(user.username, true, !onMainPage);
                    // Reset form (useful if login is a modal)
                    loginForm.reset();
                } else {
                    displayMessage(response.message, 'error');
                }
            } catch (error) {
                // fetchWithRetry already displays useful messages
            }
        });
    }
    
    // logout button(s)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            const payload = Object.fromEntries(formData.entries());

            try {
                const response = await fetchWithRetry(`${API_URL}?action=submit_contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.success) {
                    displayMessage(response.message, 'success');
                    contactForm.reset();
                } else {
                    displayMessage(response.message, 'error');
                }
            } catch (error) {}
        });
    }
}

async function handleLogout(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
        const response = await fetchWithRetry(`${API_URL}?action=logout`);
        if (response.success) {
            user = null;
            cart = [];
            favorites = [];
            localStorage.removeItem('cart');
            localStorage.removeItem('favorites');

            // update header quickly to guest state
            updateHeaderForLoggedOut();

            displayMessage('Logged out successfully.', 'success');
            // reload to reset everything server-side as well
            setTimeout(() => window.location.reload(), 300);
        } else {
            displayMessage(response.message, 'error');
        }
    } catch (error) {}
}


// ------------------------------------
// --- 8. Initialization & Global UI ---
// ------------------------------------

function updateCartCount() {
    const countElement = document.getElementById('cart-count');
    if (countElement) {
        const count = cart.reduce((total, item) => total + item.quantity, 0);
        if (count > 0) {
            countElement.textContent = count;
            countElement.style.display = 'block';
        } else {
            countElement.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAuthAndForms();

    if (document.querySelector('.cart-section')) {
        displayCart();
    } else if (document.querySelector('.favorites-container')) {
        displayFavorites();
    } 

    updateCartCount();

    // wire checkout button (if present on the page)
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!cart || cart.length === 0) {
                displayMessage('Your cart is empty.', 'error');
                return;
            }
            if (confirm(`Proceed to checkout — total: ${document.getElementById('cart-total') ? document.getElementById('cart-total').textContent : ''}?`)) {
                performCheckout();
            }
        });
    }
});

// Reference elements
const checkoutSection = document.getElementById('checkout-section');
const checkoutForm = document.getElementById('checkoutForm');

if (checkoutBtn && checkoutSection && checkoutForm) {
    checkoutBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (!cart || cart.length === 0) {
            displayMessage('Your cart is empty.', 'error');
            return;
        }

        // Hide cart, show checkout section
        document.querySelector('.cart-section').style.display = 'none';
        checkoutSection.style.display = 'block';

        // Fill total amount in form
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const totalInput = document.getElementById('checkoutTotal');
        if (totalInput) totalInput.value = total.toFixed(2);
    });

    // Handle checkout form submission
    checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(checkoutForm);
    const paymentMethod = formData.get('payment_method');

    if (!cart || cart.length === 0) {
        displayMessage('Your cart is empty.', 'error');
        return;
    }

    // If online payment, redirect to payment page
    if (paymentMethod === 'Credit Card' || paymentMethod === 'PayPal') {
        // Save temporary order info in sessionStorage
        const tempOrder = {
            name: formData.get('user_name'),
            contact_number: formData.get('contact_number'),
            address: formData.get('address'),
            payment_method: paymentMethod,
            total_amount: parseFloat(formData.get('total_amount')),
            cart: cart
        };
        sessionStorage.setItem('temp_order', JSON.stringify(tempOrder));

        // Redirect to payment page
        window.location.href = 'payment.html';
        return;
    }

    // For COD, submit immediately to backend
    placeOrderDirectly(formData);
    });
}

// -----------------------------
// Payment page handling
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('paymentForm')) {
        const paymentForm = document.getElementById('paymentForm');

        // Get temp order from sessionStorage
        const tempOrder = JSON.parse(sessionStorage.getItem('temp_order'));
        if (!tempOrder) {
            alert('No order found. Redirecting to checkout.');
            window.location.href = 'checkout.html';
            return;
        }

        // Fill in form summary (optional)
        const totalEl = document.getElementById('paymentTotal');
        if (totalEl) totalEl.textContent = `$${tempOrder.total_amount.toFixed(2)}`;

        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const response = await fetch(API_URL + '?action=place_order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tempOrder)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert('Payment successful! Your order has been placed.');
                    sessionStorage.removeItem('temp_order');
                    localStorage.removeItem('cart'); // clear cart
                    window.location.href = 'webpage.html'; // redirect to main page
                } else {
                    alert('Payment failed: ' + (data.message || 'Unknown error.'));
                }
            } catch (err) {
                console.error('Payment request failed:', err);
                alert('Payment request failed. Check console for details.');
            }
        });
    }
});

