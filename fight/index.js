const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

// ALLOW GITHUB TO CONNECT
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let players = {};

io.on("connection", (socket) => {
  console.log("Fighter joined:", socket.id);

  // 1. Initialize Player
  players[socket.id] = {
    x: 100,
    y: 0,
    color: "hsl(" + Math.random() * 360 + ", 100%, 50%)",
    direction: 1, // 1 = Right, -1 = Left
    health: 100,
    score: 0,
    id: socket.id
  };

  // 2. Send data to client
  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", players[socket.id]);

  // 3. Handle Movement
  socket.on("playerMovement", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].direction = data.direction;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  // 4. Handle Attack (Server Logic)
  socket.on("attack", () => {
    const attacker = players[socket.id];
    if (!attacker) return;

    // Tell everyone to show the attack animation
    io.emit("playerAttack", socket.id);

    // Check if anyone was hit
    for (let enemyId in players) {
      if (enemyId !== socket.id) {
        const enemy = players[enemyId];
        
        // Simple Distance Check
        const dx = attacker.x - enemy.x;
        const dy = attacker.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If close enough (60 pixels), take damage
        if (distance < 60) {
          enemy.health -= 10;
          io.emit("updateHealth", { id: enemyId, health: enemy.health });

          // Check for Death
          if (enemy.health <= 0) {
            attacker.score += 1;
            
            // Respawn Enemy
            enemy.health = 100;
            enemy.x = Math.floor(Math.random() * 500);
            enemy.y = 0;

            // Notify everyone
            io.emit("scoreUpdate", { id: socket.id, score: attacker.score });
            io.emit("respawn", enemy);
          }
        }
      }
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("disconnectUser", socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
