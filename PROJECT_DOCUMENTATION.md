# 📖 Detailed Project Documentation: Cyber Snake

This document outlines the architectural decisions, design language, and technical implementation details of the Cyber Snake codebase.

## 1. Architecture & Tech Stack

The application is a pure front-end project designed to be as lightweight and independent as possible. 
- **HTML5 (`index.html`):** semantic structure and UI overlay scaffolding.
- **CSS3 (`style.css`):** modern styling utilizing CSS variables for theming, keyframe animations, flex layout, and `backdrop-filter` for glassmorphism.
- **Vanilla JavaScript (`game.js`):** ES6 class-based logic, `requestAnimationFrame` game loop, and HTML5 Canvas API for real-time rendering. No external libraries (React, Phaser, Howler, etc.) were used.

---

## 2. The Game Loop (`game.js`)

At the core of the engine sits the `gameLoop()` running on `window.requestAnimationFrame`. 

### Logic vs. Rendering Separation
To ensure smooth 60 FPS drawing while the snake only moves at a fixed interval (e.g., 100ms per tick), we strictly separate the rendering cycle from the logic cycle:
- `timeAccumulator`: Tracks milliseconds passed between frames.
- `this.update()`: The logic tick fires *only* when the accumulator exceeds the `currentSpeed`.
- `this.draw()`: The canvas is cleared and redrawn on *every single frame* regardless of the logic tick. This lets us animate the pulsating glowing effects on apples or rotation matrices flawlessly at high framerate.

### Input Queue
To fix standard "Snake Suicude Bugs" (where players press two directional keys faster than the game logic tick, causing a 180-degree turn in one frame), `game.js` implements an **Input Queue**. Keypresses are buffered into an array, and the `update()` loop shifts exactly *one* command from the queue per tick.

---

## 3. Web Audio API Engine

A standout feature is the custom audio engine. The game generates all sounds dynamically using the native Web Audio API, keeping the repository incredibly tiny (no bulky `.wav` or `.mp3` assets).

- **Oscillators:** The engine mixes different waves (`sine`, `triangle`, `sawtooth`, `square`) in real-time. Adding Envelopes (`exponentialRampToValueAtTime`) creates snappy "pops".
- **Arpeggios:** For special sounds (Gold Apple, Game Won), the engine rapidly cycles sequentially through predefined frequencies over a very short time vector to create retro 8-bit fanfares.
- **White Noise (Explosion):** Instead of a generic dying tone, we allocate a `createBuffer`, fill it with randomized numerical noise (`Math.random() * 2 - 1`), and pass the source node through a `lowpass` `BiquadFilterNode` whose cutoff frequency dramatically falls over 0.5s. This accurately mimics the crunching sound of tearing through a physical boundary.

---

## 4. UI / UX Design Language 

The game adopts a modern **Synthwave / Cyberpunk** aesthetic.
- **Color Tokens:** Deep space purple (`#0d0221`) serves as the background, highlighted by electric Cyan (`#00f5d4`) and Hot Neon Pink (`#f15bb5`).
- **Glassmorphism:** The overarching UI (Highscore headers, Overlay screens) rests on `backdrop-filter: blur(x)` attributes. Bringing the HTML UI out of focus over the crisp Canvas geometry creates strong depth representation.
- **CRT Emulator:** The `.crt-overlay` CSS class sits at a `z-index: 100` with `pointer-events: none`. It utilizes linear gradients to create alternating scanlines and an inset box-shadow to create a stark screen vignette.

---

## 5. Meta Progression & Storage

The system reads and writes to `localStorage` to manage player achievements seamlessly without a backend.
- **Difficulty Separation:** Highscores are partitioned programmatically (`snakeHighscore_easy`, `snakeHighscore_normal`, `snakeHighscore_hard`).
- **Arcade Name Entry:** Following state-machine principles, if a new high score is detected on death, the game halts standard key mapping. Arrow keys are redirected to increment/decrement indexes mapped to an `alphabet` string, allowing the classic 3-letter initialization. Upon submission, it stores the data as `JSON.stringify({ score: X, name: Y })`.
