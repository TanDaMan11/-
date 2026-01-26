const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" }
});

const MAP_WIDTH = 2500;
const MAP_HEIGHT = 1000;

let players = {};

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // 1. Create a "Spectator" version of the player immediately
  // This ensures the ID exists in the system right away
  players[socket.id] = {
    id: socket.id,
    active: false, // Not playing yet
    x: 0, y: 0
  };

  io.emit("updatePlayers", players);
  io.emit("playerCount", Object.keys(players).length);

  // 2. The Simple "Join" Logic
  // When this is received, we simply RESET the player data to "Alive"
  socket.on("joinGame", (weapon) => {
    players[socket.id] = {
      id: socket.id,
      active: true, // Now they are visible
      x: Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100,
      y: 100,
      color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
      health: 100,
      score: 0,
      weapon: weapon,
      facing: 1,
      angle: 0
    };
    io.emit("updatePlayers", players);
  });

  // 3. Movement
  socket.on("playerMovement", (data) => {
    if (players[socket.id] && players[socket.id].active) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      players[socket.id].angle = data.angle;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. Combat (Smash Bros Style)
  socket.on("attack", (data) => {
    const p = players[socket.id];
    if (!p || !p.active) return;

    // Show the visual
    io.emit("attackAnim", { id: socket.id, ...data });

    // Stats
    let range = 0, damage = 0, spread = 0;
    if (data.type === 'primary') {
       if (p.weapon === 'gun') { range = 900; damage = 10; spread = 0.05; }
       if (p.weapon === 'shotgun') { range = 300; damage = 40; spread = 0.4; }
       if (p.weapon === 'axe') { range = 130; damage = 35; spread = 0.8; }
    } else { // Special
       if (p.weapon === 'gun') { range = 80; damage = 30; spread = 0.5; }
       if (p.weapon === 'shotgun') { range = 60; damage = 80; spread = 0.2; }
       if (p.weapon === 'axe') { range = 250; damage = 50; spread = 1.5; }
    }

    // Hit Logic
    for (let id in players) {
      if (id !== socket.id && players[id].active) {
        const enemy = players[id];
        const dist = Math.sqrt(Math.pow(enemy.x - p.x, 2) + Math.pow(enemy.y - p.y, 2));
        
        // Simple Angle Math
        const angleToEnemy = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        let angleDiff = angleToEnemy - data.angle;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (dist < range && Math.abs(angleDiff) < spread) {
          players[id].health -= damage;
          io.emit("updateHealth", { id: id, health: players[id].health });

          if (players[id].health <= 0) {
            p.score++;
            // Respawn Enemy
            players[id].health = 100;
            players[id].x = Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100;
            players[id].y = 0;
            io.emit("scoreUpdate", { id: socket.id, score: p.score });
            io.emit("respawn", players[id]);
          }
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
