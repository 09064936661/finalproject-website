<?php
// save_order.php

header('Content-Type: application/json');

// Include database connection
require 'db.php';

// Only handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

// Sanitize inputs
$user_name = $conn->real_escape_string(trim($_POST['user_name'] ?? ''));
$contact_number = $conn->real_escape_string(trim($_POST['contact_number'] ?? ''));
$address = $conn->real_escape_string(trim($_POST['address'] ?? ''));
$payment_method = $conn->real_escape_string(trim($_POST['payment_method'] ?? ''));
$total_amount = $conn->real_escape_string(trim($_POST['total_amount'] ?? ''));

// Validate required fields
if (empty($user_name) || empty($contact_number) || empty($address) || empty($payment_method) || empty($total_amount)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit();
}

// Insert order into database
$sql = "INSERT INTO orders (user_name, contact_number, address, payment_method, total_amount) 
        VALUES ('$user_name', '$contact_number', '$address', '$payment_method', '$total_amount')";

if ($conn->query($sql) === TRUE) {
    echo json_encode(['success' => true, 'message' => 'Order placed successfully! Thank you for your purchase.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
}

$conn->close();
?>
