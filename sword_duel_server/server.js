const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = {};

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on("connection", (socket) => {
  console.log("Player connected");

  socket.on("createRoom", () => {
    const code = generateCode();

    rooms[code] = {
      players: [socket.id]
    };

    socket.join(code);

    socket.emit("roomCreated", code);
  });

  socket.on("joinRoom", (code) => {
    if (rooms[code] && rooms[code].players.length < 2) {
      rooms[code].players.push(socket.id);

      socket.join(code);

      io.to(code).emit("startGame");
    } else {
      socket.emit("errorMessage", "Room full or not found");
    }
  });

  socket.on("playerMove", (data) => {
    socket.to(data.room).emit("playerMove", data);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected");
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});