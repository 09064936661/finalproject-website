<?php
// db.php - change values below to match your environment

// Database credentials (XAMPP default: user=root, pass empty)
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = ''; // usually empty on XAMPP
$DB_NAME = 'blonde_shop'; // <- REPLACE this with your actual DB name

// Create mysqli connection
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

// Check connection
if ($conn->connect_errno) {
    // For production you might want to log this instead of echoing.
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]);
    exit;
}

// Ensure UTF-8 charset
$conn->set_charset('utf8mb4');