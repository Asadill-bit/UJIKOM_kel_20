<?php
/**
 * iot.php — Jembatan antara ESP8266/micro:bit dan Firebase Realtime Database
 *
 * Alur:
 *   micro:bit  →  ESP8266 (AT Command)  →  GET /iot.php?data=suhu:27.4  →  Firebase REST API
 *
 * Parameter GET yang didukung:
 *   ?data=name:value   → Tulis sensor ke Firebase (angka atau teks)
 *   ?relay=N           → Baca status relay N (1-4) dari Firebase, kembalikan 1 atau 0
 *
 * ================================================================
 *  KONFIGURASI — Sesuaikan dengan project Firebase Anda
 * ================================================================
 */

// URL Firebase Realtime Database Anda (tanpa trailing slash)
define('FIREBASE_DB_URL', 'https://monitoring-iot-29ac6-default-rtdb.asia-southeast1.firebasedatabase.app');

// Database Secret (Legacy Token) — Ambil dari:
// Firebase Console → Project Settings → Service Accounts → Database Secrets → Show
// ATAU: atur Firebase Rules ke public write untuk testing (lihat README)
define('FIREBASE_SECRET', '');   // <-- Isi jika menggunakan autentikasi

// Jumlah maksimum entri riwayat yang disimpan di Firebase
define('MAX_HISTORY', 50);

// ================================================================
//  CORS & Header (agar bisa diakses dari mana saja di jaringan)
// ================================================================
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain; charset=UTF-8');

// ================================================================
//  FUNGSI UTAMA
// ================================================================

/**
 * Kirim request HTTP ke Firebase REST API menggunakan cURL
 *
 * @param string $method  GET | PUT | PATCH | DELETE
 * @param string $path    Path Firebase, contoh: /sensor/suhu
 * @param mixed  $body    Data yang akan dikirim (array/null)
 * @return array ['status' => int, 'body' => string]
 */
function firebaseRequest(string $method, string $path, $body = null): array
{
    $secret = FIREBASE_SECRET;
    $url = FIREBASE_DB_URL . $path . '.json';
    if ($secret !== '') {
        $url .= '?auth=' . urlencode($secret);
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // XAMPP lokal tidak punya CA bundle lengkap
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));

    if ($body !== null) {
        $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }

    $response = curl_exec($ch);
    $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        error_log("[iot.php] cURL error: $error");
    }

    return ['status' => $httpStatus, 'body' => $response];
}

/**
 * Parsing URL-encoded data dari ESP8266
 * Format: "name:value" (setelah URL-decode)
 * Contoh: "suhu%3A27.4" → ['name' => 'suhu', 'value' => '27.4']
 */
function parseData(string $raw): ?array
{
    $decoded = urldecode($raw);                   // "suhu:27.4"
    $parts = explode(':', $decoded, 2);          // ['suhu', '27.4']
    if (count($parts) < 2)
        return null;

    $name = trim($parts[0]);
    $value = trim($parts[1]);

    if ($name === '')
        return null;
    return compact('name', 'value');
}

/**
 * Konversi nama sensor ke path Firebase
 * Contoh: "suhu" → /sensor/suhu
 *          "relay1" → /relay/1
 */
function sensorPath(string $name): string
{
    // Mapping nama sensor dari micro:bit ke path Firebase
    $map = [
        'suhu' => '/sensor/suhu',
        'temp' => '/sensor/suhu',
        'temperature' => '/sensor/suhu',
        'kelembapan' => '/sensor/kelembapan',
        'humidity' => '/sensor/kelembapan',
        'tekanan' => '/sensor/tekanan',
        'pressure' => '/sensor/tekanan',
        'cahaya' => '/sensor/cahaya',
        'light' => '/sensor/cahaya',
        'lux' => '/sensor/cahaya',
        'relay1' => '/relay/1',
        'relay2' => '/relay/2',
        'relay3' => '/relay/3',
        'relay4' => '/relay/4',
        'uid' => '/sensor/uid',       // untuk NFC/RFID
        'rfid' => '/sensor/uid',
    ];

    $key = strtolower($name);
    return $map[$key] ?? '/sensor/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
}

/**
 * Tambahkan entri ke riwayat Firebase (array terbatas MAX_HISTORY)
 */
function appendHistory(string $name, $value): void
{
    // Baca history saat ini
    $res = firebaseRequest('GET', '/sensor/history');
    $history = [];

    if ($res['status'] === 200 && $res['body'] !== 'null') {
        $decoded = json_decode($res['body'], true);
        if (is_array($decoded)) {
            $history = array_values($decoded); // re-index
        }
    }

    // Tambah entri baru
    $history[] = [
        'waktu' => date('H:i:s'),
        'tanggal' => date('Y-m-d'),
        'sensor' => $name,
        'nilai' => (string) $value,
        'status' => 'OK',
    ];

    // Batasi jumlah entri
    if (count($history) > MAX_HISTORY) {
        $history = array_slice($history, -MAX_HISTORY);
    }

    firebaseRequest('PUT', '/sensor/history', $history);
}

// ================================================================
//  ROUTING — Tangani request dari ESP8266
// ================================================================

// --- MODE: Baca Relay ---
if (isset($_GET['relay'])) {

    // HAPUS SEMUA OUTPUT BUFFER
    while (ob_get_level()) {
        ob_end_clean();
    }

    $relayNum = (int) $_GET['relay'];

    if ($relayNum < 1 || $relayNum > 4) {

        die("0");
    }

    $res = firebaseRequest('GET', '/relay/' . $relayNum);

    if ($res['status'] !== 200) {

        die("0");
    }

    $val = trim($res['body'], "\" \r\n\t");

    // RESPONSE HARUS MURNI
    if ($val === "1") {

        die("1");
    }

    die("0");
}

// --- MODE: Tulis Data Sensor ---
if (isset($_GET['data'])) {
    $parsed = parseData($_GET['data']);

    if (!$parsed) {
        http_response_code(400);
        echo 'ERROR: Format tidak valid. Gunakan: name:value';
        exit;
    }

    $name = $parsed['name'];
    $value = $parsed['value'];

    // Konversi ke angka jika memungkinkan
    if (is_numeric($value)) {
        $value = (float) $value;
    }

    // Update nilai sensor di Firebase
    $path = sensorPath($name);
    $res = firebaseRequest('PUT', $path, $value);

    if ($res['status'] < 200 || $res['status'] >= 300) {
        http_response_code(502);
        echo 'ERROR: Gagal kirim ke Firebase. HTTP ' . $res['status'];
        exit;
    }

    // Update timestamp terakhir
    firebaseRequest('PUT', '/sensor/lastUpdate', date('Y-m-d H:i:s'));

    // Simpan ke riwayat (hanya untuk sensor utama, bukan relay)
    if (strpos($path, '/relay/') === false) {
        appendHistory($name, $value);
    }

    echo 'OK';
    exit;
}

// --- Tidak ada parameter yang dikenali ---
http_response_code(400);
echo 'ERROR: Parameter tidak dikenali. Gunakan ?data=name:value atau ?relay=N';
