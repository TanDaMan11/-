const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// --- GAME SETTINGS ---
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 800;
const OBSTACLES = [
    { x: 200, y: 200, w: 100, h: 400 }, // Big wall left
    { x: 700, y: 200, w: 100, h: 400 }, // Big wall right
    { x: 400, y: 350, w: 200, h: 100 }, // Middle Box
];

let players = {};

io.on("connection", (socket) => {
    console.log("New Fighter:", socket.id);

    // JOIN
    socket.on("join", (name) => {
        players[socket.id] = {
            id: socket.id,
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            name: name.substring(0, 10) || "Fighter",
            hp: 100,
            maxHp: 100,
            score: 0,
            radius: 20,
            lastAttack: 0
        };
        // Send map info to the new player
        socket.emit("mapData", { obstacles: OBSTACLES, w: MAP_WIDTH, h: MAP_HEIGHT });
        io.emit("update", players);
    });

    // MOVE
    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        let oldX = p.x;
        let oldY = p.y;

        p.x = data.x;
        p.y = data.y;

        // Map Boundaries
        if(p.x < p.radius) p.x = p.radius;
        if(p.x > MAP_WIDTH - p.radius) p.x = MAP_WIDTH - p.radius;
        if(p.y < p.radius) p.y = p.radius;
        if(p.y > MAP_HEIGHT - p.radius) p.y = MAP_HEIGHT - p.radius;

        // Wall Collision
        for(let wall of OBSTACLES) {
            if(p.x + p.radius > wall.x && p.x - p.radius < wall.x + wall.w &&
               p.y + p.radius > wall.y && p.y - p.radius < wall.y + wall.h) {
               // If hit wall, revert position
               p.x = oldX; 
               p.y = oldY;
            }
        }

        socket.broadcast.emit("playerMoved", p);
    });

    // ATTACK
    socket.on("attack", () => {
        const p = players[socket.id];
        if (!p) return;

        const now = Date.now();
        if(now - p.lastAttack < 400) return; // Attack Cooldown (0.4s)
        p.lastAttack = now;

        io.emit("attackAnim", { id: socket.id, x: p.x, y: p.y });

        // Hit Detection
        for (let id in players) {
            if (id !== socket.id) {
                let enemy = players[id];
                let dist = Math.sqrt((p.x - enemy.x)**2 + (p.y - enemy.y)**2);
                
                if (dist < 60) { // Attack Range
                    enemy.hp -= 15;
                    io.emit("hitAnim", { x: enemy.x, y: enemy.y }); // Blood effect
                    
                    if (enemy.hp <= 0) {
                        p.score++;
                        enemy.hp = 100;
                        enemy.x = Math.random() * 800 + 100;
                        enemy.y = Math.random() * 600 + 100;
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
