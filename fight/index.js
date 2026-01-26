const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

// Serve the file if you go to the render URL directly (optional but good)
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

let players = {};

io.on("connection", (socket) => {
  console.log("Connected: " + socket.id);

  // 1. Send update to the new user so they see the count
  socket.emit("updatePlayers", players);

  // 2. JOIN GAME (Waits for name)
  socket.on("joinGame", (data) => {
    players[socket.id] = {
      id: socket.id,
      x: Math.random() * 400 + 100,
      y: 100,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      health: 100,
      score: 0,
      facing: 1,
      name: data.name || "Player" // Store the name
    };
    io.emit("updatePlayers", players);
  });

  // 3. MOVEMENT
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. ATTACK (Longer Range)
  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    io.emit("attackAnim", { id: socket.id, facing: p.facing });

    for (let id in players) {
      if (id !== socket.id) {
        let enemy = players[id];
        let dx = enemy.x - p.x;
        let dy = Math.abs(enemy.y - p.y);
        
        // RANGE INCREASED TO 150 (Was 100)
        if (dy < 60) {
            if ((p.facing === 1 && dx > 0 && dx < 150) || 
                (p.facing === -1 && dx < 0 && dx > -150)) {
                
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
