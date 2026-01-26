const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = {};

io.on("connection", socket => {
  players[socket.id] = {
    id: socket.id,
    x: 400,
    y: 100,
    vx: 0,
    vy: 0,
    damage: 0,
    weapon: "sword",
    facing: 1
  };

  io.emit("state", players);

  socket.on("move", data => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit("playerMove", players[socket.id]);
  });

  socket.on("attack", () => {
    const p = players[socket.id];
    if (!p) return;

    for (let id in players) {
      if (id === socket.id) continue;
      const e = players[id];
      const dx = e.x - p.x;

      if (Math.abs(dx) < 80 && Math.abs(e.y - p.y) < 50) {
        e.damage += p.weapon === "sword" ? 8 : 4;
        e.vx += p.facing * (2 + e.damage * 0.05);
        e.vy -= 3 + e.damage * 0.05;
      }
    }

    io.emit("state", players);
  });

  socket.on("weapon", w => {
    if (players[socket.id]) players[socket.id].weapon = w;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("state", players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
