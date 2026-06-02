import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const form = document.getElementById('loginForm');
const message = document.getElementById('loginMessage');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    message.textContent = 'Memproses...';
    message.className = 'form-message';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      message.textContent = 'Berhasil masuk! Mengalihkan...';
      message.className = 'form-message success';
      setTimeout(() => (window.location.href = 'dashbord.html'), 800);
    } catch (err) {
      message.textContent = 'Email atau password salah.';
      message.className = 'form-message error';
      console.error(err);
    }
  });
}

// Auto redirect jika sudah login
onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.endsWith('login.html')) {
    window.location.href = 'dashboard.html';
  }
});

export async function logout() {
  await signOut(auth);
  window.location.href = 'login.html';
}

// Toggle show/hide password di form login
window.togglePassword = function () {
  const pass = document.getElementById('password');
  const btn = document.querySelector('.toggle-pass-btn');
  if (!pass) return;
  if (pass.type === 'password') {
    pass.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    pass.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
};
