'use strict';

// ── DOM ──────────────────────────────────────────────────────────────────────
const screenMenu   = document.getElementById('screen-menu');
const screenGame   = document.getElementById('screen-game');
const screenWin    = document.getElementById('screen-win');
const gameArea     = document.getElementById('game-area');
const gunmanEl     = document.getElementById('gunman');
const msgEl        = document.getElementById('msg');
const msgFire      = document.getElementById('msg-fire');
const timerYouEl   = document.getElementById('timer-you');
const timerGunEl   = document.getElementById('timer-gunman');
const scoreNumEl   = document.getElementById('score-num');
const winScoreEl   = document.getElementById('win-score');
const levelLabelEl = document.getElementById('level-label');
const btnStart     = document.getElementById('btn-start');
const btnRestart   = document.getElementById('btn-restart');
const btnNext      = document.getElementById('btn-next');
const btnPlayAgain = document.getElementById('btn-play-again');

// ── SOUNDS ───────────────────────────────────────────────────────────────────
const SFX = {};
['intro','wait','fire','shot','shot-fall','death','foul','win'].forEach(n => {
  const a = new Audio('sfx/' + n + '.m4a');
  a.preload = 'auto';
  SFX[n] = a;
});
function play(n) { const s=SFX[n]; if(!s)return; s.pause(); s.currentTime=0; s.play().catch(()=>{}); }
function stopAll() { Object.values(SFX).forEach(s=>{s.pause();s.currentTime=0;}); }

// ── SPRITE IMAGES ────────────────────────────────────────────────────────────
// Each entry: { img: Image, frameW, h, frames }
// walk: array of x offsets per frame (from analysis)
// stand, ready, shoot: x offset (single frame)
// die: array of x offsets

const SPRITE_DEFS = {
  r0: {
    src: 'img/sprites/',
    // r0: stand/ready/shoot 136x256, walk 400x256 (3 frames @0,136,268), die 528x256 (4 frames @0,136,272,408)
    h: 256,
    stand: { file:'r0_stand.png', x:0, w:136 },
    ready: { file:'r0_ready.png', x:0, w:136 },
    shoot: { file:'r0_shoot.png', x:0, w:136 },
    walk:  { file:'r0_walk.png',  frames:[[0,128],[136,128],[268,128]], h:256 },
    die:   { file:'r0_die.png',   frames:[[0,128],[136,128],[272,128],[408,104]], h:256 },
  },
  r1: {
    h: 288,
    stand: { file:'r1_stand.png', x:0, w:120 },
    ready: { file:'r1_ready.png', x:0, w:104 },
    shoot: { file:'r1_shoot.png', x:0, w:104 },
    walk:  { file:'r1_walk.png',  frames:[[0,128],[136,128],[272,128]], h:288 },
    die:   { file:'r1_die.png',   frames:[[0,112],[120,112]], h:288 },
  },
  r2: {
    h: 320,
    stand: { file:'r2_stand.png', x:0, w:120 },
    ready: { file:'r2_ready.png', x:0, w:120 },
    shoot: { file:'r2_shoot.png', x:0, w:120 },
    walk:  { file:'r2_walk.png',  frames:[[0,104],[112,104],[224,104]], h:320 },
    die:   { file:'r2_die.png',   frames:[[0,128],[136,64]], h:320 },
  },
  r3: {
    h: 256,
    stand: { file:'r3_stand.png', x:0, w:132 },
    ready: { file:'r3_ready.png', x:0, w:132 },
    shoot: { file:'r3_shoot.png', x:0, w:132 },
    walk:  { file:'r3_walk.png',  frames:[[0,128],[136,128],[272,128]], h:256 },
    die:   { file:'r3_die.png',   frames:[[0,128],[136,116]], h:256 },
  },
  r4: {
    h: 276,
    stand: { file:'r4_stand.png', x:0, w:124 },
    ready: { file:'r4_ready.png', x:0, w:124 },
    shoot: { file:'r4_shoot.png', x:0, w:124 },
    walk:  { file:'r4_walk.png',  frames:[[0,128],[136,128],[272,128]], h:276 },
    die:   { file:'r4_die.png',   frames:[[0,128],[136,128],[272,80]], h:276 },
  },
};

// Preload all sprite images
const LOADED_IMGS = {};
function loadSpriteImage(file) {
  if (!LOADED_IMGS[file]) {
    const img = new Image();
    img.src = 'img/sprites/' + file;
    LOADED_IMGS[file] = img;
  }
  return LOADED_IMGS[file];
}
// Preload all
Object.values(SPRITE_DEFS).forEach(def => {
  ['stand','ready','shoot'].forEach(k => loadSpriteImage(def[k].file));
  loadSpriteImage(def.walk.file);
  loadSpriteImage(def.die.file);
});

