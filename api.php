<?php
// api.php

// ------------------------------------
// --- 1. Configuration & Setup ---
// ------------------------------------

header('Content-Type: application/json');
session_start();

// Database credentials
$host = 'localhost';
$db   = 'blonde_shop';
$user = 'root';
$pass = '';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB CONNECTION ERROR: ' . $e->getMessage()]);
    exit();
}

// ------------------------------------
// --- 2. Utility Functions ---
// ------------------------------------

function sendResponse($success, $message, $data = []) {
    echo json_encode(['success' => $success, 'message' => $message, 'data' => $data]);
    exit();
}

function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

// ------------------------------------
// --- 3. Core Action Handlers ---
// ------------------------------------

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        handleRegister($pdo);
        break;
    case 'login':
        handleLogin($pdo);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'get_session':
        handleGetSession();
        break;
    case 'get_products':
        handleGetProducts($pdo);
        break;
    case 'sync_cart':
        handleSyncCart($pdo);
        break;
    case 'get_cart':
        handleGetCart($pdo);
        break;
    case 'sync_favorites':
        handleSyncFavorites($pdo);
        break;
    case 'get_favorites':
        handleGetFavorites($pdo);
        break;
    case 'submit_contact':
        handleSubmitContact($pdo); 
        break; 
    case 'checkout':
        handleCheckout($pdo);
        break;
    default:
        http_response_code(400);
        sendResponse(false, 'Invalid action specified.');
}

// ------------------------------------
// --- 4. Authentication Logic ---
// ------------------------------------

function handleRegister($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($username) || empty($email) || empty($password)) {
        sendResponse(false, 'All fields are required.');    
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");
        $stmt->execute([$username, $email, $passwordHash]);
        sendResponse(true, 'Registration successful.');
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
            sendResponse(false, 'Username or email already exists.');
        } else {
            error_log("Registration error: " . $e->getMessage());
            sendResponse(false, 'Registration failed due to a server error.');
        }
    }
}

function handleLogin($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendResponse(false, 'Username and password are required.');
    }

    $stmt = $pdo->prepare("SELECT id, username, password_hash, email FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        sendResponse(true, 'Login successful.', ['user' => ['id' => $user['id'], 'username' => $user['username'], 'email' => $user['email']]]);
    } else {
        sendResponse(false, 'Invalid username or password.');
    }
}

function handleLogout() {
    session_unset();
    session_destroy();
    sendResponse(true, 'Logout successful.');
}

function handleGetSession() {
    $userId = getCurrentUserId();
    if ($userId) {
        sendResponse(true, 'Session active.', [
            'user' => [
                'id' => $userId, 
                'username' => $_SESSION['username'] ?? 'User',
            ]
        ]);
    } else {
        sendResponse(false, 'No active session.');
    }
}

// ------------------------------------
// --- 5. Product Data Logic ---
// ------------------------------------

function handleGetProducts($pdo) {
    $stmt = $pdo->prepare("SELECT id, name, price, image_url, category FROM products ORDER BY id ASC");
    $stmt->execute();
    $dbProducts = $stmt->fetchAll();

    $products = array_map(function($p) {
        $p['image'] = $p['image_url'] ?? '';
        unset($p['image_url']);
        $p['sizes'] = ['S', 'M', 'L', 'XL'];
        $p['price'] = (float)$p['price'];
        $p['id'] = (int)$p['id'];
        return $p;
    }, $dbProducts);

    sendResponse(true, 'Products loaded successfully from database.', $products);
}

// ------------------------------------
// --- 6. Cart and Favorites Logic ---
// ------------------------------------

