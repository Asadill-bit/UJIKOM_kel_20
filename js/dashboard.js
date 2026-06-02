import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Auth guard
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'login.html';
});

document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = 'login.html';
});

function highlightActiveSidebar() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const link = document.querySelector(`.sidebar-nav a[href="${currentPage}"]`);
  if (link) link.classList.add('active');
}

highlightActiveSidebar();

// ====================================
// SENSOR DATA — hanya Suhu & Cahaya
// ====================================
const sensorRef = ref(db, 'sensor');

onValue(sensorRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    loadDummy();
    return;
  }
  updateStats(data);
  updateTable(data.history || []);
  // Teruskan ke chart
  window.__sensorData = data;
  if (window.renderChart) window.renderChart(data.chart);
}, () => loadDummy());

function updateStats(data) {
  // Suhu
  const suhu = data.suhu ?? '--';
  document.getElementById('statSuhu').textContent = suhu + '°C';
  const trendSuhu = document.getElementById('trendSuhu');
  if (trendSuhu && suhu !== '--') {
    trendSuhu.textContent = suhu > 35 ? '↑ Panas!' : suhu > 28 ? '↑ Normal' : '↓ Dingin';
    trendSuhu.className = 'trend ' + (suhu > 35 ? 'down' : 'up');
  }

  // Cahaya
  const cahaya = data.cahaya ?? '--';
  document.getElementById('statCahaya').textContent = cahaya + ' lx';
  const trendCahaya = document.getElementById('trendCahaya');
  if (trendCahaya && cahaya !== '--') {
    trendCahaya.textContent = cahaya > 400 ? '↑ Terang' : cahaya > 100 ? '↑ Redup' : '↓ Gelap';
    trendCahaya.className = 'trend ' + (cahaya > 100 ? 'up' : 'down');
  }
}

function updateTable(rows) {
  const tbody = document.getElementById('dataTable');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.waktu}</td>
      <td>${r.sensor}</td>
      <td>${r.nilai}</td>
      <td><span class="badge-pill ${r.status === 'OK' ? 'ok' : r.status === 'WARN' ? 'warn' : 'err'}">${r.status}</span></td>
    </tr>
  `).join('');
}

// Fallback ke dummy.json
async function loadDummy() {
  try {
    const res = await fetch('data/dummy.json');
    const data = await res.json();
    updateStats(data);
    updateTable(data.history || []);
    window.__sensorData = data;
    if (window.renderChart) window.renderChart(data.chart);
  } catch (e) {
    console.warn('Tidak bisa memuat data dummy:', e);
  }
}

// ====================================
// RELAY CONTROL
// ====================================
const relayRef = ref(db, 'relay/1');
const relayToggle = document.getElementById('relayToggle');
const relayLabel  = document.getElementById('relayLabel');
const relayStatus = document.getElementById('relayStatus');

// Dengarkan perubahan relay dari Firebase (realtime)
onValue(relayRef, (snapshot) => {
  const val = snapshot.val();
  const isOn = val === 1 || val === true || val === '1';

  if (relayToggle) relayToggle.checked = isOn;
  if (relayLabel)  relayLabel.textContent = isOn ? 'ON' : 'OFF';
  if (relayLabel)  relayLabel.style.color = isOn ? '#10b981' : 'var(--muted)';
  if (relayStatus) relayStatus.textContent =
    'Status: ' + (isOn ? '🟢 Menyala — perangkat aktif' : '🔴 Mati — perangkat non-aktif');
});

// Ketika toggle diklik → tulis ke Firebase & simpan ke riwayat
if (relayToggle) {
  relayToggle.addEventListener('change', async () => {
    const newState = relayToggle.checked ? 1 : 0;
    const labelState = newState === 1 ? 'ON' : 'OFF';
    try {
      // 1. Update status relay
      await set(relayRef, newState);
      console.log('Relay 1 set to:', newState);

      // 2. Tambahkan log ke history sensor di Firebase
      const historyRef = ref(db, 'sensor/history');
      const historySnapshot = await get(historyRef);
      let history = historySnapshot.val() || [];
      if (!Array.isArray(history)) {
        history = history ? Object.values(history) : [];
      }

      const now = new Date();
      // Format jam: menit: detik lokal
      const timeStr = now.toTimeString().split(' ')[0];
      // Format tanggal: YYYY-MM-DD
      const dateStr = now.toISOString().split('T')[0];

      history.push({
        waktu: timeStr,
        tanggal: dateStr,
        sensor: 'Relay 1',
        nilai: labelState,
        status: 'OK'
      });

      // Batasi history maksimal 50 baris
      if (history.length > 50) {
        history = history.slice(-50);
      }

      await set(historyRef, history);

    } catch (err) {
      console.error('Gagal mengubah relay atau mencatat riwayat:', err);
      // Kembalikan toggle jika gagal
      relayToggle.checked = !relayToggle.checked;
    }
  });
}