// ── LEVELS ───────────────────────────────────────────────────────────────────
const LEVELS = [
  { name:'Level 1', spriteKey:'r0', walkMs:4500, waitMin:1200, waitMax:3500, gunSec:1.30, pts:10 },
  { name:'Level 2', spriteKey:'r1', walkMs:3500, waitMin:800,  waitMax:2500, gunSec:1.50, pts:20 },
  { name:'Level 3', spriteKey:'r2', walkMs:2500, waitMin:500,  waitMax:1800, gunSec:1.20, pts:30 },
  { name:'Level 4', spriteKey:'r3', walkMs:2000, waitMin:400,  waitMax:1500, gunSec:0.90, pts:40 },
  { name:'Level 5', spriteKey:'r4', walkMs:1500, waitMin:300,  waitMax:1200, gunSec:0.70, pts:50 },
];

// ── SPRITE RENDERING VIA CANVAS ───────────────────────────────────────────────
const SPRITE_SCALE = 0.75;

const canvas  = document.getElementById('gunman-canvas');
const ctx     = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let spriteState  = 'walk';
let walkFrame    = 0;
let dieFrame     = 0;
let canvasLeft   = -200;
let walkAnimId   = null;
let dieAnimId    = null;

function getCurrentDef() { return SPRITE_DEFS[LEVELS[currentLevel].spriteKey]; }

function renderSprite() {
  const def = getCurrentDef();

  let srcImg, srcX, srcW, srcH;
  srcH = def.h;

  if (spriteState === 'walk') {
    const frame = def.walk.frames[walkFrame % def.walk.frames.length];
    srcImg = loadSpriteImage(def.walk.file);
    srcX = frame[0]; srcW = frame[1];
  } else if (spriteState === 'stand') {
    srcImg = loadSpriteImage(def.stand.file);
    srcX = def.stand.x; srcW = def.stand.w;
  } else if (spriteState === 'ready') {
    srcImg = loadSpriteImage(def.ready.file);
    srcX = def.ready.x; srcW = def.ready.w;
  } else if (spriteState === 'shoot') {
    srcImg = loadSpriteImage(def.shoot.file);
    srcX = def.shoot.x; srcW = def.shoot.w;
  } else { // die
    const frame = def.die.frames[Math.min(dieFrame, def.die.frames.length - 1)];
    srcImg = loadSpriteImage(def.die.file);
    srcX = frame[0]; srcW = frame[1];
  }

  const displayW = Math.round(srcW * SPRITE_SCALE);
  const displayH = Math.round(srcH * SPRITE_SCALE);

  canvas.width  = displayW;
  canvas.height = displayH;
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(srcImg, srcX, 0, srcW, srcH, 0, 0, displayW, displayH);

  // Position: bottom of sprite on ground line
  const groundY = 297;
  canvas.style.left   = canvasLeft + 'px';
  canvas.style.bottom = (480 - groundY) + 'px';
}

function stopWalkAnim() { if (walkAnimId) { clearInterval(walkAnimId); walkAnimId = null; } }
function stopDieAnim()  { if (dieAnimId)  { clearInterval(dieAnimId);  dieAnimId  = null; } }

function startWalkAnim() {
  stopWalkAnim(); stopDieAnim();
  walkFrame = 0;
  spriteState = 'walk';
  walkAnimId = setInterval(() => {
    const def = getCurrentDef();
    walkFrame = (walkFrame + 1) % def.walk.frames.length;
    renderSprite();
  }, 120);
  renderSprite();
}

function showStand()  { stopWalkAnim(); stopDieAnim(); spriteState='stand'; renderSprite(); }
function showReady()  { stopWalkAnim(); stopDieAnim(); spriteState='ready'; renderSprite(); }
function showShoot()  { stopWalkAnim(); stopDieAnim(); spriteState='shoot'; renderSprite(); }

function startDieAnim(cb) {
  stopWalkAnim(); stopDieAnim();
  const def = getCurrentDef();
  spriteState = 'die';
  dieFrame = 0;
  renderSprite();
  dieAnimId = setInterval(() => {
    dieFrame++;
    if (dieFrame >= def.die.frames.length) {
      stopDieAnim();
      if (cb) cb();
      return;
    }
    renderSprite();
  }, 200);
}

// ── STATE ────────────────────────────────────────────────────────────────────
let currentLevel = 0;
let score        = 0;
let phase        = 'idle';
let playerTime   = 0;
let rafId        = null;
let timerStart   = 0;
let pending      = null;

function rand(min,max) { return Math.random()*(max-min)+min; }
function clearPending() { if(pending!==null){clearTimeout(pending);pending=null;} }
function after(ms,fn)   { clearPending(); pending=setTimeout(fn,ms); }

function showScreen(el) {
  [screenMenu,screenGame,screenWin].forEach(s=>s.classList.add('hidden'));
  el.classList.remove('hidden');
}
function showMsg(t,c)  { msgEl.textContent=t; msgEl.style.color=c||'#fff'; msgEl.style.display=t?'block':'none'; }
function showFire(on)  { msgFire.style.display=on?'block':'none'; }
function updateHUD()   { scoreNumEl.textContent=score; levelLabelEl.textContent=LEVELS[currentLevel].name; timerGunEl.textContent=LEVELS[currentLevel].gunSec.toFixed(2); }

