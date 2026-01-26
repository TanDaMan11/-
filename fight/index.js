const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

let players = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. INSTANT SPAWN
  // We create the player immediately. No waiting.
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 400 + 100,
    y: 100,
    color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
    health: 100,
    score: 0,
    weapon: 'rifle', // Default
    facing: 1 // 1 = Right, -1 = Left
  };

  // Send the full player list to everyone
  io.emit("updatePlayers", players);

  // 2. MOVEMENT
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      
      // Broadcast to others (excluding sender to prevent lag/jitter on client)
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 3. WEAPON SWITCH
  socket.on("switchWeapon", (wep) => {
    if (players[socket.id]) {
      players[socket.id].weapon = wep;
      io.emit("updatePlayers", players);
    }
  });

  // 4. ATTACK
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    // Send animation to everyone
    io.emit("playerAttack", { id: socket.id, weapon: p.weapon });

    // Calculate Hits
    let range = 400, damage = 10, width = 50;
    if (p.weapon === 'shotgun') { range = 150; damage = 30; width = 80; }
    if (p.weapon === 'axe') { range = 60; damage = 25; width = 60; }

    // Hit Logic (Side Scroller)
    for (let enemyId in players) {
      if (enemyId !== socket.id) {
        const e = players[enemyId];
        
        // Check Y Distance (Vertical overlap)
        const yDist = Math.abs(e.y - p.y);
        
        // Check X Distance (Horizontal range based on facing)
        let hit = false;
        if (p.facing === 1) { // Facing Right
             if (e.x > p.x && e.x < p.x + range && yDist < width) hit = true;
        } else { // Facing Left
             if (e.x < p.x && e.x > p.x - range && yDist < width) hit = true;
        }

        if (hit) {
          players[enemyId].health -= damage;
          if (players[enemyId].health <= 0) {
            players[enemyId].health = 100;
            players[enemyId].x = Math.random() * 400 + 100;
            players[enemyId].y = 0;
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
