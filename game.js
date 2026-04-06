const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highscoreElement = document.getElementById('highscore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');
const statusMessage = document.getElementById('statusMessage');
const gameContainer = document.querySelector('.game-container');
const gameOverTitle = document.getElementById('gameOverTitle');
const highscoreEntryUI = document.getElementById('highscoreEntry');
const restartText = document.getElementById('restartText');

// Audio Engine Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let noiseBuffer;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        
        // Generate noise buffer for explosion
        const bufferSize = audioCtx.sampleRate * 2.0; 
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // Create master gain
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    switch(type) {
        case 'menu':
            const menuOsc = audioCtx.createOscillator();
            menuOsc.type = 'sine';
            menuOsc.frequency.setValueAtTime(800, now);
            menuOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            masterGain.gain.setValueAtTime(0.1, now);
            masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            menuOsc.connect(masterGain);
            menuOsc.start(now);
            menuOsc.stop(now + 0.05);
            break;

        case 'eat':
            // Layer 1: Triangle for body
            const osc1 = audioCtx.createOscillator();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(400, now);
            osc1.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            
            // Layer 2: Sine for punch
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(600, now);
            osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.08);

            masterGain.gain.setValueAtTime(0.15, now);
            masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            
            osc1.connect(masterGain);
            osc2.connect(masterGain);
            osc1.start(now); osc1.stop(now + 0.1);
            osc2.start(now); osc2.stop(now + 0.08);
            break;

        case 'special': // Arpeggio for coin
            const arpOsc = audioCtx.createOscillator();
            arpOsc.type = 'square';
            
            arpOsc.frequency.setValueAtTime(987.77, now); // B5
            arpOsc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
            
            masterGain.gain.setValueAtTime(0.1, now);
            masterGain.gain.setValueAtTime(0.1, now + 0.08);
            masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
            
            arpOsc.connect(masterGain);
            arpOsc.start(now);
            arpOsc.stop(now + 0.3);
            break;

        case 'poison': // Descending Sawtooth
            const pOsc = audioCtx.createOscillator();
            pOsc.type = 'sawtooth';
            pOsc.frequency.setValueAtTime(300, now);
            pOsc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
            masterGain.gain.setValueAtTime(0.2, now);
            masterGain.gain.linearRampToValueAtTime(0, now + 0.4);
            pOsc.connect(masterGain);
            pOsc.start(now);
            pOsc.stop(now + 0.4);
            break;

        case 'die': // Retro Explosion
            const noiseSrc = audioCtx.createBufferSource();
            noiseSrc.buffer = noiseBuffer;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(1000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            
            masterGain.gain.setValueAtTime(0.3, now);
            masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            noiseSrc.connect(noiseFilter);
            noiseFilter.connect(masterGain);
            noiseSrc.start(now);
            break;

        case 'win': // Fanfare
            const winOsc = audioCtx.createOscillator();
            winOsc.type = 'square';
            
            // C4, E4, G4, C5
            const notes = [261.63, 329.63, 392.00, 523.25];
            let t = now;
            notes.forEach(freq => {
                winOsc.frequency.setValueAtTime(freq, t);
                t += 0.15;
            });
            winOsc.frequency.setValueAtTime(523.25, t); // Hold last note
            
            masterGain.gain.setValueAtTime(0.15, now);
            masterGain.gain.setValueAtTime(0.15, t);
            masterGain.gain.linearRampToValueAtTime(0, t + 0.5);
            
            winOsc.connect(masterGain);
            winOsc.start(now);
            winOsc.stop(t + 0.5);
            break;
            
        case 'godmode':
            const gOsc = audioCtx.createOscillator();
            gOsc.type = 'sine';
            gOsc.frequency.setValueAtTime(440, now);
            gOsc.frequency.setValueAtTime(554, now + 0.1);
            gOsc.frequency.setValueAtTime(659, now + 0.2);
            gOsc.frequency.setValueAtTime(880, now + 0.3);
            masterGain.gain.setValueAtTime(0.15, now);
            masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
            gOsc.connect(masterGain);
            gOsc.start(now);
            gOsc.stop(now + 0.6);
            break;
    }
}

