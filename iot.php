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
define('FIREBASE_DB_URL', 'https://monitoring-iot-ujikom-ea02d-default-rtdb.asia-southeast1.firebasedatabase.app');

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
    // ⚠ PENTING: Paths harus match dengan yang didengarkan di dashboard.js
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
        'relay1' => '/iot/relay/1',
        'relay2' => '/iot/relay/2',
        'relay3' => '/iot/relay/3',
        'relay4' => '/iot/relay/4',
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

/**
 * MODE: Baca Relay
 * Menangkap parameter '?relay=N' dari URL (Metode HTTP GET).
 * Digunakan oleh micro:bit untuk mengecek apakah lampu/kipas harus menyala (1) atau mati (0).
 */
if (isset($_GET['relay'])) {

    // HAPUS SEMUA OUTPUT BUFFER
    // Memastikan tidak ada sisa teks atau spasi tersembunyi yang ikut terkirim ke micro:bit
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Mengonversi input parameter menjadi angka bulat (integer) untuk validasi nomor relay
    $relayNum = (int) $_GET['relay'];

    // Membatasi validasi: Jika nomor relay di luar rentang 1-4, hentikan program dan kembalikan nilai 0
    if ($relayNum < 1 || $relayNum > 4) {
        die("0");
    }

    // Mengambil status relay terbaru dari Firebase REST API berdasarkan nomor relay-nya
    $res = firebaseRequest('GET', '/iot/relay/' . $relayNum);

    // Jika koneksi ke cloud Firebase gagal (status code bukan 200 OK), kembalikan nilai 0 demi keamanan
    if ($res['status'] !== 200) {
        die("0");
    }

    // Membersihkan karakter aneh, tanda kutip, spasi, atau baris baru (\r\n) dari respon Firebase
    $val = trim($res['body'], "\" \r\n\t");

    // RESPONSE HARUS MURNI
    // Jika data di Firebase bernilai "1", kirimkan karakter "1" polos ke micro:bit
    if ($val === "1") {
        die("1");
    }

    // Jika data bernilai 0 atau null, kirimkan karakter "0" polos ke micro:bit
    die("0");
}

/**
 * MODE: Tulis Data Sensor
 * Menangkap parameter '?data=nama_sensor:nilai' dari URL (Metode HTTP GET).
 * Digunakan oleh micro:bit untuk mengirimkan data hasil pembacaan suhu dan cahaya.
 */
if (isset($_GET['data'])) {
    // Memilah teks mentah (Contoh: "suhu:27") menjadi array terpisah ['name' => 'suhu', 'value' => '27']
    $parsed = parseData($_GET['data']);

    // Jika format salah (tidak menggunakan tanda titik dua), kirim respon eror 400 Bad Request
    if (!$parsed) {
        http_response_code(400);
        echo 'ERROR: Format tidak valid. Gunakan: name:value';
        exit;
    }

    $name = $parsed['name'];
    $value = $parsed['value'];

    // Konversi nilai menjadi tipe data float/angka desimal jika teks yang dikirim berupa angka
    if (is_numeric($value)) {
        $value = (float) $value;
    }

    // Menentukan target path folder di Firebase (misal: /sensor/suhu) dan mengunggah nilai barunya
    $path = sensorPath($name);
    $res = firebaseRequest('PUT', $path, $value);

    // Jika Firebase menolak atau server bermasalah, kembalikan status HTTP 502 Bad Gateway
    if ($res['status'] < 200 || $res['status'] >= 300) {
        http_response_code(502);
        echo 'ERROR: Gagal kirim ke Firebase. HTTP ' . $res['status'];
        exit;
    }

    // Memperbarui informasi waktu pengiriman terakhir di Firebase cloud
    firebaseRequest('PUT', '/sensor/lastUpdate', date('Y-m-d H:i:s'));

    // Jika yang dikirim adalah sensor (bukan relay), masukkan nilainya ke dalam folder riwayat (history)
    if (strpos($path, '/relay/') === false) {
        appendHistory($name, $value);
    }

    // Mengembalikan respon teks 'OK' ke micro:bit menandakan siklus pengiriman sukses total
    echo 'OK';
    exit;
}
