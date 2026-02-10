// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    // PASTE YOUR KEYS HERE
    apiKey: "AIzaSyDJudKhWjoBeBQw5TOYqXewpL8metr6gP0", 
    authDomain: "mini-games-f0c31.firebaseapp.com",
    projectId: "mini-games-f0c31",
    storageBucket: "mini-games-f0c31.firebasestorage.app",
    messagingSenderId: "395360656567",
    appId: "1:395360656567:web:87d287dd339bcdf8560132",
    measurementId: "G-LQL0PBHK0E"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