class SnakeGame {
    constructor() {
        this.GRID_SIZE = 20;
        this.TILE_COUNT = canvas.width / this.GRID_SIZE;
        
        this.difficulties = ['easy', 'normal', 'hard'];
        this.speeds = { easy: 150, normal: 100, hard: 60 };
        this.diffIndex = 1; // default normal
        
        this.resetState();
        
        // Highscore Input State
        this.isHighscoreEntry = false;
        this.hsLetters = ['A', 'A', 'A'];
        this.hsIndex = 0;
        this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?";
        
        this.updateDiffUI();
        
        this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.konamiIndex = 0;
        
        this.funnyWinTexts = [
            "DU BIST EIN SCHLANGEN-GOTT!",
            "PYTHON WÄRE STOLZ AUF DICH!",
            "PLATZANGST? ALLES AUSGEFÜLLT!",
            "MAXIMALER DURCHMESSER ERREICHT!",
            "ES GIBT KEINEN APFEL MEHR.",
            "DISPLAY ZU KLEIN FÜR DICH!"
        ];
        
        this.bindEvents();
        this.draw(); 
    }
    
    get currentDifficulty() {
        return this.difficulties[this.diffIndex];
    }
    
    get baseSpeed() {
        return this.speeds[this.currentDifficulty];
    }
    
    updateDiffUI() {
        document.querySelectorAll('.diff-option').forEach(el => el.classList.remove('active-diff'));
        document.getElementById(`diff-${this.currentDifficulty}`).classList.add('active-diff');
        this.loadHighscore();
        this.currentSpeed = this.baseSpeed;
    }
    
    loadHighscore() {
        const hsData = localStorage.getItem(`snakeHighscore_${this.currentDifficulty}`);
        if (hsData) {
            const data = JSON.parse(hsData);
            this.highscore = data.score;
            this.highscoreHolder = data.name;
        } else {
            this.highscore = 0;
            this.highscoreHolder = '---';
        }
        highscoreElement.innerText = `${this.highscore} (${this.highscoreHolder})`;
    }
    
    saveHighscore(name) {
        localStorage.setItem(`snakeHighscore_${this.currentDifficulty}`, JSON.stringify({ score: this.score, name: name }));
        this.loadHighscore();
    }
    
    resetState() {
        this.snake = [
            {x: 10, y: 10},
            {x: 9, y: 10},
            {x: 8, y: 10}
        ];
        this.dx = 1;
        this.dy = 0;
        this.inputQueue = [];
        this.score = 0;
        this.currentSpeed = this.baseSpeed;
        this.isGameOver = false;
        this.isGameRunning = false;
        this.isGameWon = false;
        
        this.godMode = false;
        this.poisonMode = false;
        clearTimeout(this.poisonTimer);
        clearTimeout(this.speedTimer);
        this.poisonTimer = null;
        this.speedTimer = null;
        
        scoreElement.innerText = this.score;
        gameContainer.classList.remove('god-mode');
        
        this.lastTime = performance.now();
        this.timeAccumulator = 0;
    }

