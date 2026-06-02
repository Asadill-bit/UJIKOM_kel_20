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
  applyAutomation(data);
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
const relay1Ref = ref(db, 'relay/1');
const relay2Ref = ref(db, 'relay/2');
const autoLampRef = ref(db, 'automation/lamp');
const autoFanRef = ref(db, 'automation/fan');

const relay1Toggle = document.getElementById('relay1Toggle');
const relay1Label = document.getElementById('relay1Label');
const relay1Status = document.getElementById('relay1Status');
const autoLampToggle = document.getElementById('autoLampToggle');
const lampModeText = document.getElementById('lampModeText');

const relay2Toggle = document.getElementById('relay2Toggle');
const relay2Label = document.getElementById('relay2Label');
const relay2Status = document.getElementById('relay2Status');
const autoFanToggle = document.getElementById('autoFanToggle');
const fanModeText = document.getElementById('fanModeText');

let autoLampEnabled = false;
let autoFanEnabled = false;

function normalizeRelayValue(value) {
  return value === 1 || value === true || value === '1' || value === 'true';
}

function updateRelayUI(toggle, label, statusEl, on) {
  if (toggle) toggle.checked = on;
  if (label) {
    label.textContent = on ? 'ON' : 'OFF';
    label.className = 'relay-label ' + (on ? 'on' : 'off');
  }
  if (statusEl) {
    statusEl.textContent = 'Status: ' + (on ? '🟢 Menyala — perangkat aktif' : '🔴 Mati — perangkat non-aktif');
  }
}

function updateModeText(statusEl, enabled) {
  if (statusEl) {
    statusEl.textContent = enabled ? 'Mode: Automatic' : 'Mode: Manual';
  }
}

async function logRelayHistory(deviceName, valueText, mode) {
  try {
    const historyRef = ref(db, 'sensor/history');
    const historySnapshot = await get(historyRef);
    let history = historySnapshot.val() || [];
    if (!Array.isArray(history)) {
      history = history ? Object.values(history) : [];
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toISOString().split('T')[0];

    history.push({
      waktu: timeStr,
      tanggal: dateStr,
      sensor: deviceName,
      nilai: valueText,
      status: `OK (${mode})`
    });

    if (history.length > 50) {
      history = history.slice(-50);
    }

    await set(historyRef, history);
  } catch (err) {
    console.error('Gagal mencatat riwayat relay:', err);
  }
}

async function writeRelayState(relayRef, state, deviceName, mode) {
  try {
    await set(relayRef, state);
    await logRelayHistory(deviceName, state === 1 ? 'ON' : 'OFF', mode);
    console.log(`${deviceName} set to ${state} (${mode})`);
  } catch (err) {
    console.error(`Gagal mengubah ${deviceName}:`, err);
  }
}

function maybeApplyLampAutomation(data) {
  if (!autoLampEnabled || !data) return;
  const light = Number(data.cahaya);
  if (Number.isNaN(light)) return;
  const currentOn = relay1Toggle?.checked;
  if (light <= 150 && !currentOn) {
    writeRelayState(relay1Ref, 1, 'Relay 1', 'Automatic');
  } else if (light >= 250 && currentOn) {
    writeRelayState(relay1Ref, 0, 'Relay 1', 'Automatic');
  }
}

function maybeApplyFanAutomation(data) {
  if (!autoFanEnabled || !data) return;
  const temp = Number(data.suhu);
  if (Number.isNaN(temp)) return;
  const currentOn = relay2Toggle?.checked;
  if (temp >= 30 && !currentOn) {
    writeRelayState(relay2Ref, 1, 'Relay 2', 'Automatic');
  } else if (temp <= 28 && currentOn) {
    writeRelayState(relay2Ref, 0, 'Relay 2', 'Automatic');
  }
}

function applyAutomation(data) {
  maybeApplyLampAutomation(data);
  maybeApplyFanAutomation(data);
}

// Dengarkan perubahan relay dari Firebase (realtime)
onValue(relay1Ref, (snapshot) => {
  const isOn = normalizeRelayValue(snapshot.val());
  updateRelayUI(relay1Toggle, relay1Label, relay1Status, isOn);
});

onValue(relay2Ref, (snapshot) => {
  const isOn = normalizeRelayValue(snapshot.val());
  updateRelayUI(relay2Toggle, relay2Label, relay2Status, isOn);
});

onValue(autoLampRef, (snapshot) => {
  autoLampEnabled = normalizeRelayValue(snapshot.val());
  if (autoLampToggle) autoLampToggle.checked = autoLampEnabled;
  updateModeText(lampModeText, autoLampEnabled);
  maybeApplyLampAutomation(window.__sensorData);
});

onValue(autoFanRef, (snapshot) => {
  autoFanEnabled = normalizeRelayValue(snapshot.val());
  if (autoFanToggle) autoFanToggle.checked = autoFanEnabled;
  updateModeText(fanModeText, autoFanEnabled);
  maybeApplyFanAutomation(window.__sensorData);
});

if (relay1Toggle) {
  relay1Toggle.addEventListener('change', async () => {
    const newState = relay1Toggle.checked ? 1 : 0;
    await writeRelayState(relay1Ref, newState, 'Relay 1', autoLampEnabled ? 'Automatic' : 'Manual');
  });
}

if (relay2Toggle) {
  relay2Toggle.addEventListener('change', async () => {
    const newState = relay2Toggle.checked ? 1 : 0;
    await writeRelayState(relay2Ref, newState, 'Relay 2', autoFanEnabled ? 'Automatic' : 'Manual');
  });
}

if (autoLampToggle) {
  autoLampToggle.addEventListener('change', async () => {
    autoLampEnabled = autoLampToggle.checked;
    updateModeText(lampModeText, autoLampEnabled);
    await set(autoLampRef, autoLampEnabled ? 1 : 0);
    if (autoLampEnabled) maybeApplyLampAutomation(window.__sensorData);
  });
}

if (autoFanToggle) {
  autoFanToggle.addEventListener('change', async () => {
    autoFanEnabled = autoFanToggle.checked;
    updateModeText(fanModeText, autoFanEnabled);
    await set(autoFanRef, autoFanEnabled ? 1 : 0);
    if (autoFanEnabled) maybeApplyFanAutomation(window.__sensorData);
  });
}