function startTimer() {
  timerStart=performance.now();
  function tick(){playerTime=(performance.now()-timerStart)/1000;timerYouEl.textContent=playerTime.toFixed(2);rafId=requestAnimationFrame(tick);}
  rafId=requestAnimationFrame(tick);
}
function stopTimer() { if(rafId){cancelAnimationFrame(rafId);rafId=null;} }

// ── GAME FLOW ─────────────────────────────────────────────────────────────────
function startGame() {
  stopAll(); stopTimer(); clearPending();
  stopWalkAnim(); stopDieAnim();
  currentLevel=0; score=0;
  showScreen(screenGame);
  updateHUD();
  timerYouEl.textContent='0.00';
  play('intro');
  after(3200, beginRound);
}

function beginRound() {
  stopTimer(); clearPending(); stopWalkAnim(); stopDieAnim();
  phase='idle';

  showMsg(''); showFire(false);
  gameArea.classList.remove('death-flash');
  btnRestart.classList.add('hidden');
  btnNext.classList.add('hidden');
  timerYouEl.textContent='0.00';
  playerTime=0;
  updateHUD();

  // Gunman starts from right edge, walks left to center
  canvasLeft = 896;
  renderSprite();

  after(100, moveGunman);
}

function moveGunman() {
  phase='walking';
  const lvl=LEVELS[currentLevel];
  play('wait');

  startWalkAnim();

  // Walk from right edge (896) to center (383)
  const startX   = 896;
  const endX     = 383;
  const duration = lvl.walkMs;
  const t0       = performance.now();

  function walkTick(now) {
    const elapsed = now - t0;
    const progress = Math.min(elapsed / duration, 1);
    canvasLeft = startX + (endX - startX) * progress;
    renderSprite();
    if (progress < 1) {
      requestAnimationFrame(walkTick);
    } else {
      canvasLeft = endX;
      gunmanArrived();
    }
  }
  requestAnimationFrame(walkTick);
}

function gunmanArrived() {
  phase='waiting';
  const lvl=LEVELS[currentLevel];

  showStand();

  const waitMs=rand(lvl.waitMin, lvl.waitMax);
  after(waitMs, fireDuel);
}

function fireDuel() {
  if(phase!=='waiting') return;
  phase='duel';
  const lvl=LEVELS[currentLevel];

  showFire(true);
  play('fire');
  showReady();
  startTimer();

  after(lvl.gunSec*1000, gunmanWins);
}

function gunmanWins() {
  if(phase!=='duel') return;
  phase='result';
  stopTimer(); clearPending(); showFire(false);

  showShoot();
  play('shot');
  showMsg('YOU DIED','#ff3030');
  gameArea.classList.add('death-flash');
  setTimeout(()=>play('death'),350);

  btnRestart.classList.remove('hidden');
}

function playerClicks(e) {
  if(e.target.closest('.btn')) return;

  if(phase==='duel') {
    phase='result';
    stopTimer(); clearPending(); showFire(false);

    play('shot-fall');
    startDieAnim(null);
    showMsg('YOU WIN!','#80d010');

    score += Math.max(1, Math.round(LEVELS[currentLevel].pts / Math.max(playerTime,0.01)));
    updateHUD();
    btnNext.classList.remove('hidden');

  } else if(phase==='waiting') {
    phase='result';
    clearPending(); showFire(false);
    play('foul');
    showMsg('FOUL!','#ff8800');
    btnRestart.classList.remove('hidden');
  }
}

function onRestart() {
  stopAll(); stopTimer(); clearPending(); stopWalkAnim(); stopDieAnim();
  showMsg(''); showFire(false);
  gameArea.classList.remove('death-flash');
  btnRestart.classList.add('hidden');
  btnNext.classList.add('hidden');
  play('intro');
  after(2000, beginRound);
}

function onNext() {
  stopAll(); stopTimer(); clearPending(); stopWalkAnim(); stopDieAnim();
  btnRestart.classList.add('hidden');
  btnNext.classList.add('hidden');
  currentLevel++;
  if(currentLevel>=LEVELS.length){showWin();return;}
  play('intro');
  after(2000, beginRound);
}

function showWin() {
  stopAll(); play('win');
  winScoreEl.textContent=score;
  showScreen(screenWin);
}

// ── LISTENERS ────────────────────────────────────────────────────────────────
btnStart.addEventListener('click',     startGame);
btnRestart.addEventListener('click',   onRestart);
btnNext.addEventListener('click',      onNext);
btnPlayAgain.addEventListener('click', startGame);
gameArea.addEventListener('click',     playerClicks);

showScreen(screenMenu);
