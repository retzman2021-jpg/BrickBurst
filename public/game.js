(() => {
  "use strict";

  const COLS = 8, ROWS = 8;
  const BLOCK = 44, GAP = 6;
  const GRID_W = COLS * (BLOCK + GAP) + GAP;
  const GRID_H = ROWS * (BLOCK + GAP) + GAP;

  // Solid colors with 3D bevel shading
  const SOLID = ["#ef4444","#10b981","#2563eb","#f59e0b","#ec4899","#8b5cf6","#14b8a6","#1f2937"];

  let canvas, ctx, grid = [], score = 0, cash = 0, time = 0, mode = "classic";
  let running = false, timer = null, raf = null, sel = null, combo = 0;
  let audioCtx = null, sfxOn = true, bgmOn = true, sfxV = 0.35, bgmV = 0.25;

  // Audio helpers
  function auUnlock() {
    try {
      if (audioCtx) return;
      const A = window.AudioContext || window.webkitAudioContext;
      audioCtx = new A();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    } catch {}
  }
  function beep(freq = 660, dur = 0.07, type = "square", vol = 0.25) {
    try {
      if (!audioCtx || !sfxOn) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = Math.max(0.0001, Math.min(1, vol * sfxV));
      o.connect(g);
      g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.stop(now + dur + 0.04);
    } catch {}
  }
  function sndPop() { beep(880, 0.06); setTimeout(() => beep(1320, 0.05, "sine"), 30); }
  function sndBad() { beep(180, 0.12, "sawtooth", 0.3); }

  // Canvas sizing
  function fit() {
    const maxW = Math.min(window.innerWidth - 32, 440);
    const scale = maxW / GRID_W;
    canvas.width = GRID_W;
    canvas.height = GRID_H;
    canvas.style.width = maxW + "px";
    canvas.style.height = Math.round(GRID_H * scale) + "px";
  }

  // Start game
  function startGame(m) {
    auUnlock();
    mode = m || "classic";
    score = 0; cash = 0; combo = 0; sel = null;
    running = true;
    time = mode === "adventure" ? 240 : -1;
    canvas = document.getElementById("gameCanvas");
    if (!canvas) { alert("❌ Game canvas missing"); return; }
    ctx = canvas.getContext("2d");
    fit();
    window.addEventListener("resize", fit);
    grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => Math.floor(Math.random() * SOLID.length)));
    clearStarts();
    updHud();
    clearInterval(timer);
    if (mode === "adventure") {
      timer = setInterval(() => {
        if (!running) return;
        time--; updHud();
        if (time <= 0) gameOver();
      }, 1000);
    }
    canvas.onpointerdown = onDown;
    canvas.onpointerup = onUp;
    canvas.ontouchstart = e => { e.preventDefault(); onDown(e); };
    canvas.ontouchend = e => { e.preventDefault(); onUp(e); };
    loop();
  }
  function restartGame() { startGame(mode); }
  function backToMenu() {
    running = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    try { window.refreshHud && window.refreshHud(); } catch {}
    try { window.show && window.show("menuScreen"); } catch {}
  }

  // Update HUD
  function updHud() {
    const t = mode === "adventure"
      ? `${String(Math.floor(Math.max(0, time) / 60)).padStart(2, "0")}:${String(Math.max(0, time) % 60).padStart(2, "0")}`
      : "∞";
    try { $("hudPoints").textContent = Number(score).toLocaleString(); } catch {}
    try { $("hudCash").textContent = "₱" + (score / 100).toFixed(2); } catch {}
    try { $("hudTime").textContent = t; } catch {}
    try { $("lastScore").textContent = combo > 1 ? `x${combo}` : Number(score).toLocaleString(); } catch {}
  }

  // Remove pre-made matches at start
  function clearStarts() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          if (c + 2 < COLS && grid[r][c+1] === v && grid[r][c+2] === v) {
            grid[r][c] = Math.floor(Math.random() * SOLID.length);
            changed = true;
          }
          if (r + 2 < ROWS && grid[r+1][c] === v && grid[r+2][c] === v) {
            grid[r][c] = Math.floor(Math.random() * SOLID.length);
            changed = true;
          }
        }
      }
    }
  }

  // Swap positions
  function swapRC(a, b) {
    const temp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = temp;
  }

  // Find all matches of 3+
  function markMatches() {
    const kill = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let foundAny = false;
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        let len = 1;
        while (c + len < COLS && grid[r][c + len] === v) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) kill[r][c + k] = true;
          foundAny = true;
        }
      }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const v = grid[r][c];
        let len = 1;
        while (r + len < ROWS && grid[r + len][c] === v) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) kill[r + k][c] = true;
          foundAny = true;
        }
      }
    }
    return { kill, foundAny };
  }

  // Blocks fall down + fill empty spaces
  function collapse() {
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = 0; r < ROWS; r++) if (grid[r][c] >= 0) col.push(grid[r][c]);
      while (col.length < ROWS) col.unshift(Math.floor(Math.random() * SOLID.length));
      for (let r = 0; r < ROWS; r++) grid[r][c] = col[r];
    }
  }

  // Burst blocks + add score + save to server
  function resolveMatches() {
    let totalGain = 0;
    combo = 0;
    while (true) {
      const { kill, foundAny } = markMatches();
      if (!foundAny) break;
      combo++;
      let count = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (kill[r][c]) { count++; grid[r][c] = -1; }
        }
      }
      totalGain += Math.floor(count * 10 * combo);
      collapse();
    }
    if (totalGain > 0) {
      score += totalGain;
      cash = score / 100;
      sndPop();
      updHud();
      // ✅ AUTO-SAVE POINTS TO YOUR ACCOUNT
      saveScoreToServer(totalGain);
    } else combo = 0;
  }

  // Send score to backend
  async function saveScoreToServer(points) {
    try {
      if (!window.api || !window.refreshHud) return;
      await api("/game/end", "POST", { points, mode });
      await refreshHud();
    } catch {}
  }

  // Get grid position from click/tap
  function getGridPos(e) {
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left) * (canvas.width / rect.width) - GAP;
    const y = (cy - rect.top) * (canvas.height / rect.height) - GAP;
    if (x < 0 || y < 0) return null;
    const col = Math.floor(x / (BLOCK + GAP));
    const row = Math.floor(y / (BLOCK + GAP));
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { r: row, c: col };
  }

  // Input handling
  function onDown(e) { if (!running) return; auUnlock(); sel = getGridPos(e); }
  function onUp(e) {
    if (!running || !sel) return;
    const target = getGridPos(e);
    if (!target) { sel = null; return; }
    const dr = Math.abs(target.r - sel.r);
    const dc = Math.abs(target.c - sel.c);
    // ✅ ONLY ALLOW ADJACENT SWAPS (up/down/left/right)
    if (dr + dc === 1) {
      swapRC(sel, target);
      const { foundAny } = markMatches();
      if (foundAny) {
        resolveMatches(); // ✅ BURST + ADD SCORE
      } else {
        swapRC(sel, target); // ✅ SWAP BACK IF NO MATCH
        sndBad();
      }
    }
    sel = null;
  }

  // Shade helper for 3D bevel
  function hexShade(hex, percent, lighten = true) {
    const n = parseInt(hex.slice(1), 16);
    let R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
    if (lighten) {
      R = Math.min(255, R + percent); G = Math.min(255, G + percent); B = Math.min(255, B + percent);
    } else {
      R = Math.max(0, R - percent); G = Math.max(0, G - percent); B = Math.max(0, B - percent);
    }
    return `rgb(${R},${G},${B})`;
  }

  // Rounded rect helper
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw 3D bevel block
  function drawBlock(x, y, color) {
    const r = 6;
    // Base
    ctx.fillStyle = color;
    roundRect(x, y, BLOCK, BLOCK, r);
    ctx.fill();
    // Top-left highlight
    ctx.fillStyle = hexShade(color, 55, true);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + BLOCK - r, y);
    ctx.quadraticCurveTo(x + BLOCK, y, x + BLOCK, y + r);
    ctx.lineTo(x + BLOCK, y + r + 3);
    ctx.lineTo(x + r + 3, y + r + 3);
    ctx.lineTo(x + r + 3, y + BLOCK - r);
    ctx.lineTo(x + r, y + BLOCK - r);
    ctx.quadraticCurveTo(x, y + BLOCK - r, x, y + BLOCK - 2 * r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    // Bottom-right shadow
    ctx.fillStyle = hexShade(color, 70, false);
    ctx.beginPath();
    ctx.moveTo(x + BLOCK - r, y + BLOCK);
    ctx.lineTo(x + r, y + BLOCK);
    ctx.quadraticCurveTo(x, y + BLOCK, x, y + BLOCK - r);
    ctx.lineTo(x, y + BLOCK - r - 3);
    ctx.lineTo(x + BLOCK - r - 3, y + BLOCK - r - 3);
    ctx.lineTo(x + BLOCK - r - 3, y + r);
    ctx.lineTo(x + BLOCK - r, y + r);
    ctx.quadraticCurveTo(x + BLOCK, y + r, x + BLOCK, y + 2 * r);
    ctx.lineTo(x + BLOCK, y + BLOCK - r);
    ctx.quadraticCurveTo(x + BLOCK, y + BLOCK, x + BLOCK - r, y + BLOCK);
    ctx.fill();
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(x + BLOCK * 0.18, y + BLOCK * 0.15, BLOCK * 0.28, BLOCK * 0.18, 4);
    ctx.fill();
  }

  // Render loop
  function draw() {
    ctx.fillStyle = "#0b1220";
    roundRect(0, 0, canvas.width, canvas.height, 14);
    ctx.fill();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v < 0) continue;
        const x = GAP + c * (BLOCK + GAP);
        const y = GAP + r * (BLOCK + GAP);
        drawBlock(x, y, SOLID[v]);
        // Selection ring
        if (sel && sel.r === r && sel.c === c) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          roundRect(x - 2, y - 2, BLOCK + 4, BLOCK + 4, 8);
          ctx.stroke();
        }
      }
    }
  }
  function loop() { if (!running) return; draw(); raf = requestAnimationFrame(loop); }

  function gameOver() {
    running = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    alert(`🎮 GAME OVER\nScore: ${score.toLocaleString()}\nMax Combo: x${combo || 1}`);
    backToMenu();
  }

  // Global API
  window.BrickBurstGame = {
    startGame, restartGame, backToMenu, applySettings: d => { sfxOn = d.sfxOn; bgmOn = d.bgmOn; sfxV = d.sfxVol / 100; bgmV = d.bgmVol / 100; }, saveScoreToServer
  };
  window.startClassic = () => BrickBurstGame.startGame("classic");
  window.startAdventure = () => BrickBurstGame.startGame("adventure");
})();