// Firebase Configuration
// Project: monitoring-92e1e
// PENTING: Jangan commit file ini ke repository publik.
// Gunakan Firebase Security Rules untuk membatasi akses data.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzBDdHWLMkWN7bH3oJBdri6s5KRBM6EHk",
  authDomain: "monitoring-iot-29ac6.firebaseapp.com",
  databaseURL: "https://monitoring-iot-29ac6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-iot-29ac6",
  storageBucket: "monitoring-iot-29ac6.firebasestorage.app",
  messagingSenderId: "4724063661",
  appId: "1:4724063661:web:0a03e34b61072f9fd97524",
  measurementId: "G-2Y44SR9LMN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
