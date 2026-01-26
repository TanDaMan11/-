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

  // 1. Add player to list, but mark as INACTIVE (Lobby mode)
  players[socket.id] = {
    id: socket.id,
    active: false, // They are in the menu
    x: 0, y: 0,
    score: 0
  };

  // Send update to everyone so they know player count
  io.emit("updatePlayers", players);
  io.emit("playerCount", Object.keys(players).length);

  // 2. ACTUAL JOIN (When button is clicked)
  socket.on("joinGame", (weaponChoice) => {
    if (players[socket.id]) {
        players[socket.id].active = true;
        players[socket.id].weapon = weaponChoice;
        players[socket.id].health = 100;
        players[socket.id].color = "hsl(" + Math.random() * 360 + ", 100%, 50%)";
        players[socket.id].x = Math.random() * 500 + 100;
        players[socket.id].y = 100;
        players[socket.id].angle = 0;
        
        // Tell everyone this player is now playing
        io.emit("updatePlayers", players);
    }
  });

  // 3. MOVEMENT
  socket.on("playerMovement", (data) => {
    if (players[socket.id] && players[socket.id].active) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. COMBAT
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p || !p.active) return;

    let range = 800, damage = 10, spread = 0.1;
    if (p.weapon === 'shotgun') { range = 300; damage = 40; spread = 0.5; }
    if (p.weapon === 'axe') { range = 100; damage = 35; spread = 1.0; }

    io.emit("attackAnim", { id: socket.id, weapon: p.weapon, angle: p.angle });

    for (let enemyId in players) {
      if (enemyId !== socket.id && players[enemyId].active) {
        const enemy = players[enemyId];
        const dist = Math.sqrt(Math.pow(enemy.x - p.x, 2) + Math.pow(enemy.y - p.y, 2));
        const angleToEnemy = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        let angleDiff = angleToEnemy - p.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (dist < range && Math.abs(angleDiff) < spread) {
          players[enemyId].health -= damage;
          if (players[enemyId].health <= 0) {
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
    io.emit("playerCount", Object.keys(players).length);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
