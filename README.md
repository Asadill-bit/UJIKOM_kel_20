# Monitoring Sensor IoT Realtime dengan Firebase

Aplikasi monitoring sensor (Suhu & Cahaya) dan kontrol Relay secara realtime berbasis **Firebase Realtime Database** dan **Firebase Authentication**. Dirancang khusus sebagai panduan lengkap untuk keperluan Ujian Kompetensi Keahlian (Ujikom).

---

## 🛠️ Langkah 1: Setup Firebase Console

### 1.1 Membuat Project Baru
1. Buka **[Firebase Console](https://console.firebase.google.com/)** lalu login menggunakan akun Google Anda.
2. Klik **Add Project** (Tambah Project).
3. Isi nama project Anda (contoh: `monitoring-iot-ujikom`), lalu klik **Continue**.
4. Anda dapat menonaktifkan Google Analytics (opsional), lalu klik **Create Project** dan tunggu hingga selesai.

### 1.2 Mengaktifkan Firebase Authentication (Login User)
1. Di menu navigasi sidebar sebelah kiri, klik **Build** -> **Authentication**.
2. Klik tombol **Get Started**.
3. Di tab **Sign-in method**, pilih **Email/Password**.
4. Centang toggle **Enable** di kolom atas (Email/Password), lalu klik **Save**.
5. Masuk ke tab **Users** (di sebelah tab Sign-in method), lalu klik **Add user**.
6. Masukkan detail akun admin untuk login dashboard Anda:
   * **Email:** `admin@gmail.com`
   * **Password:** `admin123`
7. Klik **Add user** untuk menyimpan.

### 1.3 Mengaktifkan Realtime Database
1. Di menu navigasi sidebar sebelah kiri, klik **Build** -> **Realtime Database**.
2. Klik tombol **Create Database**.
3. Pilih lokasi database (pilih **Singapore / asia-southeast1** agar koneksi lebih cepat), klik **Next**.
4. Pilih opsi **Start in test mode** (Mode Pengujian), lalu klik **Enable**.
5. Masuk ke tab **Rules** di bagian atas, lalu ubah isinya menjadi aturan produksi berikut agar aman (web wajib login untuk membaca data, tetapi IoT bebas menulis data tanpa login):
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": true
     }
   }
   ```
6. Klik tombol **Publish** di bagian kanan atas.

### 1.4 Menyalin Konfigurasi SDK ke Web
1. Klik ikon **Gear / Pengaturan (⚙️)** di sebelah "Project Overview" di pojok kiri atas -> klik **Project settings**.
2. Di tab **General**, scroll ke bawah ke bagian "Your apps" -> klik ikon **Web (`</>`)**.
3. Masukkan nama aplikasi (contoh: `web-monitoring`), lalu klik **Register app**.
4. Salin kode di dalam objek `firebaseConfig` yang muncul. Objeknya terlihat seperti ini:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "monitoring-...",
     databaseURL: "https://...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Buka file proyek Anda di komputer: `js/firebase-config.js`.
6. Timpa (replace) isi `const firebaseConfig = { ... }` dengan konfigurasi yang baru saja Anda salin dari Firebase Console. Simpan file tersebut.

---

## 💻 Langkah 2: Setup Web Server Lokal (XAMPP)

1. Pindahkan folder proyek `monitoring-firebase` ke direktori web server XAMPP Anda:
   * **Windows:** `C:\xampp\htdocs\monitoring-firebase`
2. Buka **XAMPP Control Panel** dan klik **Start** pada bagian **Apache**.
3. Buka file `iot.php` di dalam proyek Anda menggunakan editor teks.
4. Sesuaikan konstanta `FIREBASE_DB_URL` dengan URL database Firebase Anda (tanpa garis miring `/` di bagian akhir):
   ```php
   define('FIREBASE_DB_URL', 'https://monitoring-iot-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app');
   ```
5. Buka **Command Prompt (CMD)** di Windows, ketik `ipconfig` dan tekan Enter.
6. Cari bagian **IPv4 Address** pada adapter WiFi Anda (contoh: `10.214.89.143` atau `192.168.1.10`). Catat IP ini untuk digunakan di micro:bit.
7. Lakukan uji coba pengiriman data manual melalui browser dengan mengakses URL berikut (ganti IP dengan IP laptop Anda):
   * **Kirim Suhu 30°C:** `http://IP_LAPTOP_ANDA/monitoring-firebase/iot.php?data=suhu:30`
   * **Kirim Cahaya 450 lx:** `http://IP_LAPTOP_ANDA/monitoring-firebase/iot.php?data=cahaya:450`
   * Jika sukses, browser akan menampilkan teks **`OK`** dan data akan langsung terisi otomatis di Firebase Console Anda.

---

## 🔌 Langkah 3: Setup Hardware di MakeCode micro:bit

### 3.1 Skema Pin Out
Hubungkan perangkat keras Anda menggunakan kabel jumper sesuai dengan skema berikut:
* **ESP8266 TX** $\rightarrow$ Pin **P16** micro:bit (Serial RX)
* **ESP8266 RX** $\rightarrow$ Pin **P15** micro:bit (Serial TX)
* **Relay Signal** $\rightarrow$ Pin **P8** micro:bit (Digital Out)
* *Pastikan GND ESP8266, Relay, dan micro:bit saling terhubung (Common Ground).*