    bindEvents() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(e) {
        initAudio(); // Initialize on any keypress
        
        const key = e.key.toLowerCase();
        let mappedUp = (key === 'arrowup' || key === 'w');
        let mappedDown = (key === 'arrowdown' || key === 's');
        let mappedLeft = (key === 'arrowleft' || key === 'a');
        let mappedRight = (key === 'arrowright' || key === 'd');
        
        // Highscore Entry Mode (Arcade Input)
        if (this.isHighscoreEntry) {
            if (mappedLeft) {
                this.hsIndex = (this.hsIndex - 1 + 3) % 3;
                playSound('menu');
                this.updateHSUI();
            } else if (mappedRight) {
                this.hsIndex = (this.hsIndex + 1) % 3;
                playSound('menu');
                this.updateHSUI();
            } else if (mappedUp) {
                const char = this.hsLetters[this.hsIndex];
                let idx = this.alphabet.indexOf(char);
                idx = (idx - 1 + this.alphabet.length) % this.alphabet.length;
                this.hsLetters[this.hsIndex] = this.alphabet[idx];
                playSound('menu');
                this.updateHSUI();
            } else if (mappedDown) {
                const char = this.hsLetters[this.hsIndex];
                let idx = this.alphabet.indexOf(char);
                idx = (idx + 1) % this.alphabet.length;
                this.hsLetters[this.hsIndex] = this.alphabet[idx];
                playSound('menu');
                this.updateHSUI();
            } else if (key === ' ' || key === 'enter') {
                playSound('special');
                this.saveHighscore(this.hsLetters.join(''));
                this.isHighscoreEntry = false;
                
                // Switch back UI
                highscoreEntryUI.style.display = 'none';
                restartText.innerText = "PRESS SPACE TO RESTART";
            }
            e.preventDefault();
            return;
        }
        
        // Settings Mode (Start Screen)
        if (!this.isGameRunning && !this.isGameOver && !this.isGameWon) {
            if (mappedLeft) {
                this.diffIndex = (this.diffIndex - 1 + 3) % 3;
                playSound('menu');
                this.updateDiffUI();
                e.preventDefault();
                return;
            } else if (mappedRight) {
                this.diffIndex = (this.diffIndex + 1) % 3;
                playSound('menu');
                this.updateDiffUI();
                e.preventDefault();
                return;
            }
        }
        
        // Normal Start / Restart
        if (key === ' ' || key === 'spacebar') {
            if (!this.isGameRunning) {
                this.startGame();
            }
            e.preventDefault();
            return;
        }

        if (!this.isGameRunning) return;

        // In-Game Logic
        if (this.poisonMode) {
            let tempUp = mappedUp;
            let tempDown = mappedDown;
            let tempLeft = mappedLeft;
            let tempRight = mappedRight;
            mappedUp = tempDown; mappedDown = tempUp;
            mappedLeft = tempRight; mappedRight = tempLeft;
        }

        let lastDx = this.dx;
        let lastDy = this.dy;
        if (this.inputQueue.length > 0) {
            const lastInput = this.inputQueue[this.inputQueue.length - 1];
            lastDx = lastInput.dx;
            lastDy = lastInput.dy;
        }

        if (this.inputQueue.length < 3) {
            if (mappedUp && lastDy === 0) {
                this.inputQueue.push({dx: 0, dy: -1}); e.preventDefault();
            } else if (mappedDown && lastDy === 0) {
                this.inputQueue.push({dx: 0, dy: 1}); e.preventDefault();
            } else if (mappedLeft && lastDx === 0) {
                this.inputQueue.push({dx: -1, dy: 0}); e.preventDefault();
            } else if (mappedRight && lastDx === 0) {
                this.inputQueue.push({dx: 1, dy: 0}); e.preventDefault();
            }
        }
        
        // Konami logic
        if (key === this.konamiCode[this.konamiIndex].toLowerCase() || e.key === this.konamiCode[this.konamiIndex]) {
            this.konamiIndex++;
            if (this.konamiIndex === this.konamiCode.length) {
                this.activateGodMode();
                this.konamiIndex = 0;
            }
        } else {
            this.konamiIndex = 0;
        }
    }

    updateHSUI() {
        for (let i=0; i<3; i++) {
            const el = document.getElementById(`letter-${i}`);
            el.innerText = this.hsLetters[i];
            if (i === this.hsIndex) {
                el.classList.add('active-letter');
            } else {
                el.classList.remove('active-letter');
            }
        }
    }

    activateGodMode() {
        if (!this.godMode) {
            this.godMode = true;
            playSound('godmode');
            this.showStatusMessage("GOD MODE ACTIVATED");
            gameContainer.classList.add('god-mode');
        }
    }

