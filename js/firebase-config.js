// Firebase Configuration
// Project: monitoring-92e1e
// PENTING: Jangan commit file ini ke repository publik.
// Gunakan Firebase Security Rules untuk membatasi akses data.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQJ7KjqcLmzUmth5vIQupVQLfnP_rbUCk",
  authDomain: "monitoring-iot-ujikom-ea02d.firebaseapp.com",
  databaseURL: "https://monitoring-iot-ujikom-ea02d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-iot-ujikom-ea02d",
  storageBucket: "monitoring-iot-ujikom-ea02d.firebasestorage.app",
  messagingSenderId: "12076528888",
  appId: "1:12076528888:web:ca726664ddf7b00ae1b70d",
  measurementId: "G-WL5HPXL6XH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
