const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, { cors: { origin: "*" } });

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// --- GAME CONFIG ---
const ARENA_RADIUS = 350; // Size of the iceberg
const PLAYER_RADIUS = 25;
const FRICTION = 0.96; // 1.0 is no friction (ice), 0.9 is sand. 0.96 is slippery.

let players = {};
let roundTime = 15; // Seconds

// Game Loop Timer (15s Reset)
setInterval(() => {
    roundTime--;
    if (roundTime <= 0) {
        resetGame();
    }
    io.emit("timer", roundTime);
}, 1000);

function resetGame() {
    roundTime = 15;
    // Reset positions and multipliers
    for (let id in players) {
        respawnPlayer(players[id]);
    }
    io.emit("update", players);
}

function respawnPlayer(p) {
    p.x = Math.random() * 200 - 100; // Spawn near center
    p.y = Math.random() * 200 - 100;
    p.vx = 0;
    p.vy = 0;
    p.multiplier = 1.0; // Reset damage percent
    p.alive = true;
}

io.on("connection", (socket) => {
    console.log("Penguin joined:", socket.id);

    // Create Player
    players[socket.id] = {
        id: socket.id,
        x: 0, y: 0, vx: 0, vy: 0,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        multiplier: 1.0, // Starts at 100% (1.0)
        alive: true
    };
    respawnPlayer(players[socket.id]);

    // SHOOT (Slingshot logic)
    socket.on("shoot", (data) => {
        const p = players[socket.id];
        if (!p || !p.alive) return;

        // Apply velocity based on drag power
        // Cap max speed so they don't warp through walls
        let speed = Math.min(data.power, 25); 
        p.vx = Math.cos(data.angle) * speed;
        p.vy = Math.sin(data.angle) * speed;
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

// --- PHYSICS LOOP (60 Times per second) ---
setInterval(() => {
    for (let id in players) {
        let p = players[id];
        if (!p.alive) continue;

        // 1. Movement & Friction
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= FRICTION;
        p.vy *= FRICTION;

        // 2. Check Death (Fall off Iceberg)
        let distFromCenter = Math.sqrt(p.x*p.x + p.y*p.y);
        if (distFromCenter > ARENA_RADIUS + PLAYER_RADIUS) {
            p.alive = false;
        }
    }

    // 3. Collisions (Penguin vs Penguin)
    let ids = Object.keys(players);
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            let p1 = players[ids[i]];
            let p2 = players[ids[j]];

            if (!p1.alive || !p2.alive) continue;

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.sqrt(dx*dx + dy*dy);

            // If touching
            if (dist < PLAYER_RADIUS * 2) {
                // Calculate Collision Force
                let angle = Math.atan2(dy, dx);
                let speed1 = Math.sqrt(p1.vx*p1.vx + p1.vy*p1.vy);
                let speed2 = Math.sqrt(p2.vx*p2.vx + p2.vy*p2.vy);
                
                // The faster you are hit, the harder you fly
                let force = (speed1 + speed2) * 0.8 + 2; 

                // INCREASE MULTIPLIERS (The "Smash Bros" mechanic)
                p1.multiplier += 0.1; // Add 10%
                p2.multiplier += 0.1; // Add 10%

                // Apply Knockback * Multiplier
                let kb1 = force * p1.multiplier;
                let kb2 = force * p2.multiplier;

                // Push them apart
                p1.vx -= Math.cos(angle) * kb1;
                p1.vy -= Math.sin(angle) * kb1;
                p2.vx += Math.cos(angle) * kb2;
                p2.vy += Math.sin(angle) * kb2;

                // Separate them slightly so they don't stick
                let overlap = (PLAYER_RADIUS * 2 - dist) / 2;
                p1.x -= Math.cos(angle) * overlap;
                p1.y -= Math.sin(angle) * overlap;
                p2.x += Math.cos(angle) * overlap;
                p2.y += Math.sin(angle) * overlap;
            }
        }
    }

    io.emit("update", players);
}, 1000 / 60);

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
