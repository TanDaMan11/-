const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

// --- THIS WAS MISSING. IT IS REQUIRED TO LOAD THE GAME. ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
// ----------------------------------------------------------

let players = {};

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  // 1. CREATE PLAYER IMMEDIATELY (Instant Spawn)
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 400 + 100, // Random X spawn
    y: 100,
    color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
    health: 100,
    score: 0,
    facing: 1
  };

  // 2. Send the player list to everyone
  io.emit("updatePlayers", players);

  // 3. Movement Listener
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      // Tell everyone else this player moved
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. Attack Listener
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    io.emit("attackAnim", { id: socket.id, facing: p.facing });

    // Hit Detection
    for (let id in players) {
      if (id !== socket.id) {
        let enemy = players[id];
        let dist = enemy.x - p.x;
        let yDist = Math.abs(enemy.y - p.y);

        // Simple Range Check (Attack range 100px)
        if (yDist < 60) { // Must be on same vertical level
             if ((p.facing === 1 && dist > 0 && dist < 100) || 
                 (p.facing === -1 && dist < 0 && dist > -100)) {
                 
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
    console.log("User disconnected: " + socket.id);
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