    showStatusMessage(text) {
        statusMessage.innerText = text;
        statusMessage.classList.add('show');
        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 2000);
    }

    startGame() {
        this.resetState();
        startScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
        this.isGameRunning = true;
        this.spawnFood();
        
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    gameLoop(timestamp) {
        if (!this.isGameRunning || this.isGameOver || this.isGameWon) return;

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.timeAccumulator += deltaTime;

        while (this.timeAccumulator >= this.currentSpeed) {
            this.update();
            this.timeAccumulator -= this.currentSpeed; 
            if (this.isGameOver || this.isGameWon) break;
        }

        this.draw(); 
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    spawnFood() {
        if (this.snake.length >= this.TILE_COUNT * this.TILE_COUNT) {
            this.gameWon();
            return;
        }

        let newFoodPos;
        let isOccupied = true;
        while(isOccupied) {
            newFoodPos = {
                x: Math.floor(Math.random() * this.TILE_COUNT),
                y: Math.floor(Math.random() * this.TILE_COUNT)
            };
            isOccupied = this.snake.some(segment => segment.x === newFoodPos.x && segment.y === newFoodPos.y);
        }
        
        this.food = newFoodPos;
        let rand = Math.random();
        if (rand < 0.1) {
            this.food.type = 'gold';
        } else if (rand < 0.2) {
            this.food.type = 'glitch';
        } else {
            this.food.type = 'normal';
        }
    }

    update() {
        if (this.isGameOver || this.isGameWon) return;

        if (this.inputQueue.length > 0) {
            const nextInput = this.inputQueue.shift();
            this.dx = nextInput.dx;
            this.dy = nextInput.dy;
        }

        let headX = this.snake[0].x + this.dx;
        let headY = this.snake[0].y + this.dy;

        // Borders
        if (headX < 0 || headX >= this.TILE_COUNT || headY < 0 || headY >= this.TILE_COUNT) {
            if (this.godMode) {
                if (headX < 0) headX = this.TILE_COUNT - 1;
                if (headX >= this.TILE_COUNT) headX = 0;
                if (headY < 0) headY = this.TILE_COUNT - 1;
                if (headY >= this.TILE_COUNT) headY = 0;
            } else {
                this.triggerEndGame(false);
                return;
            }
        }

        // Self-collision
        if (!this.godMode && this.snake.some(segment => segment.x === headX && segment.y === headY)) {
            this.triggerEndGame(false);
            return;
        }

        const newHead = {x: headX, y: headY};
        this.snake.unshift(newHead);

        if (this.food && headX === this.food.x && headY === this.food.y) {
            this.handleFoodConsumption();
            this.spawnFood();
        } else {
            this.snake.pop(); 
        }
    }

    handleFoodConsumption() {
        if (this.food.type === 'normal') {
            this.score += 10;
            playSound('eat');
        } else if (this.food.type === 'gold') {
            this.score += 50;
            playSound('special');
            this.showStatusMessage("SPEED BOOST!");
            this.currentSpeed = Math.max(50, this.baseSpeed - 40);
            clearTimeout(this.speedTimer);
            this.speedTimer = setTimeout(() => {
                this.currentSpeed = this.baseSpeed;
            }, 5000);
        } else if (this.food.type === 'glitch') {
            this.score += 20;
            playSound('poison');
            this.showStatusMessage("GLITCH: INVERTED CONTROLS!");
            this.poisonMode = true;
            clearTimeout(this.poisonTimer);
            this.poisonTimer = setTimeout(() => {
                this.poisonMode = false;
                this.showStatusMessage("CONTROLS RESTORED");
                playSound('menu');
            }, 5000);
        }
        scoreElement.innerText = this.score;
    }
    
    shakeScreen() {
        gameContainer.classList.add('shake');
        setTimeout(() => {
            gameContainer.classList.remove('shake');
        }, 400); 
    }

    gameWon() {
        this.triggerEndGame(true);
    }

    triggerEndGame(isWin) {
        this.isGameRunning = false;
        
        if (isWin) {
            this.isGameWon = true;
            playSound('win');
            const randomWinText = this.funnyWinTexts[Math.floor(Math.random() * this.funnyWinTexts.length)];
            gameOverTitle.innerText = randomWinText;
            gameOverTitle.style.color = "#00f5d4"; 
        } else {
            this.isGameOver = true;
            playSound('die');
            this.shakeScreen();
            gameOverTitle.innerText = "GAME OVER";
            gameOverTitle.style.color = "#f15bb5"; 
        }
        
        finalScoreElement.innerText = this.score;
        this.draw(); 
        gameOverScreen.classList.add('active');
        
        // Handle Highscore
        if (this.score > this.highscore && this.score > 0) {
            this.isHighscoreEntry = true;
            this.hsIndex = 0;
            this.hsLetters = ['A', 'A', 'A'];
            this.updateHSUI();
            
            highscoreEntryUI.style.display = 'block';
            restartText.innerText = "USE ARROWS TO EDIT -> PRESS SPACE TO SUBMIT";
        } else {
            highscoreEntryUI.style.display = 'none';
            restartText.innerText = "PRESS SPACE TO RESTART";
        }
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const time = performance.now();

        if (this.food) {
            const centerX = this.food.x * this.GRID_SIZE + this.GRID_SIZE / 2;
            const centerY = this.food.y * this.GRID_SIZE + this.GRID_SIZE / 2;
            
            if (this.food.type === 'normal') {
                const pulse = Math.sin(time / 150) * 2;
                ctx.fillStyle = '#f15bb5';
                ctx.shadowColor = '#f15bb5';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(centerX, centerY, Math.max(1, (this.GRID_SIZE / 2 - 3) + pulse), 0, Math.PI * 2);
                ctx.fill();
            } else if (this.food.type === 'gold') {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(time / 200);
                ctx.fillStyle = '#fee440';
                ctx.shadowColor = '#fee440';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.moveTo(0, -this.GRID_SIZE/2 + 2);
                ctx.lineTo(this.GRID_SIZE/2 - 2, 0);
                ctx.lineTo(0, this.GRID_SIZE/2 - 2);
                ctx.lineTo(-this.GRID_SIZE/2 + 2, 0);
                ctx.fill();
                ctx.restore();
            } else if (this.food.type === 'glitch') {
                ctx.fillStyle = '#00f5d4';
                ctx.shadowColor = '#00f5d4';
                
                if (Math.random() > 0.3) {
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    for(let i=0; i<5; i++) {
                        const rRadius = (Math.random() * this.GRID_SIZE/2);
                        const angle = (Math.PI * 2 / 5) * i;
                        const px = centerX + Math.cos(angle) * rRadius;
                        const py = centerY + Math.sin(angle) * rRadius;
                        if(i===0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.fill();
                } else {
                    ctx.shadowBlur = 0;
                    ctx.fillRect(this.food.x * this.GRID_SIZE + 2, this.food.y * this.GRID_SIZE + 2, this.GRID_SIZE - 4, this.GRID_SIZE - 4);
                }
            }
            ctx.shadowBlur = 0; 
        }

        this.snake.forEach((segment, index) => {
            const x = segment.x * this.GRID_SIZE;
            const y = segment.y * this.GRID_SIZE;
            
            if (this.godMode || this.isGameWon) {
                ctx.fillStyle = index === 0 ? '#ffffff' : '#dddddd';
                ctx.shadowColor = '#ffffff';
            } else {
                ctx.fillStyle = index === 0 ? '#00f5d4' : '#04a08b'; 
                ctx.shadowColor = '#00f5d4';
                if (this.poisonMode && Math.random() < 0.1) {
                    ctx.fillStyle = '#f15bb5';
                    ctx.shadowColor = '#f15bb5';
                }
            }
            
            ctx.shadowBlur = index === 0 ? 15 : 5; 
            ctx.fillRect(x + 1, y + 1, this.GRID_SIZE - 2, this.GRID_SIZE - 2);

            if (index === 0 && !this.isGameOver) {
                ctx.fillStyle = '#0d0221'; 
                ctx.shadowBlur = 0;
                
                let eye1X, eye1Y, eye2X, eye2Y;
                const eyeOffset = 4;
                const eyeSize = 3;
                
                if (this.dx === 1) { 
                    eye1X = x + this.GRID_SIZE - 7; eye1Y = y + eyeOffset;
                    eye2X = x + this.GRID_SIZE - 7; eye2Y = y + this.GRID_SIZE - eyeOffset - eyeSize;
                } else if (this.dx === -1) { 
                    eye1X = x + 4; eye1Y = y + eyeOffset;
                    eye2X = x + 4; eye2Y = y + this.GRID_SIZE - eyeOffset - eyeSize;
                } else if (this.dy === 1) { 
                    eye1X = x + eyeOffset; eye1Y = y + this.GRID_SIZE - 7;
                    eye2X = x + this.GRID_SIZE - eyeOffset - eyeSize; eye2Y = y + this.GRID_SIZE - 7;
                } else { 
                    eye1X = x + eyeOffset; eye1Y = y + 4;
                    eye2X = x + this.GRID_SIZE - eyeOffset - eyeSize; eye2Y = y + 4;
                }
                
                ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
                ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);
            }
        });
        
        ctx.shadowBlur = 0;
    }
}

const game = new SnakeGame();