function handleSyncCart($pdo) {
    $userId = getCurrentUserId();
    if (!$userId) {
        sendResponse(false, 'User not authenticated.');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $clientCart = $data['cart'] ?? [];

    $pdo->prepare("DELETE FROM cart_items WHERE user_id = ?")->execute([$userId]);

    $stmtFindProduct = $pdo->prepare("SELECT id FROM products WHERE name = ?");
    $stmtInsertCart = $pdo->prepare("
        INSERT INTO cart_items (user_id, product_id, size, quantity) 
        VALUES (?, ?, ?, ?)
    ");

    foreach ($clientCart as $item) {
        $name = $item['name'] ?? '';
        $size = $item['size'] ?? '';
        $quantity = $item['quantity'] ?? 1;

        if (!empty($name) && !empty($size) && $quantity >= 1) {
            $stmtFindProduct->execute([$name]);
            $productRow = $stmtFindProduct->fetch();

            if ($productRow) {
                $productId = $productRow['id'];
                $stmtInsertCart->execute([$userId, $productId, $size, $quantity]);
            }
        }
    }

    sendResponse(true, 'Cart synced successfully.');
}

function handleGetCart($pdo) {
    $userId = getCurrentUserId();
    if (!$userId) {
        sendResponse(true, 'Cart data for guest user.', []);
    }
    
    $stmt = $pdo->prepare("
        SELECT 
            ci.size, ci.quantity, 
            p.id AS product_id, p.name, p.price, p.image_url 
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    ");
    $stmt->execute([$userId]);
    $cartItems = $stmt->fetchAll();
    
    $processedCart = array_map(function($item) {
        $item['price'] = (float)$item['price'];
        $item['quantity'] = (int)$item['quantity'];
        $item['image'] = $item['image_url'];
        $item['id'] = (int)$item['product_id'];
        unset($item['image_url']);
        unset($item['product_id']);
        return $item;
    }, $cartItems);

    sendResponse(true, 'Cart data loaded successfully from database.', $processedCart);
}

function handleSyncFavorites($pdo) {
    $userId = getCurrentUserId();
    if (!$userId) {
        sendResponse(false, 'User not authenticated.');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $clientFavorites = $data['favorites'] ?? [];

    $pdo->prepare("DELETE FROM favorite_items WHERE user_id = ?")->execute([$userId]);

    $stmtFindProduct = $pdo->prepare("SELECT id FROM products WHERE name = ?");
    $stmtInsertFav = $pdo->prepare("
        INSERT INTO favorite_items (user_id, product_id) 
        VALUES (?, ?)
    ");

    foreach ($clientFavorites as $item) {
        $name = $item['name'] ?? '';

        if (!empty($name)) {
            $stmtFindProduct->execute([$name]);
            $productRow = $stmtFindProduct->fetch();

            if ($productRow) {
                $productId = $productRow['id'];
                $stmtInsertFav->execute([$userId, $productId]);
            }
        }
    }

    sendResponse(true, 'Favorites synced successfully.');
}

function handleGetFavorites($pdo) {
    $userId = getCurrentUserId();
    if (!$userId) {
        sendResponse(true, 'Favorite data for guest user.', []);
    }
    
    $stmt = $pdo->prepare("
        SELECT 
            p.id AS product_id, p.name, p.price, p.image_url
        FROM favorite_items fi
        JOIN products p ON fi.product_id = p.id
        WHERE fi.user_id = ?
    ");
    $stmt->execute([$userId]);
    $favorites = $stmt->fetchAll();
    
    $processedFavorites = array_map(function($item) {
        $item['price'] = (float)$item['price'];
        $item['image'] = $item['image_url'];
        $item['id'] = (int)$item['product_id'];
        unset($item['image_url']);
        unset($item['product_id']);
        $item['size'] = 'One Size'; 
        return $item;
    }, $favorites);

    sendResponse(true, 'Favorite data loaded successfully from database.', $processedFavorites);
}

// ------------------------------------
// --- 7. Contact Form Logic ---
// ------------------------------------

function handleSubmitContact($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $number = trim($data['number'] ?? '');
    $message = trim($data['message'] ?? '');

    if (empty($name) || empty($email) || empty($number) || empty($message)) {
        http_response_code(400);
        sendResponse(false, 'Name, email, number, and message are required fields.');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        sendResponse(false, 'Invalid email format.');
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO contact_messages (name, email, number, message) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$name, $email, $number, $message]);
        
        sendResponse(true, 'Message sent successfully. We will contact you soon.');
    } catch (\PDOException $e) {
        error_log("Contact form insertion failed: " . $e->getMessage()); 
        http_response_code(500);
        sendResponse(false, 'Failed to send message. Please try again later.');
    }
}

// ------------------------------------
// --- 8. Checkout & Order Logic ---
// ------------------------------------

function handleCheckout($pdo) {
    $userId = $_SESSION['user_id'] ?? null;

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        sendResponse(false, 'Invalid JSON data received.');
    }

    $cart = $data['cart'] ?? [];
    $user_name = trim($data['user_name'] ?? '');
    $contact_number = trim($data['contact_number'] ?? '');
    $address = trim($data['address'] ?? '');
    $payment_method = trim($data['payment_method'] ?? '');
    $total_amount = $data['total_amount'] ?? 0;
    $payment_info = json_encode($data['payment_info'] ?? []);

    // Validate required fields
    if (empty($cart)) sendResponse(false, 'Cart is empty.');
    if (empty($user_name)) sendResponse(false, 'Name is required.');
    if (empty($contact_number)) sendResponse(false, 'Contact number is required.');
    if (empty($address)) sendResponse(false, 'Address is required.');
    if (empty($payment_method)) sendResponse(false, 'Payment method is required.');

    $validPaymentMethods = ['Cash on Delivery', 'Credit Card', 'PayPal'];
    $payment_method = preg_replace('/[^\x20-\x7E]/', '', $payment_method);
    $payment_method = trim($payment_method);

    if (!in_array($payment_method, $validPaymentMethods, true)) {
        sendResponse(false, 'Invalid payment method selected.');
    }

    try {
        $pdo->beginTransaction();

        // Insert order including payment_info JSON
        $stmtOrder = $pdo->prepare("
            INSERT INTO orders (user_name, contact_number, address, payment_method, payment_info, total_amount, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmtOrder->execute([$user_name, $contact_number, $address, $payment_method, $payment_info, $total_amount]);
        $orderId = $pdo->lastInsertId();

        // Insert order items and update stock
        $stmtItem = $pdo->prepare("
            INSERT INTO order_items (order_id, product_id, product_name, price, quantity, size) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmtUpdateStock = $pdo->prepare("
            UPDATE products 
            SET stock = stock - ? 
            WHERE id = ? AND stock >= ?
        ");

        foreach ($cart as $item) {
            $productId = $item['id'] ?? null;
            $productName = $item['name'] ?? '';
            $price = $item['price'] ?? 0;
            $quantity = $item['quantity'] ?? 0;
            $size = $item['size'] ?? '';

            if (!$productId || $quantity <= 0) continue;

            $stmtItem->execute([$orderId, $productId, $productName, $price, $quantity, $size]);
            $stmtUpdateStock->execute([$quantity, $productId, $quantity]);

            if ($stmtUpdateStock->rowCount() === 0) {
                $pdo->rollBack();
                sendResponse(false, "Insufficient stock for product: $productName");
            }
        }

        // Clear user's cart if logged in
        if ($userId) {
            $pdo->prepare("DELETE FROM cart_items WHERE user_id = ?")->execute([$userId]);
        }

        $pdo->commit();
        error_log("ORDER COMPLETED SUCCESSFULLY");
        sendResponse(true, 'Order placed successfully! Thank you for your purchase.');
    } catch (\PDOException $e) {
        $pdo->rollBack();
        error_log("CHECKOUT ERROR: " . $e->getMessage());
        error_log("CHECKOUT ERROR CODE: " . $e->getCode());
        sendResponse(false, 'Order failed: ' . $e->getMessage());
    }
}
?>