### 3.2 Menginstal Ekstensi ESP8266 di MakeCode
1. Buka browser dan buka **[MakeCode micro:bit](https://microbit.org/code/)**.
2. Buat project baru.
3. Klik tombol **Extensions** (atau **Ekstensi**) di bagian bawah daftar block code.
4. Tempel URL repositori GitHub berikut di kolom pencarian:
   `https://github.com/Zalswaw/esp8266RZ`
5. Tekan Enter, lalu klik pada ekstensi **esp8266RZ** yang muncul untuk menambahkannya ke proyek MakeCode.

### 3.3 Menambahkan Custom Ekstensi Firebase
Karena ekstensi di atas hanya mengurus perintah koneksi WiFi (AT Command), kita perlu menambahkan ekstensi custom TypeScript untuk penulisan data ke Firebase:
1. Di halaman MakeCode, scroll ke bagian paling bawah di bawah simulator (di bawah daftar file proyek / di sebelah kiri tombol download), cari menu **Explorer**.
2. Klik tanda tambah **`+`** (New File) di sebelah tulisan Explorer / custom.
3. Jika muncul konfirmasi untuk mengubah proyek ke mode edit file, pilih **Yes / Proceed**.
4. Beri nama file baru tersebut **`custom.ts`** (atau nama bebas lainnya).
5. Buka berkas [firebase-extension.ts](firebase-extension.ts) yang ada di folder proyek Anda di komputer, salin seluruh isi kodenya, lalu tempel (paste) ke dalam file `custom.ts` yang baru dibuat di MakeCode tersebut.
6. Klik kembali tab block editor atau `main.ts` untuk mulai coding.

### 3.4 Contoh Program micro:bit (Single-Loop Scheduler)
Agar pengiriman data sensor tidak tabrakan dengan pengecekan relay pada port serial ESP8266, gunakan metode penjadwalan satu loop berikut:

#### Opsi A: Menggunakan Python
```python
counter = 0

# ======== Koneksi WiFi & Awal ========
esp8266.init(SerialPin.P16, SerialPin.P15, BaudRate.BAUD_RATE115200)
esp8266.connect_wi_fi("NAMA_WIFI_ANDA", "PASSWORD_WIFI_ANDA")
basic.pause(3000)

if esp8266.is_wifi_connected():
    basic.show_icon(IconNames.HEART)
else:
    basic.show_icon(IconNames.GHOST)

# ======== Konfigurasi Firebase ========
firebase.set_host("IP_LAPTOP_ANDA") # Contoh: "10.214.89.143"
firebase.set_path("/monitoring-firebase/iot.php")
firebase.set_use_ssl(False)

# ======== Loop Utama ========
def on_forever():
    global counter
    
    # 1. Cek Status Relay (Setiap 1 detik)
    status_relay = firebase.get_relay(1)
    if status_relay == 1:
        pins.digital_write_pin(DigitalPin.P8, 1) # ON
    elif status_relay == 0:
        pins.digital_write_pin(DigitalPin.P8, 0) # OFF
    # Jika return -1 (error), status relay tidak diubah untuk menghindari kedipan

    # 2. Kirim Sensor (Setiap 20 detik sekali)
    counter += 1
    if counter >= 20:
        firebase.send_sensor("suhu", input.temperature())
        basic.pause(2000) # Jeda aman antar koneksi
        firebase.send_sensor("cahaya", input.light_level())
        counter = 0 # Reset counter

    basic.pause(1000)

basic.forever(on_forever)
```

#### Opsi B: Menggunakan TypeScript
```typescript
let counter = 0

// ======== Koneksi WiFi & Awal ========
esp8266.init(SerialPin.P16, SerialPin.P15, BaudRate.BaudRate115200)
esp8266.connectWifi("NAMA_WIFI_ANDA", "PASSWORD_WIFI_ANDA")
basic.pause(3000)

if (esp8266.isWifiConnected()) {
    basic.showIcon(IconNames.Heart)
} else {
    basic.showIcon(IconNames.Ghost)
}

// ======== Konfigurasi Firebase ========
firebase.setHost("IP_LAPTOP_ANDA") // Contoh: "10.214.89.143"
firebase.setPath("/monitoring-firebase/iot.php")
firebase.setUseSSL(false)

// ======== Loop Utama ========
basic.forever(function () {
    // 1. Cek Status Relay (Setiap 1 detik)
    let statusRelay = firebase.getRelay(1)
    if (statusRelay == 1) {
        pins.digitalWritePin(DigitalPin.P8, 1) // ON
    } else if (statusRelay == 0) {
        pins.digitalWritePin(DigitalPin.P8, 0) // OFF
    }

    // 2. Kirim Sensor (Setiap 20 detik sekali)
    counter += 1
    if (counter >= 20) {
        firebase.sendSensor("suhu", input.temperature())
        basic.pause(2000)
        firebase.sendSensor("cahaya", input.lightLevel())
        counter = 0
    }

    basic.pause(1000)
})
```

---

## 📁 Struktur Folder Proyek

```
monitoring-firebase/
├── index.html                  # Landing page bertema gelap modern
├── login.html                  # Halaman login dengan validasi Firebase Auth
├── dashboard.html              # Halaman monitoring utama & panel relay
├── css/
│   ├── style.css               # Styling utama landing page
│   ├── login.css               # Styling halaman login
│   └── dashboard.css           # Styling dashboard utama
├── js/
│   ├── firebase-config.js      # Konfigurasi SDK Firebase
│   ├── auth.js                 # Handler login & logout
│   ├── dashboard.js            # Controller sensor realtime & kontrol relay
│   └── sensorChart.js          # Rendering grafik interaktif (Chart.js)
├── firebase-extension.ts       # File ekstensi Firebase untuk di-copy ke MakeCode
├── iot.php                     # Bridge API untuk microbit & Firebase
└── data/
    └── dummy.json              # Data fallback saat koneksi database kosong
```

---

## 💻 Lisensi
Proyek ini dibuat untuk keperluan Pendidikan dan Ujian Kompetensi Keahlian (Ujikom). 
MIT License © 2026.
