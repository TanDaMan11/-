// 1. Firebase Imports (Specific for GitHub Pages / Vanilla JS)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDJudKhWjoBeBQw5TOYqXewpL8metr6gP0",
  authDomain: "mini-games-f0c31.firebaseapp.com",
  databaseURL: "https://mini-games-f0c31-default-rtdb.firebaseio.com",
  projectId: "mini-games-f0c31",
  storageBucket: "mini-games-f0c31.firebasestorage.app",
  messagingSenderId: "395360656567",
  appId: "1:395360656567:web:87d287dd339bcdf8560132"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const playerIdEl = document.getElementById("player-id");
const walletBalanceEl = document.getElementById("wallet-balance");
const tableContainer = document.getElementById("table-container");
const myCardsEl = document.getElementById("my-cards");

// Helper: Shuffle Deck
function getShuffledDeck() {
  const suits = ['♥', '♦', '♣', '♠'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];
  for (let suit of suits) {
      for (let rank of ranks) { deck.push(rank + suit); }
  }
  for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Ensure tables exist in database
async function setupTables() {
  const tableNames = ["Table 1", "Table 2", "Table 3", "Table 4"];
  for (let name of tableNames) {
    const tableRef = doc(db, "tables", name);
    const snap = await getDoc(tableRef);
    if (!snap.exists()) {
      await setDoc(tableRef, { name: name, playerCount: 0, maxPlayers: 6 });
    }
  }
}

// Listen to lobby tables
function listenToTables() {
  onSnapshot(collection(db, "tables"), (snapshot) => {
    tableContainer.innerHTML = ''; 
    snapshot.forEach((docSnap) => {
      const table = docSnap.data();
      const card = document.createElement("div");
      card.className = "table-card";
      card.innerHTML = `
        <h3>${table.name}</h3>
        <p>Players: ${table.playerCount} / ${table.maxPlayers}</p>
        <button onclick="joinTable('${docSnap.id}')" ${table.playerCount >= table.maxPlayers ? 'disabled' : ''}>
          Join Table
        </button>
      `;
      tableContainer.appendChild(card);
    });
  });
}

// JOIN TABLE & DEAL CARDS LOGIC
window.joinTable = async (tableId) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 1. Swap UI
    document.getElementById("lobby-screen").classList.remove("active");
    document.getElementById("game-screen").classList.add("active");
    document.getElementById("current-table-id").innerText = tableId;

    // 2. Seat Player
    const playerRef = doc(db, "tables", tableId, "seatedPlayers", user.uid);
    await setDoc(playerRef, { seatNumber: 1, currentBet: 0, status: "Active", holeCards: [] });

    // 3. Listen to MY hand so it updates on screen
    onSnapshot(playerRef, (docSnap) => {
      const data = docSnap.data();
      if (data && data.holeCards && data.holeCards.length === 2) {
        myCardsEl.innerText = `[ ${data.holeCards[0]} ]  [ ${data.holeCards[1]} ]`;
      }
    });

    // 4. Frontend Dealer: Shuffle and deal to everyone seated
    const playersSnap = await getDocs(collection(db, "tables", tableId, "seatedPlayers"));
    let deck = getShuffledDeck();
    const batch = writeBatch(db);

    playersSnap.forEach((playerDoc) => {
        const card1 = deck.pop();
        const card2 = deck.pop();
        batch.update(playerDoc.ref, { holeCards: [card1, card2] });
    });

    batch.update(doc(db, "tables", tableId), { pot: 0, communityCards: [], handStage: 'Pre-flop' });
    batch.set(doc(db, "tables", tableId, "secretData", "deckState"), { remainingDeck: deck });

    await batch.commit();

  } catch (error) {
    console.error("Error joining table:", error);
  }
};

// Auth Listener on Startup
onAuthStateChanged(auth, async (user) => {
  if (user) {
    playerIdEl.textContent = "User_" + user.uid.substring(0, 5);
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) await setDoc(userRef, { walletBalance: 1000 });
    onSnapshot(userRef, (docSnap) => {
      if(docSnap.exists()) walletBalanceEl.textContent = docSnap.data().walletBalance;
    });

    setupTables().then(() => listenToTables());
  } else {
    signInAnonymously(auth);
  }
});
