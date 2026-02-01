// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Server URL - connects to your Render deployment
const SERVER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://8o2lymxge7.onrender.com';

// Game state
let socket;
let myId;
let players = {};
let keys = {};
let myPlayer = null;
let currentWeapon = 0;

// Weapons
const weapons = [
  { name: 'Sword', damage: 15, range: 80, cooldown: 400, emoji: '⚔️' },
  { name: 'Axe', damage: 25, range: 70, cooldown: 600, emoji: '🪓' },
  { name: 'Spear', damage: 12, range: 120, cooldown: 350, emoji: '🔱' },
  { name: 'Hammer', damage: 30, range: 60, cooldown: 800, emoji: '🔨' }
];

// Physics constants
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const MOVE_SPEED = 5;
const GROUND_Y = 450;

// UI elements
const menu = document.getElementById('menu');
const joinButton = document.getElementById('joinButton');
const playerNameInput = document.getElementById('playerName');
const healthBarsContainer = document.getElementById('healthBars');
const messageDiv = document.getElementById('message');
const weaponSelector = document.getElementById('weaponSelector');
const playerCountEl = document.getElementById('playerCount');
const scoreListEl = document.getElementById('scoreList');

// Weapon buttons
const weaponButtons = document.querySelectorAll('.weapon-button');
weaponButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const weaponIndex = parseInt(btn.dataset.weapon);
        switchWeapon(weaponIndex);
    });
});

// Join game
joinButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim() || 'Player';
    connectToServer(playerName);
});

// Allow enter key to join
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
});

function connectToServer(playerName) {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log('Connected to server');
        myId = socket.id;
        socket.emit('joinGame', { name: playerName });
        menu.style.display = 'none';
        weaponSelector.style.display = 'block';
    });

    socket.on('currentPlayers', (serverPlayers) => {
        players = serverPlayers;
        myPlayer = players[myId];
        if (myPlayer) {
            currentWeapon = 0;
            myPlayer.weapon = weapons[0];
        }
        updateHealthBars();
        updateScoreboard();
        updatePlayerCount();
    });

    socket.on('newPlayer', (player) => {
        players[player.id] = player;
        updateHealthBars();
        updateScoreboard();
        updatePlayerCount();
    });

    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].velocityY = data.velocityY;
            players[data.id].facing = data.facing;
        }
    });

    socket.on('weaponSwitched', (data) => {
        if (players[data.id]) {
            players[data.id].weapon = data.weapon;
        }
    });

    socket.on('playerAttacked', (data) => {
        if (players[data.id]) {
            players[data.id].isAttacking = true;
            players[data.id].weapon = data.weapon;
            
            setTimeout(() => {
                if (players[data.id]) {
                    players[data.id].isAttacking = false;
                }
            }, data.weapon.cooldown);

            // Check if attack hit me
            if (myPlayer && data.id !== myId) {
                const distance = Math.abs(myPlayer.x - data.x);
                const verticalDistance = Math.abs(myPlayer.y - data.y);
                
                if (distance < data.weapon.range && verticalDistance < 100) {
                    const attackerFacing = data.facing;
                    const imOnRight = myPlayer.x > data.x;
                    
                    if ((attackerFacing === 'right' && imOnRight) || 
                        (attackerFacing === 'left' && !imOnRight)) {
                        socket.emit('playerHit', { targetId: myId });
                    }
                }
            }
        }
    });

    socket.on('healthUpdate', (data) => {
        if (players[data.id]) {
            players[data.id].health = data.health;
            updateHealthBars();
        }
    });

    socket.on('playerDefeated', (data) => {
        if (players[data.winnerId]) {
            players[data.winnerId].kills = data.kills;
        }

        if (data.winnerId === myId) {
            showMessage('KILL! 🎯 Total: ' + data.kills);
        } else if (data.defeatedId === myId) {
            showMessage('DEFEATED! 💀');
        } else {
            showMessage(`${data.killerName} eliminated ${players[data.defeatedId]?.name || 'player'}!`);
        }

        setTimeout(() => {
            if (players[data.defeatedId]) {
                players[data.defeatedId].health = 100;
                players[data.defeatedId].x = Math.random() * 700 + 50;
                players[data.defeatedId].y = GROUND_Y;
                updateHealthBars();
                updateScoreboard();
                hideMessage();
            }
        }, 2000);
    });

    socket.on('playerDisconnected', (playerId) => {
        delete players[playerId];
        updateHealthBars();
        updateScoreboard();
        updatePlayerCount();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showMessage('Disconnected from server');
        menu.style.display = 'block';
        weaponSelector.style.display = 'none';
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showMessage('Cannot connect to server. Check console.');
    });
}

