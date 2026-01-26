<!DOCTYPE html>
<html>
<head>
    <title>Platformer Arena</title>
    <style>
        body { margin: 0; background: #1a1a1a; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
        canvas { display: block; }
        #gameUI { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        #hud { padding: 20px; color: white; display: none; }
        .bar-container { width: 300px; height: 15px; background: #444; margin-top: 5px; border: 2px solid white; }
        .hp-bar { height: 100%; background: #0f0; width: 100%; transition: width 0.1s; }
        #menu { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.95); 
            display: flex; flex-direction: column; 
            align-items: center; justify-content: center; 
            color: white; pointer-events: auto; z-index: 10;
        }
        h1 { font-size: 70px; margin-bottom: 10px; color: #ff0055; text-transform: uppercase; letter-spacing: 5px; }
        #playerCount { font-size: 24px; color: #0f0; margin-bottom: 30px; font-weight: bold; }
        .weapon-container { display: flex; gap: 20px; }
        .weapon-card {
            width: 150px; padding: 20px; text-align: center; cursor: pointer;
            border: 2px solid #444; background: #222; color: white; border-radius: 8px;
            transition: 0.2s;
        }
        .weapon-card:hover { transform: translateY(-5px); border-color: #ff0055; }
        .selected { border-color: #0f0; background: #002200; box-shadow: 0 0 15px #0f0; }
        .weapon-icon { font-size: 40px; display: block; margin-bottom: 10px; }
        #joinBtn {
            margin-top: 40px; padding: 15px 60px; font-size: 30px; 
            background: #ff0055; color: white; border: none; cursor: pointer; 
            font-weight: bold; border-radius: 5px;
        }
        #joinBtn:hover { background: #ff3377; box-shadow: 0 0 20px #ff0055; }
    </style>
</head>
<body>

    <div id="menu">
        <h1>Battle Arena</h1>
        <p id="playerCount">Connecting to server...</p>
        
        <h3>SELECT YOUR LOADOUT</h3>
        <div class="weapon-container">
            <div class="weapon-card selected" onclick="selectWeapon('gun', this)">
                <span class="weapon-icon">🔫</span>
                <strong>RIFLE</strong><br><small style="color:#aaa">Range: High<br>Special: Knife Stab</small>
            </div>
            <div class="weapon-card" onclick="selectWeapon('shotgun', this)">
                <span class="weapon-icon">💥</span>
                <strong>SHOTGUN</strong><br><small style="color:#aaa">Range: Low<br>Special: Execution</small>
            </div>
            <div class="weapon-card" onclick="selectWeapon('axe', this)">
                <span class="weapon-icon">🪓</span>
                <strong>AXE</strong><br><small style="color:#aaa">Range: Melee<br>Special: Ground Slam</small>
            </div>
        </div>
        <button id="joinBtn" onclick="joinGame()">JOIN FIGHT</button>
    </div>

    <div id="gameUI">
        <div id="hud">
            <h2 id="scoreDisplay">Kills: 0</h2>
            <div style="font-weight:bold;">HEALTH</div>
            <div class="bar-container"><div id="healthBar" class="hp-bar"></div></div>
        </div>
    </div>

    <canvas id="gameCanvas"></canvas>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // --- YOUR RENDER URL ---
        const socket = io('https://8o2lymxge7.onrender.com');

        let myId = null;
        let players = {};
        let camera = { x: 0, y: 0 };
        let selectedWeapon = 'gun';
        const MAP_WIDTH = 2500;
        const MAP_HEIGHT = 1000;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        function selectWeapon(w, element) {
            selectedWeapon = w;
            document.querySelectorAll('.weapon-card').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
        }

        function joinGame() {
            if (!myId) {
                alert("Still connecting to server... wait 5 seconds.");
                return;
            }
            document.getElementById('menu').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            console.log("Requesting to join with ID:", myId);
            socket.emit('joinGame', selectedWeapon);
        }

        socket.on('connect', () => { 
            console.log("Connected with ID:", socket.id);
            myId = socket.id; 
        });
        
        socket.on('playerCount', (count) => {
            const el = document.getElementById('playerCount');
            if(el) el.innerText = "ONLINE: " + count;
        });

        // --- CONTROLS ---
        const keys = { w: false, a: false, s: false, d: false };
        let mouse = { x: 0, y: 0, angle: 0 };
        let myPos = { x: 100, y: 0, vx: 0, vy: 0, grounded: false };

        window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
        
        window.addEventListener('mousemove', e => {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            mouse.angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        });
        window.addEventListener('mousedown', () => socket.emit('attack', { type: 'primary', angle: mouse.angle }));

        let lastSpecial = 0;
        function checkSpecial() {
            if (keys.s && Date.now() - lastSpecial > 1500) { 
                socket.emit('attack', { type: 'special', angle: mouse.angle });
                lastSpecial = Date.now();
                if (selectedWeapon === 'axe' && !myPos.grounded) myPos.vy = 25; 
            }
        }

        const platforms = [
            { x: 0, y: MAP_HEIGHT - 50, w: MAP_WIDTH, h: 50 },
            { x: 200, y: 700, w: 300, h: 20 },
            { x: 600, y: 550, w: 200, h: 20 },
            { x: 1000, y: 750, w: 500, h: 20 },
            { x: 1100, y: 450, w: 300, h: 20 },
            { x: 1600, y: 600, w: 200, h: 20 },
            { x: 2000, y: 500, w: 400, h: 20 }
        ];

        function updatePhysics() {
            myPos.vx = 0;
            if (keys.a) myPos.vx = -9;
            if (keys.d) myPos.vx = 9;
            if (keys.w && myPos.grounded) { myPos.vy = -18; myPos.grounded = false; }
            checkSpecial();
            myPos.vy += 0.8;
            myPos.x += myPos.vx;
            myPos.y += myPos.vy;
            if (myPos.x < 0) myPos.x = 0;
            if (myPos.x > MAP_WIDTH) myPos.x = MAP_WIDTH;

            myPos.grounded = false;
            for (let p of platforms) {
                if (myPos.vy >= 0 && myPos.x + 20 > p.x && myPos.x - 20 < p.x + p.w && myPos.y + 20 > p.y && myPos.y + 20 < p.y + p.h + 20) {
                    myPos.y = p.y - 20; myPos.vy = 0; myPos.grounded = true;
                }
            }

            socket.emit('playerMovement', { x: myPos.x, y: myPos.y, facing: (mouse.angle > -1.5 && mouse.angle < 1.5) ? 1 : -1, angle: mouse.angle });
            camera.x = myPos.x - canvas.width / 2;
            camera.y = myPos.y - canvas.height / 2;
            if (camera.x < 0) camera.x = 0; if (camera.y < 0) camera.y = 0;
            if (camera.x > MAP_WIDTH - canvas.width) camera.x = MAP_WIDTH - canvas.width;
            if (camera.y > MAP_HEIGHT - canvas.height) camera.y = MAP_HEIGHT - canvas.height;
        }

        let fx = []; 
        function draw() {
            if (myId && players[myId] && players[myId].isPlaying) updatePhysics();
            
            ctx.fillStyle = "#222";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(-camera.x, -camera.y);

            // Draw Platforms
            ctx.fillStyle = "#666";
            for (let p of platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

            // Draw Players
            for (let id in players) {
                const p = players[id];
                if (!p.isPlaying) continue;

                let x = (id === myId) ? myPos.x : p.x;
                let y = (id === myId) ? myPos.y : p.y;
                let ang = (id === myId) ? mouse.angle : p.angle;

                ctx.fillStyle = p.color;
                ctx.fillRect(x - 20, y - 20, 40, 40);

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(ang);
                if (p.weapon === 'gun') { ctx.fillStyle = "#bbb"; ctx.fillRect(15, -4, 35, 8); }
                else if (p.weapon === 'shotgun') { ctx.fillStyle = "#666"; ctx.fillRect(15, -8, 25, 16); }
                else if (p.weapon === 'axe') { ctx.fillStyle = "#8B4513"; ctx.fillRect(10, -5, 40, 10); ctx.fillStyle = "silver"; ctx.fillRect(40, -15, 10, 30); }
                ctx.restore();

                if (id !== myId) {
                    ctx.fillStyle = "red"; ctx.fillRect(x - 20, y - 35, 40, 5);
                    ctx.fillStyle = "#0f0"; ctx.fillRect(x - 20, y - 35, 40 * (p.health / 100), 5);
                }
            }

            // FX
            ctx.lineWidth = 2;
            for (let i = 0; i < fx.length; i++) {
                let f = fx[i];
                ctx.strokeStyle = (f.type === 'special') ? "red" : "yellow";
                ctx.beginPath();
                ctx.moveTo(f.x, f.y);
                let len = (f.weapon === 'shotgun') ? 100 : 800; if (f.weapon === 'axe') len = 80;
                ctx.lineTo(f.x + Math.cos(f.angle) * len, f.y + Math.sin(f.angle) * len);
                ctx.stroke();
                f.life--;
            }
            fx = fx.filter(f => f.life > 0);
            ctx.restore(); 
            requestAnimationFrame(draw);
        }

        socket.on('updatePlayers', (p) => { players = p; });
        socket.on('playerMoved', (p) => { if(players[p.id]) Object.assign(players[p.id], p); });
        socket.on('updateHealth', (data) => { if (players[data.id]) { players[data.id].health = data.health; if (data.id === myId) document.getElementById('healthBar').style.width = data.health + "%"; }});
        socket.on('attackAnim', (data) => { if (players[data.id]) { let p = players[data.id]; let x = (data.id === myId) ? myPos.x : p.x; let y = (data.id === myId) ? myPos.y : p.y; fx.push({ x: x, y: y, angle: data.angle, life: 5, weapon: data.weapon, type: data.type }); }});
        socket.on('scoreUpdate', (data) => { if (players[data.id]) players[data.id].score = data.score; if (data.id === myId) document.getElementById('scoreDisplay').innerText = "Kills: " + data.score; });
        socket.on('respawn', (p) => { if (players[p.id]) { Object.assign(players[p.id], p); if (p.id === myId) { myPos.x = p.x; myPos.y = p.y; document.getElementById('healthBar').style.width = "100%"; }}});
        socket.on('disconnectUser', (id) => delete players[id]);
        requestAnimationFrame(draw);
    </script>
</body>
</html>
