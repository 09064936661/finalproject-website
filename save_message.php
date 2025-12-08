<?php
// save_message.php
header('Content-Type: application/json'); // JSON response
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Sanitize inputs
    $name = trim($conn->real_escape_string($_POST['name'] ?? ''));
    $email = trim($conn->real_escape_string($_POST['email'] ?? ''));
    $number = trim($conn->real_escape_string($_POST['number'] ?? ''));
    $message = trim($conn->real_escape_string($_POST['message'] ?? ''));

    // Validate required fields
    if (empty($name) || empty($email) || empty($message) || empty($number)) {
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
        exit;
    }

    // Insert into database
    $sql = "INSERT INTO contact_messages (name, email, number, message) VALUES ('$name', '$email', '$number', '$message')";
    if ($conn->query($sql) === TRUE) {
        echo json_encode(['success' => true, 'message' => 'Message sent successfully!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Database Error: ' . $conn->error]);
    }

    $conn->close();
}
?>