function switchWeapon(index) {
    if (weapons[index] && myPlayer) {
        currentWeapon = index;
        myPlayer.weapon = weapons[index];
        socket.emit('switchWeapon', index);
        
        // Update button states
        weaponButtons.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

function updatePlayerCount() {
    const count = Object.keys(players).length;
    playerCountEl.textContent = count;
}

function updateScoreboard() {
    const sortedPlayers = Object.values(players)
        .sort((a, b) => (b.kills || 0) - (a.kills || 0))
        .slice(0, 5);
    
    scoreListEl.innerHTML = sortedPlayers
        .map(p => `<div class="score-item">${p.name}: ${p.kills || 0}</div>`)
        .join('');
}

function showMessage(text) {
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
}

function hideMessage() {
    messageDiv.style.display = 'none';
}

function updateHealthBars() {
    healthBarsContainer.innerHTML = '';
    
    for (let id in players) {
        const player = players[id];
        const healthBar = document.createElement('div');
        healthBar.className = 'health-bar';
        healthBar.style.marginRight = '20px';
        
        const healthPercent = Math.max(0, player.health);
        const weaponInfo = player.weapon ? ` ${player.weapon.emoji}` : '';
        
        healthBar.innerHTML = `
            <div class="player-name">${player.name}${id === myId ? ' (You)' : ''}${weaponInfo}</div>
            <div style="width: 200px; background: rgba(255,255,255,0.2); border-radius: 5px; overflow: hidden;">
                <div class="health-fill" style="width: ${healthPercent}%"></div>
            </div>
        `;
        
        healthBarsContainer.appendChild(healthBar);
    }
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Weapon switching with number keys
    if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const weaponIndex = parseInt(e.key) - 1;
        switchWeapon(weaponIndex);
    }
    
    if (e.key === ' ' && myPlayer) {
        e.preventDefault();
        socket.emit('playerAttack');
        myPlayer.isAttacking = true;
        setTimeout(() => {
            if (myPlayer) myPlayer.isAttacking = false;
        }, myPlayer.weapon.cooldown);
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Game loop
function gameLoop() {
    // Update my player
    if (myPlayer) {
        // Horizontal movement
        if (keys['ArrowLeft']) {
            myPlayer.x -= MOVE_SPEED;
            myPlayer.facing = 'left';
        }
        if (keys['ArrowRight']) {
            myPlayer.x += MOVE_SPEED;
            myPlayer.facing = 'right';
        }

        // Keep player in bounds
        myPlayer.x = Math.max(30, Math.min(canvas.width - 30, myPlayer.x));

        // Jumping
        if (keys['ArrowUp'] && myPlayer.y >= GROUND_Y - 1) {
            myPlayer.velocityY = JUMP_STRENGTH;
        }

        // Apply gravity
        myPlayer.velocityY += GRAVITY;
        myPlayer.y += myPlayer.velocityY;

        // Ground collision
        if (myPlayer.y >= GROUND_Y) {
            myPlayer.y = GROUND_Y;
            myPlayer.velocityY = 0;
        }

        // Send position update
        socket.emit('playerMovement', {
            x: myPlayer.x,
            y: myPlayer.y,
            velocityY: myPlayer.velocityY,
            facing: myPlayer.facing
        });
    }

    // Render
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
    skyGradient.addColorStop(0, '#87ceeb');
    skyGradient.addColorStop(1, '#e0f6ff');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

    // Draw ground
    const groundGradient = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
    groundGradient.addColorStop(0, '#8b7355');
    groundGradient.addColorStop(1, '#654321');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // Draw ground line
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 50);
    ctx.lineTo(canvas.width, GROUND_Y + 50);
    ctx.stroke();

    // Draw all players
    for (let id in players) {
        const player = players[id];
        drawPlayer(player, id === myId);
    }
}

function drawPlayer(player, isMe) {
    const x = player.x;
    const y = player.y;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 50, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = isMe ? '#e94560' : '#4a90e2';
    ctx.fillRect(x - 20, y - 60, 40, 60);

    // Head
    ctx.fillStyle = isMe ? '#ff6b6b' : '#5da3eb';
    ctx.beginPath();
    ctx.arc(x, y - 75, 25, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    if (player.facing === 'right') {
        ctx.fillRect(x + 5, y - 80, 8, 8);
    } else {
        ctx.fillRect(x - 13, y - 80, 8, 8);
    }

    // Weapon and arms
    ctx.strokeStyle = isMe ? '#e94560' : '#4a90e2';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    const weapon = player.weapon || weapons[0];

    if (player.isAttacking) {
        // Attacking pose with weapon
        if (player.facing === 'right') {
            ctx.beginPath();
            ctx.moveTo(x + 20, y - 40);
            ctx.lineTo(x + 50 + (weapon.range - 80) / 2, y - 30);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x - 20, y - 40);
            ctx.lineTo(x - 50 - (weapon.range - 80) / 2, y - 30);
            ctx.stroke();
        }
        
        // Weapon emoji
        ctx.font = '30px Arial';
        const weaponX = player.facing === 'right' ? x + 50 + (weapon.range - 80) / 2 : x - 50 - (weapon.range - 80) / 2;
        ctx.fillText(weapon.emoji, weaponX - 15, y - 20);
        
        // Attack effect
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        const effectX = player.facing === 'right' ? x + weapon.range : x - weapon.range;
        ctx.beginPath();
        ctx.arc(effectX, y - 30, 20, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Normal arms
        ctx.beginPath();
        ctx.moveTo(x - 20, y - 40);
        ctx.lineTo(x - 30, y - 20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 20, y - 40);
        ctx.lineTo(x + 30, y - 20);
        ctx.stroke();
        
        // Show weapon in hand
        ctx.font = '20px Arial';
        const handX = player.facing === 'right' ? x + 30 : x - 30;
        ctx.fillText(weapon.emoji, handX - 10, y - 15);
    }

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 15, y + 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 15, y + 30);
    ctx.stroke();

    // Name tag
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 40, y - 110, 80, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, x, y - 96);
}

// Start game loop
gameLoop();
