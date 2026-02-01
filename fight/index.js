// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let socket;
let myId;
let players = {};
let keys = {};
let myPlayer = null;

// Physics constants
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const MOVE_SPEED = 5;
const GROUND_Y = 450;

// UI elements
const menu = document.getElementById('menu');
const joinButton = document.getElementById('joinButton');
const playerNameInput = document.getElementById('playerName');
const serverUrlInput = document.getElementById('serverUrl');
const healthBarsContainer = document.getElementById('healthBars');
const messageDiv = document.getElementById('message');

// Join game
joinButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim() || 'Player';
    const serverUrl = serverUrlInput.value.trim() || 'http://localhost:3000';
    
    connectToServer(serverUrl, playerName);
});

// Allow enter key to join
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
});

serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
});

function connectToServer(serverUrl, playerName) {
    socket = io(serverUrl);

    socket.on('connect', () => {
        console.log('Connected to server');
        myId = socket.id;
        socket.emit('joinGame', { name: playerName });
        menu.style.display = 'none';
    });

    socket.on('currentPlayers', (serverPlayers) => {
        players = serverPlayers;
        myPlayer = players[myId];
        updateHealthBars();
    });

    socket.on('newPlayer', (player) => {
        players[player.id] = player;
        updateHealthBars();
    });

    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].velocityY = data.velocityY;
            players[data.id].facing = data.facing;
        }
    });

    socket.on('playerAttacked', (data) => {
        if (players[data.id]) {
            players[data.id].isAttacking = true;
            
            setTimeout(() => {
                if (players[data.id]) {
                    players[data.id].isAttacking = false;
                }
            }, 300);

            // Check if attack hit me
            if (myPlayer && data.id !== myId) {
                const distance = Math.abs(myPlayer.x - data.x);
                const verticalDistance = Math.abs(myPlayer.y - data.y);
                
                if (distance < 80 && verticalDistance < 100) {
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
        if (data.winnerId === myId) {
            showMessage('YOU WIN! 🏆');
        } else if (data.defeatedId === myId) {
            showMessage('YOU LOSE! 💀');
        } else {
            showMessage(`${players[data.defeatedId]?.name || 'Player'} was defeated!`);
        }

        setTimeout(() => {
            if (players[data.defeatedId]) {
                players[data.defeatedId].health = 100;
                players[data.defeatedId].x = Math.random() * 700 + 50;
                players[data.defeatedId].y = GROUND_Y;
                updateHealthBars();
                hideMessage();
            }
        }, 3000);
    });

    socket.on('playerDisconnected', (playerId) => {
        delete players[playerId];
        updateHealthBars();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showMessage('Disconnected from server');
        menu.style.display = 'block';
    });
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
        
        healthBar.innerHTML = `
            <div class="player-name">${player.name}${id === myId ? ' (You)' : ''}</div>
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
    
    if (e.key === ' ' && myPlayer) {
        e.preventDefault();
        socket.emit('playerAttack');
        myPlayer.isAttacking = true;
        setTimeout(() => {
            if (myPlayer) myPlayer.isAttacking = false;
        }, 300);
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

    // Arms
    ctx.strokeStyle = isMe ? '#e94560' : '#4a90e2';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    if (player.isAttacking) {
        // Attacking pose
        if (player.facing === 'right') {
            ctx.beginPath();
            ctx.moveTo(x + 20, y - 40);
            ctx.lineTo(x + 50, y - 30);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x - 20, y - 40);
            ctx.lineTo(x - 50, y - 30);
            ctx.stroke();
        }
        
        // Attack effect
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        const punchX = player.facing === 'right' ? x + 50 : x - 50;
        ctx.beginPath();
        ctx.arc(punchX, y - 30, 15, 0, Math.PI * 2);
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
