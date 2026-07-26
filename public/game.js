(() => {
  "use strict";

  // ==================================================
  // ✅ EXACT SETTINGS FROM YOUR SCREENSHOT
  // ==================================================
  const COLS = 8;
  const ROWS = 8;                     // ✅ 8 rows (matches screenshot)
  const BLOCK_SIZE = 44;              // ✅ Block size
  const PADDING = 6;                  // ✅ Gap between blocks
  const GRID_W = COLS * (BLOCK_SIZE + PADDING) + PADDING;
  const GRID_H = ROWS * (BLOCK_SIZE + PADDING) + PADDING;
  const HUD_H = 44;                   // ✅ Top blue HUD bar height

  // ✅ EXACT COLORS FROM YOUR SCREENSHOT (8 colors + black)
  const COLORS = [
    "#ef4444",  // 0 Red
    "#10b981",  // 1 Green
    "#2563eb",  // 2 Blue
    "#f59e0b",  // 3 Orange
    "#ec4899",  // 4 Pink
    "#8b5cf6",  // 5 Purple
    "#14b8a6",  // 6 Teal
    "#1f2937"   // 7 Dark Gray / Black
  ];

  // ==================================================
  // STATE
  // ==================================================
  let canvas, ctx;
  let grid = [];
  let score = 0;
  let cashEarned = 0;
  let timeLeft = 0;
  let mode = "classic";
  let running = false;
  let timerId = null;
  let rafId = null;
  let selected = null;        // {r,c}
  let combo = 0;
  let flashT = 0;
  let audioCtx = null;
  let sfxOn = true, bgmOn = true;
  let sfxVol = 0.35, bgmVol = 0.25;
  let bgmTimer = null;

  // ==================================================
  // AUDIO
  // ==================================================
  function unlockAudio(){
    try{
      if(audioCtx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      if(audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});
    }catch{}
  }
  function beep(freq=660, dur=0.07, type="square", vol=0.25){
    try{
      if(!audioCtx || !sfxOn) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = Math.max(0.0001, Math.min(1, vol * sfxVol));
      o.connect(g); g.connect(audioCtx.destination);
      const T = audioCtx.currentTime;
      o.start(T);
      g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
      o.stop(T + dur + 0.04);
    }catch{}
  }
  function popSound(){ beep(880,0.06); setTimeout(()=>beep(1320,0.05,"sine"),35); }
  function winSound(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.14,"triangle",0.35),i*90)); }
  function startBGM(){
    stopBGM();
    if(!bgmOn || !audioCtx) return;
    const notes = [262,330,392,523,392,330,294,349];
    let i = 0;
    bgmTimer = setInterval(()=>{
      if(!bgmOn || !audioCtx){ stopBGM(); return; }
      beep(notes[i%notes.length], 0.22, "triangle", bgmVol*0.9);
      if(i%2===0) beep(notes[i%notes.length]/2, 0.3, "sine", bgmVol*0.5);
      i++;
    }, 300);
  }
  function stopBGM(){ try{ if(bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; } }catch{} }
  ["pointerdown","touchstart","click"].forEach(ev =>
    document.addEventListener(ev, unlockAudio, { once:true, passive:true })
  );

  // ==================================================
  // CANVAS SETUP
  // ==================================================
  function sizeCanvas(){
    const maxW = Math.min(window.innerWidth - 32, 440);
    const scale = maxW / GRID_W;
    canvas.width  = Math.round(GRID_W);
    canvas.height = Math.round(GRID_H + HUD_H + 10);
    canvas.style.width  = maxW + "px";
    canvas.style.height = Math.round((GRID_H + HUD_H + 10) * scale) + "px";
  }

  // ==================================================
  // START / RESET GAME
  // ==================================================
  function startGame(m){
    unlockAudio();
    mode = m || "classic";
    score = 0; cashEarned = 0; combo = 0; flashT = 0;
    running = true;
    selected = null;

    if(mode === "adventure") timeLeft = 240;  // ✅ 4:00 EXACT
    else timeLeft = -1;                       // ✅ Classic = UNLIMITED

    canvas = document.getElementById("gameCanvas");
    if(!canvas){ console.error("❌ #gameCanvas missing"); alert("Game canvas not found"); return; }
    ctx = canvas.getContext("2d");
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    // Fill grid with random colors
    grid = Array.from({length: ROWS}, () =>
      Array.from({length: COLS}, () => Math.floor(Math.random() * COLORS.length))
    );
    clearInitialMatches();
    updateHud();

    // Timer (adventure only)
    clearInterval(timerId);
    if(mode === "adventure"){
      timerId = setInterval(()=>{
        if(!running) return;
        timeLeft--;
        updateHud();
        if(timeLeft <= 0) gameOver();
      }, 1000);
    }

    // ✅ ALL INPUT HANDLERS (mouse + touch — works on iOS)
    canvas.onpointerdown = onDown;
    canvas.onpointerup   = onUp;
    canvas.ontouchstart  = function(e){ e.preventDefault(); onDown(e); };
    canvas.ontouchend    = function(e){ e.preventDefault(); onUp(e); };
    canvas.onmousedown   = onDown;
    canvas.onmouseup     = onUp;

    if(bgmOn) startBGM();
    loop();
  }

  function restartGame(){ startGame(mode); }

  function backToMenu(){
    running = false;
    clearInterval(timerId);
    cancelAnimationFrame(rafId);
    stopBGM();
    try{ if(typeof window.refreshHud === "function") window.refreshHud(); }catch{}
    try{ if(typeof window.show === "function") window.show("menuScreen"); }catch{}
  }

  // ==================================================
  // HUD UPDATE (EXACTLY YOUR SCREENSHOT)
  // ==================================================
  function updateHud(){
    let t;
    if(mode === "adventure"){
      const s = Math.max(0, timeLeft);
      t = String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0");
    } else t = "∞";

    // Update page HUD (outside canvas)
    try{
      const hp = document.getElementById("hudPoints");
      const hc = document.getElementById("hudCash");
      const ht = document.getElementById("hudTime");
      if(hp) hp.textContent = Number(score).toLocaleString();
      if(hc) hc.textContent = "₱" + Number(cashEarned).toFixed(2);
      if(ht) ht.textContent = t;
    }catch{}
  }

  // ==================================================
  // GRID LOGIC
  // ==================================================
  function clearInitialMatches(){
    let changed = true;
    while(changed){
      changed = false;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const v = grid[r][c];
        if(c+2 < COLS && grid[r][c+1]===v && grid[r][c+2]===v){ grid[r][c] = Math.floor(Math.random()*COLORS.length); changed=true; }
        if(r+2 < ROWS && grid[r+1][c]===v && grid[r+2][c]===v){ grid[r][c] = Math.floor(Math.random()*COLORS.length); changed=true; }
      }
    }
  }

  function swap(r1,c1,r2,c2){ const t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t; }

  function hasMatch(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const v = grid[r][c];
      if(c+2 < COLS && grid[r][c+1]===v && grid[r][c+2]===v) return true;
      if(r+2 < ROWS && grid[r+1][c]===v && grid[r+2][c]===v) return true;
    }
    return false;
  }

  function collapse(){
    for(let c=0;c<COLS;c++){
      const col = [];
      for(let r=0;r<ROWS;r++) if(grid[r][c] >= 0) col.push(grid[r][c]);
      while(col.length < ROWS) col.unshift(Math.floor(Math.random()*COLORS.length));
      for(let r=0;r<ROWS;r++) grid[r][c] = col[r];
    }
  }

  function resolve(){
    let popped = 0, round = 0;
    while(hasMatch()){
      round++;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const v = grid[r][c]; if(v < 0) continue;
        let len = 1;
        while(c+len < COLS && grid[r][c+len] === v) len++;
        if(len >= 3){
          const pts = len * (len-1) * (5 + round*3);
          score += pts; popped += len;
          for(let k=0;k<len;k++) grid[r][c+k] = -1;
        }
        len = 1;
        while(r+len < ROWS && grid[r+len][c] === v) len++;
        if(len >= 3){
          const pts = len * (len-1) * (5 + round*3);
          score += pts; popped += len;
          for(let k=0;k<len;k++) grid[r+k][c] = -1;
        }
      }
      collapse();
    }
    if(popped > 0){ combo++; popSound(); flashT = performance.now(); }
    else combo = 0;
    cashEarned = score / 100;
    updateHud();
  }

  // ==================================================
  // INPUT (WORKS ON MOBILE + DESKTOP)
  // ==================================================
  function getXY(e){
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX) ?? (e.changedTouches?.[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY) ?? (e.changedTouches?.[0]?.clientY) ?? 0;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const x = (clientX - rect.left) * sx;
    const y = (clientY - rect.top)  * sy - HUD_H - 5;
    return { x, y };
  }

  function cellAt(e){
    const { x, y } = getXY(e);
    if(x < PADDING || y < PADDING) return null;
    const c = Math.floor((x - PADDING) / (BLOCK_SIZE + PADDING));
    const r = Math.floor((y - PADDING) / (BLOCK_SIZE + PADDING));
    if(r<0||r>=ROWS||c<0||c>=COLS) return null;
    return { r, c };
  }

  function onDown(e){
    if(!running) return;
    unlockAudio();
    selected = cellAt(e);
  }

  function onUp(e){
    if(!running || !selected) return;
    const end = cellAt(e);
    if(!end){ selected = null; return; }
    const dr = Math.abs(end.r - selected.r);
    const dc = Math.abs(end.c - selected.c);
    if(dr + dc === 1){
      swap(selected.r, selected.c, end.r, end.c);
      if(hasMatch()) resolve();
      else swap(selected.r, selected.c, end.r, end.c);
    }
    selected = null;
  }

  // ==================================================
  // DRAWING (EXACTLY YOUR SCREENSHOT)
  // ==================================================
  function draw(){
    const W = canvas.width, H = canvas.height;

    // --- 1) TOP HUD BAR (EXACT BLUE BAR FROM YOUR SCREENSHOT) ---
    ctx.fillStyle = "#1e3a8a";        // ✅ Dark blue HUD
    roundRect(ctx, 0, 0, W, HUD_H, 0);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "middle";

    const t = mode === "adventure"
      ? (()=>{ const s=Math.max(0,timeLeft); return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0"); })()
      : "∞";

    ctx.textAlign = "left";
    ctx.fillText("Points: " + Number(score).toLocaleString(), 14, HUD_H/2);

    ctx.textAlign = "center";
    ctx.fillText("Cash: ₱" + Number(cashEarned).toFixed(2), W/2, HUD_H/2);

    ctx.textAlign = "right";
    ctx.fillText("Time: " + t, W - 14, HUD_H/2);

    // --- 2) GRID BACKGROUND (dark frame) ---
    ctx.fillStyle = "#111827";
    roundRect(ctx, 0, HUD_H + 5, W, H - HUD_H - 5, 10);
    ctx.fill();

    // --- 3) BLOCKS (SQUARE WITH SLIGHT ROUND — YOUR STYLE) ---
    const OFFX = PADDING;
    const OFFY = HUD_H + 5 + PADDING;

    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const v = grid[r][c];
        if(v < 0) continue;
        const x = OFFX + c * (BLOCK_SIZE + PADDING);
        const y = OFFY + r * (BLOCK_SIZE + PADDING);
        drawBlock(x, y, BLOCK_SIZE, COLORS[v]);

        // Selected highlight
        if(selected && selected.r === r && selected.c === c){
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          roundRect(ctx, x-2, y-2, BLOCK_SIZE+4, BLOCK_SIZE+4, 6);
          ctx.stroke();
        }
      }
    }

    // --- 4) Pop flash ---
    if(flashT > 0 && performance.now() - flashT < 260){
      const a = 0.18 * (1 - (performance.now()-flashT)/260);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0,0,W,H);
    }
  }

  // ✅ YOUR BLOCK STYLE: slightly rounded square, 3D bevel
  function drawBlock(x, y, s, color){
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, x+1, y+3, s, s, 5);
    ctx.fill();

    // Main body
    ctx.fillStyle = color;
    roundRect(ctx, x, y, s, s, 5);
    ctx.fill();

    // Top highlight (bevel)
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, x+3, y+3, s-10, Math.max(6, s/4), 4);
    ctx.fill();

    // Inner shine
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRect(ctx, x+5, y+5, s-10, s-14, 4);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
  }

  function loop(){
    if(!running) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ==================================================
  // GAME OVER
  // ==================================================
  async function saveScoreToServer(earned){
    try{
      const tok = typeof window.authToken === "function" ? window.authToken() : (window.authToken || "");
      if(!tok){ console.log("⚠️ No token — skip save"); return; }
      const fn = window.api || window.fetchApi;
      if(!fn) return;
      const res = await fn("/game/end", "POST", {
        points: Math.max(0, Math.floor(earned || 0)),
        mode
      });
      if(res && res.success){
        console.log("✅ Score saved +", res.earned);
        if(typeof window.refreshHud === "function") await window.refreshHud();
      }
    }catch(e){ console.error("saveScore crash", e); }
  }

  function gameOver(){
    running = false;
    clearInterval(timerId);
    cancelAnimationFrame(rafId);
    stopBGM();
    try{ winSound(); }catch{}
    const final = Math.max(0, Math.floor(score));
    saveScoreToServer(final);
    setTimeout(()=>{
      alert(
        "🎮 GAME OVER\n\n" +
        "Mode: " + mode.toUpperCase() + "\n" +
        "Score: " + final.toLocaleString() + "\n" +
        "Best combo: x" + (combo||1) + "\n\n" +
        "Score saved to server ✅"
      );
      try{ if(typeof window.backToMenu === "function") window.backToMenu(); }catch{}
    }, 350);
  }

  // ==================================================
  // SETTINGS
  // ==================================================
  function applySettings(d){
    if(typeof d.sfxOn !== "undefined") sfxOn = !!d.sfxOn;
    if(typeof d.bgmOn !== "undefined"){
      bgmOn = !!d.bgmOn;
      if(bgmOn && running) startBGM(); else stopBGM();
    }
    if(typeof d.sfxVol !== "undefined") sfxVol = Math.max(0, Math.min(1, Number(d.sfxVol)/100));
    if(typeof d.bgmVol !== "undefined") bgmVol = Math.max(0, Math.min(1, Number(d.bgmVol)/100));
  }

  // ==================================================
  // EXPOSE TO WINDOW (app.js buttons find these)
  // ==================================================
  window.BrickBurstGame = {
    startGame, restartGame, backToMenu, gameOver, applySettings, saveScoreToServer
  };
  window.startClassic   = () => BrickBurstGame.startGame("classic");
  window.startAdventure = () => BrickBurstGame.startGame("adventure");

})();
// ✅ END game.js — EXACTLY YOUR SCREENSHOT STYLE · 8x8 · SQUARE BLOCKS · WORKING TAPS