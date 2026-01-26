const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

// Allow CORS so your client can connect from anywhere (Localhost or Render)
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static files if you are hosting the HTML in the same project
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// GAME STATE
let players = {};

io.on('connection', (socket) => {
    console.log('⚡ New Player Connected:', socket.id);

    // --- INSTANT SPAWN LOGIC ---
    // We create the player object immediately. No "Join" button required.
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 800, // Random spawn X
        y: 100,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`, // Random color
        health: 100,
        facing: 1, // 1 = Right, -1 = Left
        score: 0
    };

    // Send this new player to everyone, and send everyone to this new player
    io.emit('updatePlayers', players);

    // 1. MOVEMENT LISTENERS
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].facing = data.facing;
            // Broadcast the movement to everyone else (updates their screens)
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 2. COMBAT LISTENERS
    socket.on('attack', () => {
        const attacker = players[socket.id];
        if (!attacker) return;

        // Visual: Tell everyone this player attacked
        io.emit('attackAnim', { id: socket.id });

        // Logic: Check hitboxes on Server (prevent cheating)
        // Hitbox: 100px range in front of player
        for (let enemyId in players) {
            if (enemyId !== socket.id) {
                const enemy = players[enemyId];
                
                // Calculate Distance
                const dx = enemy.x - attacker.x;
                const dy = enemy.y - attacker.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                // Check if enemy is in front and close
                const isInFront = (attacker.facing === 1 && dx > 0) || (attacker.facing === -1 && dx < 0);
                
                if (dist < 100 && isInFront) {
                    enemy.health -= 10;
                    
                    // Respawn if dead
                    if (enemy.health <= 0) {
                        attacker.score += 1;
                        enemy.health = 100;
                        enemy.x = Math.random() * 800;
                        enemy.y = 0;
                    }
                    
                    // Sync health changes to everyone
                    io.emit('updatePlayers', players);
                }
            }
        }
    });

    // 3. DISCONNECT
    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Use Render's PORT or 3000 for local
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
