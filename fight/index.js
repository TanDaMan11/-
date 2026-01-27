const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

// 1. SERVE THE GAME FILE DIRECTLY
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let players = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 2. JOIN GAME EVENT
  socket.on("join", (name) => {
    players[socket.id] = {
      id: socket.id,
      x: Math.random() * 600 + 100, // Random Spawn
      y: Math.random() * 400 + 100,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`, // Random Color
      name: name || "Fighter",
      hp: 100,
      score: 0,
      w: 40, h: 40 // Size
    };
    io.emit("update", players);
  });

  // 3. MOVEMENT (Top-Down, No Gravity)
  socket.on("move", (data) => {
    if (players[socket.id]) {
      const p = players[socket.id];
      p.x = data.x;
      p.y = data.y;
      // Keep inside map bounds (800x600)
      if(p.x < 0) p.x = 0;
      if(p.x > 800) p.x = 800;
      if(p.y < 0) p.y = 0;
      if(p.y > 600) p.y = 600;
      
      socket.broadcast.emit("playerMoved", p);
    }
  });

  // 4. ATTACK LOGIC (Simple Radius Check)
  socket.on("attack", () => {
    const attacker = players[socket.id];
    if (!attacker) return;

    // Show attack visual to everyone
    io.emit("attackVisual", { x: attacker.x, y: attacker.y, id: socket.id });

    // Check if we hit anyone
    for (let id in players) {
      if (id !== socket.id) {
        const enemy = players[id];
        const dx = attacker.x - enemy.x;
        const dy = attacker.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If distance is less than 60 pixels, it's a hit
        if (distance < 60) {
          enemy.hp -= 10;
          if (enemy.hp <= 0) {
            attacker.score++; // Give killer a point
            enemy.hp = 100;   // Respawn enemy
            enemy.x = Math.random() * 600 + 100;
            enemy.y = Math.random() * 400 + 100;
          }
        }
      }
    }
    io.emit("update", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("update", players);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
