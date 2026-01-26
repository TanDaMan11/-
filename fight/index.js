const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- MAP SETTINGS ---
const MAP_WIDTH = 2500; // Much wider map
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
    isPlaying: false, // Starts in lobby
    weapon: "gun",
    facing: 1,
    id: socket.id
  };

  // Update player count for everyone
  io.emit("playerCount", Object.keys(players).length);

  // 2. Join Game Handler
  socket.on("joinGame", (weaponChoice) => {
    if (players[socket.id]) {
      players[socket.id].isPlaying = true;
      players[socket.id].weapon = weaponChoice;
      // Spawn in random spot
      players[socket.id].x = Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100;
      players[socket.id].y = 0;
      
      // Random Neon Color
      players[socket.id].color = "hsl(" + Math.random() * 360 + ", 100%, 50%)";
      
      io.emit("updatePlayers", players);
    }
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

    const type = data.type; // 'primary' (click) or 'special' (S key)
    const angle = data.angle;
    
    // Weapon Stats
    let range = 0;
    let damage = 0;
    let spread = 0;

    // --- CONFIGURING THE WEAPONS ---
    if (type === 'primary') { // LEFT CLICK (Main Attack)
        if (p.weapon === 'gun') { range = 900; damage = 12; spread = 0.05; } // Long range, low dmg
        if (p.weapon === 'shotgun') { range = 350; damage = 45; spread = 0.5; } // Short, high dmg
        if (p.weapon === 'axe') { range = 120; damage = 40; spread = 0.8; } // Melee swing
    } 
    else if (type === 'special') { // "S" KEY (Alt Attack)
        if (p.weapon === 'gun') { range = 80; damage = 35; spread = 0.5; } // KNIFE STAB
        if (p.weapon === 'shotgun') { range = 60; damage = 90; spread = 0.2; } // HEADSHOT EXECUTION
        if (p.weapon === 'axe') { range = 250; damage = 60; spread = 2.0; } // GROUND SLAM
    }

    // Show visual effect to everyone
    io.emit("attackAnim", { id: socket.id, type: type, weapon: p.weapon, angle: angle });

    // --- HIT DETECTION ---
    for (let enemyId in players) {
        if (enemyId !== socket.id && players[enemyId].isPlaying) {
            const enemy = players[enemyId];
            
            // Distance check
            const dx = enemy.x - p.x;
            const dy = (enemy.y - 20) - (p.y - 20); 
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Angle check (Are we looking at them?)
            const angleToEnemy = Math.atan2(dy, dx);
            let angleDiff = angleToEnemy - angle;
            // Normalize angle math
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // IF HIT:
            if (dist < range && Math.abs(angleDiff) < spread) {
                players[enemyId].health -= damage;
                io.emit("updateHealth", { id: enemyId, health: players[enemyId].health });

                // IF DEAD:
                if (players[enemyId].health <= 0) {
                    p.score++;
                    // Respawn Enemy
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
