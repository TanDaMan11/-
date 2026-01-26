const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

let players = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. Send current players to the new person (so they see others)
  socket.emit("updatePlayers", players);

  // 2. LISTEN FOR THE JOIN SIGNAL
  // This is what spawns you!
  socket.on("joinGame", (data) => {
    players[socket.id] = {
      id: socket.id,
      x: 100, // Spawn Point X
      y: 0,   // Spawn Point Y
      w: 40, h: 40,
      color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
      health: 100,
      score: 0,
      weapon: data.weapon || 'rifle',
      facing: 1
    };
    // Tell everyone a new player is here
    io.emit("updatePlayers", players);
  });

  // 3. MOVEMENT
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      // Broadcast movement to everyone else
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. ATTACK LOGIC
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    // Send visual effect
    io.emit("attackAnim", { id: socket.id, weapon: p.weapon, facing: p.facing });

    // Calculate Damage
    let range = 400, damage = 10, height = 50;
    if (p.weapon === 'shotgun') { range = 150; damage = 30; height = 100; }
    if (p.weapon === 'axe') { range = 80; damage = 25; height = 80; }

    for (let id in players) {
      if (id !== socket.id) {
        const e = players[id];
        let hit = false;
        let dist = e.x - p.x;

        // Check Direction & Range
        if (p.facing === 1 && dist > 0 && dist < range) hit = true;  // Right
        if (p.facing === -1 && dist < 0 && Math.abs(dist) < range) hit = true; // Left
        
        // Check Vertical (are they on the same platform?)
        if (Math.abs(e.y - p.y) > height) hit = false;

        if (hit) {
          e.health -= damage;
          if (e.health <= 0) {
            e.health = 100;
            e.x = Math.random() * 600; e.y = 0; // Respawn
            p.score++;
          }
          io.emit("updatePlayers", players);
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
