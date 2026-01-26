const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

let players = {};
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 1000;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. INSTANT SPAWN (No Join Button needed)
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 500 + 100,
    y: 100,
    color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
    health: 100,
    score: 0,
    weapon: 'rifle', // Default weapon
    angle: 0
  };

  io.emit("updatePlayers", players);

  // 2. MOVEMENT & ANGLE
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle; // We need angle for shooting
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 3. SWITCH WEAPON
  socket.on("switchWeapon", (weaponType) => {
    if (players[socket.id]) {
      players[socket.id].weapon = weaponType;
      io.emit("updatePlayers", players); // Tell everyone I changed weapon
    }
  });

  // 4. COMBAT LOGIC
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    // Weapon Stats
    let range = 800, damage = 10, spread = 0.1;
    if (p.weapon === 'shotgun') { range = 300; damage = 40; spread = 0.5; }
    if (p.weapon === 'axe') { range = 100; damage = 35; spread = 1.0; }

    io.emit("attackAnim", { id: socket.id, weapon: p.weapon, angle: p.angle });

    // Check Hits
    for (let enemyId in players) {
      if (enemyId !== socket.id) {
        const enemy = players[enemyId];
        const dist = Math.sqrt(Math.pow(enemy.x - p.x, 2) + Math.pow(enemy.y - p.y, 2));
        
        // Calculate Angle Difference
        const angleToEnemy = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        let angleDiff = angleToEnemy - p.angle;
        // Normalize angle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (dist < range && Math.abs(angleDiff) < spread) {
          players[enemyId].health -= damage;
          
          if (players[enemyId].health <= 0) {
            // Respawn Enemy
            players[enemyId].health = 100;
            players[enemyId].x = Math.random() * 500;
            players[enemyId].y = 0;
            p.score++;
          }
          
          io.emit("updateHealth", players);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
