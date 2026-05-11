<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db   = 'cafe_pos';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Chưa bật MySQL hoặc chưa tạo Database!']);
    exit();
}

$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true);

try {
    if ($action === 'categories') {
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT * FROM categories');
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } elseif ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)');
            $stmt->execute([$data['id'], $data['name'], $data['icon']]);
            echo json_encode(['success' => true]);
        } elseif ($method === 'DELETE') {
            $stmt = $pdo->prepare('UPDATE menu_items SET category_id = "other" WHERE category_id = ?');
            $stmt->execute([$id]);
            $stmt = $pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    } elseif ($action === 'menu') {
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT * FROM menu_items');
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } elseif ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO menu_items (id, name, price, category_id, image) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$data['id'], $data['name'], $data['price'], $data['category'], $data['image'] ?? '']);
            echo json_encode(['success' => true]);
        } elseif ($method === 'PUT') {
            $stmt = $pdo->prepare('UPDATE menu_items SET name=?, price=?, category_id=?, image=? WHERE id=?');
            $stmt->execute([$data['name'], $data['price'], $data['category'], $data['image'] ?? '', $id]);
            echo json_encode(['success' => true]);
        } elseif ($method === 'DELETE') {
            $stmt = $pdo->prepare('DELETE FROM menu_items WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    } elseif ($action === 'orders') {
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT * FROM orders');
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } elseif ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO orders (id, items, total, payment_method, customer_name, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$data['id'], $data['items'], $data['total'], $data['payment_method'], $data['customer_name'], $data['date'], $data['status']]);
            echo json_encode(['success' => true]);
        } elseif ($method === 'DELETE') {
            $stmt = $pdo->prepare('DELETE FROM orders WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}