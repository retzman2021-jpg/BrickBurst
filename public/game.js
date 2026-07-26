(() => {
  "use strict";

  // ==================================================
  // SETTINGS
  // ==================================================
  const COLS = 8, ROWS = 8;
  const BLOCK = 44, GAP = 6;
  const GRID_W = COLS*(BLOCK+GAP) + GAP;
  const GRID_H = ROWS*(BLOCK+GAP) + GAP;

  // SOLID BASE COLORS (no soft gradients)
  const SOLID = [
    "#ef4444", // 0 Red
    "#10b981", // 1 Green
    "#2563eb", // 2 Blue
    "#f59e0b", // 3 Orange
    "#ec4899", // 4 Pink
    "#8b5cf6", // 5 Purple
    "#14b8a6", // 6 Teal
    "#1f2937"  // 7 Black
  ];

  // ==================================================
  // STATE
  // ==================================================
  let canvas, ctx, grid=[], score=0, cash=0, time=0, mode="classic";
  let running=false, timer=null, raf=null, sel=null, combo=0, hintAt=0, hintCell=null;
  let popAnim=[], swapAnim=null;
  let audioCtx=null, sfxOn=true, bgmOn=true, sfxV=.35, bgmV=.25, bgmTimer=null;

  // ==================================================
  // AUDIO
  // ==================================================
  function auUnlock(){try{if(audioCtx)return;const A=window.AudioContext||window.webkitAudioContext;audioCtx=new A;if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{})}catch{}}
  function beep(f=660,d=.07,t="square",v=.25){try{if(!audioCtx||!sfxOn)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=t;o.frequency.value=f;g.gain.value=Math.max(.0001,Math.min(1,v*sfxV));o.connect(g);g.connect(audioCtx.destination);const T=audioCtx.currentTime;o.start(T);g.gain.exponentialRampToValueAtTime(.0001,T+d);o.stop(T+d+.04)}catch{}}
  function sndPop(){beep(880,.06);setTimeout(()=>beep(1320,.05,"sine"),30)}
  function sndWin(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.14,"triangle",.35),i*90))}
  function sndBad(){beep(180,.12,"sawtooth",.3)}
  function bgmStart(){bgmStop();if(!bgmOn||!audioCtx)return;const n=[262,330,392,523,392,330,294,349];let i=0;bgmTimer=setInterval(()=>{if(!bgmOn||!audioCtx)return bgmStop();beep(n[i%n.length],.22,"triangle",bgmV*.9);if(i%2===0)beep(n[i%n.length]/2,.3,"sine",bgmV*.5);i++},300)}
  function bgmStop(){try{if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null}}catch{}}
  ["pointerdown","touchstart","click"].forEach(e=>document.addEventListener(e,auUnlock,{once:true,passive:true}));

  // ==================================================
  // CANVAS
  // ==================================================
  function fit(){
    const maxW=Math.min(window.innerWidth-32,440);
    const s=maxW/GRID_W;
    canvas.width=GRID_W;canvas.height=GRID_H;
    canvas.style.width=maxW+"px";canvas.style.height=Math.round(GRID_H*s)+"px";
  }

  // ==================================================
  // START GAME
  // ==================================================
  function startGame(m){
    auUnlock();
    mode=m||"classic";
    score=0;cash=0;combo=0;sel=null;hintCell=null;popAnim=[];swapAnim=null;
    running=true;
    time = mode==="adventure" ? 240 : -1;
    canvas=document.getElementById("gameCanvas");
    if(!canvas){alert("❌ Game canvas missing");return}
    ctx=canvas.getContext("2d");
    fit();window.addEventListener("resize",fit);
    grid=Array.from({length:ROWS},()=>Array.from({length:COLS},()=>Math.floor(Math.random()*SOLID.length)));
    clearStarts();while(!hasMoves())shuffle();
    hintAt=Date.now()+5000;
    updHud();
    clearInterval(timer);
    if(mode==="adventure")timer=setInterval(()=>{if(!running)return;time--;updHud();if(time<=0)over()},1000);
    canvas.onpointerdown=onDown;canvas.onpointerup=onUp;
    canvas.ontouchstart=e=>{e.preventDefault();onDown(e)};
    canvas.ontouchend=e=>{e.preventDefault();onUp(e)};
    if(bgmOn)bgmStart();
    loop();
  }
  function restart(){startGame(mode)}
  function quit(){
    running=false;clearInterval(timer);cancelAnimationFrame(raf);bgmStop();
    try{window.refreshHud&&window.refreshHud()}catch{}
    try{window.show&&window.show("menuScreen")}catch{}
  }

  // ==================================================
  // HUD
  // ==================================================
  function updHud(){
    const t = mode==="adventure"
      ? (s=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0"))(Math.max(0,time))
      : "∞";
    try{const a=document.getElementById("hudPoints");if(a)a.textContent=Number(score).toLocaleString()}catch{}
    try{const a=document.getElementById("hudCash");if(a)a.textContent="₱"+Number(cash).toFixed(2)}catch{}
    try{const a=document.getElementById("hudTime");if(a)a.textContent=t}catch{}
    try{const a=document.getElementById("lastScore");if(a)a.textContent=combo>1?"x"+combo:Number(score).toLocaleString()}catch{}
  }

  // ==================================================
  // GRID LOGIC
  // ==================================================
  function clearStarts(){
    let c=true;while(c){c=false;
      for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
        const v=grid[r][col];
        if(col+2<COLS&&grid[r][col+1]===v&&grid[r][col+2]===v){grid[r][col]=Math.floor(Math.random()*SOLID.length);c=true}
        if(r+2<ROWS&&grid[r+1][col]===v&&grid[r+2][col]===v){grid[r][col]=Math.floor(Math.random()*SOLID.length);c=true}
      }
    }
  }
  function swapRC(a,b){const t=grid[a.r][a.c];grid[a.r][a.c]=grid[b.r][b.c];grid[b.r][b.c]=t}
  function markMatches(){
    const kill=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    let any=false;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const v=grid[r][c];let L=1;
      while(c+L<COLS&&grid[r][c+L]===v)L++;
      if(L>=3){for(let k=0;k<L;k++)kill[r][c+k]=true;any=true}
      L=1;while(r+L<ROWS&&grid[r+L][c]===v)L++;
      if(L>=3){for(let k=0;k<L;k++)kill[r+k][c]=true;any=true}
    }
    return {kill,any}
  }
  function collapse(){
    for(let c=0;c<COLS;c++){
      const col=[];for(let r=0;r<ROWS;r++)if(grid[r][c]>=0)col.push(grid[r][c]);
      while(col.length<ROWS)col.unshift(Math.floor(Math.random()*SOLID.length));
      for(let r=0;r<ROWS;r++)grid[r][c]=col[r];
    }
  }
  function resolve(){
    let total=0,round=0;
    while(true){
      const {kill,any}=markMatches();if(!any)break;
      round++;combo++;
      let cnt=0;
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(kill[r][c]){
        cnt++;grid[r][c]=-1;
        popAnim.push({r,c,t:Date.now(),col:SOLID[grid[r][c]]});
      }
      const mult = 1 + Math.floor(combo/3)*0.5;
      const pts = Math.floor( cnt * (cnt-1) * (5 + round*4) * mult );
      total += pts;
      collapse();
    }
    if(total>0){
      score += total; cash = score/100; sndPop();
      hintAt = Date.now()+5000; hintCell = null;
    } else combo = 0;
    if(!hasMoves()) setTimeout(()=>{if(running){shuffle();clearStarts();while(!hasMoves())shuffle()}},300);
    updHud();
  }
  function hasMoves(){
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(c+1<COLS){swapRC({r,c},{r,c:c+1});const ok=markMatches().any;swapRC({r,c},{r,c:c+1});if(ok)return true}
      if(r+1<ROWS){swapRC({r,c},{r:r+1,c});const ok=markMatches().any;swapRC({r,c},{r:r+1,c});if(ok)return true}
    }return false
  }
  function findHint(){
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(c+1<COLS){swapRC({r,c},{r,c:c+1});const ok=markMatches().any;swapRC({r,c},{r,c:c+1});if(ok)return{r,c}}
      if(r+1<ROWS){swapRC({r,c},{r:r+1,c});const ok=markMatches().any;swapRC({r,c},{r:r+1,c});if(ok)return{r,c}}
    }return null
  }
  function shuffle(){
    const flat=grid.flat();
    for(let i=flat.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[flat[i],flat[j]]=[flat[j],flat[i]]}
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)grid[r][c]=flat[r*COLS+c];
  }

  // ==================================================
  // INPUT (MOUSE + TOUCH — iOS WORKS)
  // ==================================================
  function getPos(e){
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
    const R=canvas.getBoundingClientRect();
    const x=(cx-R.left)*(canvas.width/R.width)-GAP;
    const y=(cy-R.top)*(canvas.height/R.height)-GAP;
    if(x<0||y<0)return null;
    const c=Math.floor(x/(BLOCK+GAP)), r=Math.floor(y/(BLOCK+GAP));
    if(r<0||r>=ROWS||c<0||c>=COLS)return null;
    return{r,c}
  }
  function onDown(e){if(!running)return;auUnlock();sel=getPos(e)}
  function onUp(e){
    if(!running||!sel)return;
    const end=getPos(e);if(!end){sel=null;return}
    const dr=Math.abs(end.r-sel.r),dc=Math.abs(end.c-sel.c);
    if(dr+dc===1){
      swapRC(sel,end);
      if(markMatches().any) resolve();
      else { swapRC(sel,end); sndBad(); }
    }
    sel=null;
  }

  // ==================================================
  // DRAW — SOLID COLOR + CLASSIC RAISED BEVEL
  // ==================================================
  function hexMix(hex,p,light=true){
    const n=parseInt(hex.slice(1),16);
    let R=(n>>16)&255,G=(n>>8)&255,B=n&255;
    if(light){R=Math.min(255,R+p);G=Math.min(255,G+p);B=Math.min(255,B+p)}
    else{R=Math.max(0,R-p);G=Math.max(0,G-p);B=Math.max(0,B-p)}
    return`rgb(${R},${G},${B})`
  }
  function roundPath(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function drawBlock(x,y,size,color,alpha=1){
    ctx.globalAlpha = alpha;
    const r = 6;
    // 1) SOLID BASE
    ctx.fillStyle = color;
    roundPath(x,y,size,size,r); ctx.fill();
    // 2) BRIGHT BEVEL (top-left)
    ctx.fillStyle = hexMix(color, 55, true);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+size-r,y);
    ctx.quadraticCurveTo(x+size,y,x+size,y+r);
    ctx.lineTo(x+size,y+r+3);
    ctx.lineTo(x+r+3,y+r+3);
    ctx.lineTo(x+r+3,y+size-r);
    ctx.lineTo(x+r,y+size-r);
    ctx.quadraticCurveTo(x,y+size-r,x,y+size-2*r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.fill();
    // 3) DARK BEVEL (bottom-right)
    ctx.fillStyle = hexMix(color, 70, false);
    ctx.beginPath();
    ctx.moveTo(x+size-r,y+size);
    ctx.lineTo(x+r,y+size);
    ctx.quadraticCurveTo(x,y+size,x,y+size-r);
    ctx.lineTo(x,y+size-r-3);
    ctx.lineTo(x+size-r-3,y+size-r-3);
    ctx.lineTo(x+size-r-3,y+r);
    ctx.lineTo(x+size-r,y+r);
    ctx.quadraticCurveTo(x+size,y+r,x+size,y+2*r);
    ctx.lineTo(x+size,y+size-r);
    ctx.quadraticCurveTo(x+size,y+size,x+size-r,y+size);
    ctx.fill();
    // 4) Inner shine
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundPath(x+size*0.18, y+size*0.15, size*0.30, size*0.18, 4); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw(){
    const W=canvas.width, H=canvas.height;
    // Dark grid frame
    ctx.fillStyle = "#0b1220";
    roundPath(0,0,W,H,14); ctx.fill();

    // Auto-hint pulse if idle > 5s
    if(Date.now() > hintAt){
      if(!hintCell) hintCell = findHint();
      if(hintCell){
        const x = GAP + hintCell.c*(BLOCK+GAP);
        const y = GAP + hintCell.r*(BLOCK+GAP);
        const pulse = 0.4 + 0.3*Math.sin(Date.now()/120);
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = 4;
        roundPath(x-3, y-3, BLOCK+6, BLOCK+6, 10); ctx.stroke();
      }
    }

    // Draw all blocks
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const v = grid[r][c]; if(v<0) continue;
      const x = GAP + c*(BLOCK+GAP);
      const y = GAP + r*(BLOCK+GAP);
      drawBlock(x, y, BLOCK, SOLID[v]);
      // Selected ring
      if(sel && sel.r===r && sel.c===c){
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
        roundPath(x-2, y-2, BLOCK+4, BLOCK+4, 8); ctx.stroke();
      }
    }

    // Pop animations
    const now = Date.now();
    popAnim = popAnim.filter(p => {
      const age = (now - p.t) / 260;
      if(age >= 1) return false;
      const x = GAP + p.c*(BLOCK+GAP);
      const y = GAP + p.r*(BLOCK+GAP);
      const sz = BLOCK * (1 + age*0.6);
      const al = 1 - age;
      ctx.save();
      ctx.translate(x+BLOCK/2, y+BLOCK/2);
      drawBlock(-sz/2, -sz/2, sz, p.col || "#888", al);
      ctx.restore();
      return true;
    });
  }

  function loop(){ if(!running) return; draw(); raf = requestAnimationFrame(loop); }

  // ==================================================
  // GAME OVER + SAVE SCORE
  // ==================================================
  async function saveScore(earned){
    try{
      const tok = typeof window.authToken==="function" ? window.authToken() : (window.authToken||"");
      if(!tok) return;
      const fn = window.api || window.fetchApi; if(!fn) return;
      const res = await fn("/game/end","POST",{points:Math.max(0,Math.floor(earned||0)),mode});
      if(res?.success && typeof window.refreshHud==="function") await window.refreshHud();
    }catch{}
  }
  function over(){
    running=false; clearInterval(timer); cancelAnimationFrame(raf); bgmStop();
    try{sndWin()}catch{}
    const f = Math.max(0, Math.floor(score));
    saveScore(f);
    setTimeout(()=>{
      alert(
        "🎮 GAME OVER\n\n"+
        "Mode: "+mode.toUpperCase()+"\n"+
        "Score: "+f.toLocaleString()+"\n"+
        "Best combo: x"+(combo||1)+"\n\n"+
        "Score saved to server ✅"
      );
      try{ window.backToMenu && window.backToMenu(); }catch{}
    },350);
  }

  // ==================================================
  // SETTINGS
  // ==================================================
  function apply(d){
    if(typeof d.sfxOn!=="undefined") sfxOn=!!d.sfxOn;
    if(typeof d.bgmOn!=="undefined"){ bgmOn=!!d.bgmOn; bgmOn&&running ? bgmStart() : bgmStop(); }
    if(typeof d.sfxVol!=="undefined") sfxV=Math.max(0,Math.min(1,Number(d.sfxVol)/100));
    if(typeof d.bgmVol!=="undefined") bgmV=Math.max(0,Math.min(1,Number(d.bgmVol)/100));
  }

  // ==================================================
  // EXPORT TO WINDOW
  // ==================================================
  window.BrickBurstGame = { startGame, restartGame:restart, backToMenu:quit, gameOver:over, applySettings:apply, saveScoreToServer:saveScore };
  window.startClassic   = () => BrickBurstGame.startGame("classic");
  window.startAdventure = () => BrickBurstGame.startGame("adventure");
})();
// ✅ END game.js