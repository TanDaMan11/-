const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- MAP SETTINGS ---
const MAP_WIDTH = 2500;
const MAP_HEIGHT = 1000;

let players = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. Initial State (In Menu)
  players[socket.id] = {
    x: 0, y: 0,
    color: "white",
    health: 100,
    score: 0,
    isPlaying: false, // Starts in lobby (Invisible)
    weapon: "gun",
    facing: 1,
    id: socket.id
  };

  // SEND IMMEDIATE UPDATES TO NEW PLAYER
  // This ensures the client knows how many people are online immediately
  io.emit("playerCount", Object.keys(players).length);
  socket.emit("updatePlayers", players); 

  // 2. Join Game Handler
  socket.on("joinGame", (weaponChoice) => {
    // Safety Check: If server forgot the player, recreate them
    if (!players[socket.id]) {
        players[socket.id] = {
            score: 0,
            id: socket.id,
            health: 100
        };
    }

    // Set them to "Playing" mode
    players[socket.id].isPlaying = true;
    players[socket.id].weapon = weaponChoice;
    
    // Spawn in random spot
    players[socket.id].x = Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100;
    players[socket.id].y = 0;
    
    // Random Neon Color
    players[socket.id].color = "hsl(" + Math.random() * 360 + ", 100%, 50%)";
    
    // Tell everyone to render this new player
    io.emit("updatePlayers", players);
  });

  // 3. Movement
  socket.on("playerMovement", (data) => {
    if (players[socket.id] && players[socket.id].isPlaying) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      players[socket.id].angle = data.angle; 
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. Combat Logic
  socket.on("attack", (data) => {
    const p = players[socket.id];
    if (!p || !p.isPlaying) return;

    const type = data.type; // 'primary' or 'special'
    const angle = data.angle;
    
    let range = 0;
    let damage = 0;
    let spread = 0;

    // --- WEAPON STATS ---
    if (type === 'primary') { 
        if (p.weapon === 'gun') { range = 900; damage = 12; spread = 0.05; }
        if (p.weapon === 'shotgun') { range = 350; damage = 45; spread = 0.5; }
        if (p.weapon === 'axe') { range = 120; damage = 40; spread = 0.8; }
    } 
    else if (type === 'special') { 
        if (p.weapon === 'gun') { range = 80; damage = 35; spread = 0.5; }
        if (p.weapon === 'shotgun') { range = 60; damage = 90; spread = 0.2; }
        if (p.weapon === 'axe') { range = 250; damage = 60; spread = 2.0; }
    }

    io.emit("attackAnim", { id: socket.id, type: type, weapon: p.weapon, angle: angle });

    // HIT CALCULATION
    for (let enemyId in players) {
        if (enemyId !== socket.id && players[enemyId].isPlaying) {
            const enemy = players[enemyId];
            
            const dx = enemy.x - p.x;
            const dy = (enemy.y - 20) - (p.y - 20); 
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const angleToEnemy = Math.atan2(dy, dx);
            let angleDiff = angleToEnemy - angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            if (dist < range && Math.abs(angleDiff) < spread) {
                players[enemyId].health -= damage;
                io.emit("updateHealth", { id: enemyId, health: players[enemyId].health });

                if (players[enemyId].health <= 0) {
                    p.score++;
                    players[enemyId].health = 100;
                    players[enemyId].x = Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100;
                    players[enemyId].y = 0;
                    
                    io.emit("scoreUpdate", { id: socket.id, score: p.score });
                    io.emit("respawn", players[enemyId]);
                }
            }
        }
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerCount", Object.keys(players).length);
    io.emit("disconnectUser", socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
