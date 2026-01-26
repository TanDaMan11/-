const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

let players = {};

io.on("connection", (socket) => {
  console.log("User connected to lobby:", socket.id);

  // 1. Send current players to the new person so they can see the game happening
  socket.emit("updatePlayers", players);

  // 2. WAIT FOR JOIN (This is the fix)
  socket.on("joinGame", () => {
    console.log("Player joining:", socket.id);
    players[socket.id] = {
      id: socket.id,
      x: Math.random() * 400 + 100,
      y: 100,
      color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
      health: 100,
      score: 0,
      facing: 1
    };
    // Tell everyone a new player has actually joined
    io.emit("updatePlayers", players);
  });

  // 3. MOVEMENT
  socket.on("playerMovement", (data) => {
    // Only move if the player actually exists (has joined)
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. ATTACK
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    io.emit("attackAnim", { id: socket.id, facing: p.facing });

    // Simple Hit Logic
    for (let id in players) {
      if (id !== socket.id) {
        let enemy = players[id];
        let dx = enemy.x - p.x;
        let dy = Math.abs(enemy.y - p.y);
        
        // Range check (100px range, must be mostly on same level)
        if (dy < 60) {
            if ((p.facing === 1 && dx > 0 && dx < 100) || 
                (p.facing === -1 && dx < 0 && dx > -100)) {
                
                enemy.health -= 10;
                if (enemy.health <= 0) {
                    enemy.health = 100;
                    enemy.x = Math.random() * 500;
                    enemy.y = 0;
                    p.score++;
                }
                io.emit("updatePlayers", players);
            }
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
