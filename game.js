/* NEON DRIFT — ZIUL · twin-stick arena shooter
 * Gamepad API (DualSense/Xbox), teclado+mouse e toque.
 */
(() => {
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = '#05060d'; ctx.fillRect(0,0,W,H);
}
window.addEventListener('resize', resize); resize();

const $ = id => document.getElementById(id);
const COL = {cyan:'#00f0ff',pink:'#ff2bd6',yellow:'#ffe14d',green:'#3dff8a',orange:'#ff8a1f',purple:'#a35bff',white:'#ffffff',red:'#ff3b5c',blue:'#5b8cff'};
const WAVE_LEN = 22;

// ---------- storage ----------
function load(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } }
function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
let top5 = load('nd_top5', []);
const legacy = load('neondrift_hs', 0);
if(!top5.length && legacy) top5 = [{s:legacy, w:0}];
let best = top5.length ? top5[0].s : 0;
const opts = Object.assign({sound:true, vibe:true}, load('nd_opts', {}));

// ---------- audio ----------
let AC = null;
function audioOn(){
  try{
    if(!AC){ const A = window.AudioContext || window.webkitAudioContext; if(A) AC = new A(); }
    if(AC && AC.state === 'suspended') AC.resume().catch(()=>{});
  }catch(e){}
}
function tone(f1,f2,dur,type='square',vol=0.06){
  if(!opts.sound || !AC || AC.state !== 'running') return;
  try{
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t+dur+0.02);
  }catch(e){}
}
let noiseBuf = null;
function noise(dur,vol=0.12,freq=1200){
  if(!opts.sound || !AC || AC.state !== 'running') return;
  try{
    if(!noiseBuf){ const n = AC.sampleRate; noiseBuf = AC.createBuffer(1,n,n); const d = noiseBuf.getChannelData(0); for(let i=0;i<n;i++) d[i] = Math.random()*2-1; }
    const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter(), t = AC.currentTime;
    f.type='lowpass'; f.frequency.value = freq;
    s.buffer = noiseBuf; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f).connect(g).connect(AC.destination); s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  }catch(e){}
}
let lastShotSnd = 0;

// ---------- gamepad ----------
let pad = null, padBlocked = false, prevBtn = [];
function pollPad(){
  let list = [];
  try { list = navigator.getGamepads ? navigator.getGamepads() : []; padBlocked = false; }
  catch(e){ padBlocked = true; list = []; }
  pad = null;
  for(const g of list){ if(g && g.connected){ pad = g; break; } }
  return pad;
}
function btn(i){ return !!(pad && pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5)); }
function btnVal(i){ return pad && pad.buttons[i] ? pad.buttons[i].value : 0; }
function pressed(i){ return btn(i) && !prevBtn[i]; }
function rumble(ms, strong, weak){
  if(!opts.vibe) return;
  try{
    const a = pad && pad.vibrationActuator;
    if(a && a.playEffect) a.playEffect('dual-rumble',{startDelay:0,duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{});
  }catch(e){}
  try{ if(!pad && navigator.vibrate && touchMode) navigator.vibrate(Math.min(ms,60)); }catch(e){}
}
function dz(x,y,d=0.18){
  const m = Math.hypot(x,y); if(m < d) return [0,0];
  const s = Math.min(1,(m-d)/(1-d)) / m; return [x*s,y*s];
}
function padName(g){
  const id = (g && g.id || '').toLowerCase();
  if(id.includes('dualsense') || id.includes('0ce6') || id.includes('0df2')) return 'DualSense';
  if(id.includes('dualshock') || id.includes('054c') || id.includes('wireless controller')) return 'Controle PlayStation';
  if(id.includes('xbox') || id.includes('045e')) return 'Controle Xbox';
  return 'Controle';
}
window.addEventListener('gamepadconnected', e => { toast('🎮 ' + padName(e.gamepad) + ' conectado'); setTouchUI(false); updateStatus(); });
window.addEventListener('gamepaddisconnected', () => { toast('Controle desconectado'); if(state==='play') setState('pause'); updateStatus(); });

function updateStatus(){
  const s = $('padStatus'), t = $('padText');
  s.classList.remove('on','warn');
  if(padBlocked){ s.classList.add('warn'); t.textContent = 'Controle bloqueado aqui — abra no Chrome/Safari'; return; }
  if(pad){ s.classList.add('on'); t.textContent = padName(pad) + ' pronto!'; }
  else t.textContent = 'Conecte o DualSense e aperte qualquer botão';
}

// ---------- keyboard / mouse ----------
const keys = {}; const keyEdge = {};
const mouse = {x:0,y:0,down:false,active:false};
window.addEventListener('keydown', e => { if(!keys[e.code]) keyEdge[e.code] = true; keys[e.code] = true; audioOn(); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
cv.addEventListener('mousedown', () => { mouse.down = true; mouse.active = true; audioOn(); });
window.addEventListener('mouseup', () => mouse.down = false);
function kEdge(c){ const v = keyEdge[c]; keyEdge[c] = false; return !!v; }

// ---------- touch ----------
let touchMode = false;
const sticks = { L:{id:null,ox:0,oy:0,x:0,y:0}, R:{id:null,ox:0,oy:0,x:0,y:0} };
let tDashFlag = false, tBombFlag = false;
function setTouchUI(on){
  touchMode = on;
  const show = on && state === 'play';
  ['tDash','tBomb','tPause'].forEach(id => $(id).style.display = show ? 'flex' : 'none');
}
cv.addEventListener('touchstart', e => {
  e.preventDefault(); audioOn();
  if(!pad) setTouchUI(true);
  for(const t of e.changedTouches){
    const side = t.clientX < W/2 ? 'L' : 'R', s = sticks[side];
    if(s.id === null){ s.id = t.identifier; s.ox = s.x = t.clientX; s.oy = s.y = t.clientY; }
  }
},{passive:false});
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for(const t of e.changedTouches) for(const k of ['L','R']){ const s = sticks[k]; if(s.id === t.identifier){ s.x = t.clientX; s.y = t.clientY; } }
},{passive:false});
function tEnd(e){ for(const t of e.changedTouches) for(const k of ['L','R']) if(sticks[k].id === t.identifier) sticks[k].id = null; }
cv.addEventListener('touchend', tEnd); cv.addEventListener('touchcancel', tEnd);
function stickVec(s){ if(s.id === null) return [0,0]; let dx = s.x-s.ox, dy = s.y-s.oy; const m = Math.hypot(dx,dy), R = 55;
  if(m > R){ s.ox = s.x - dx/m*R; s.oy = s.y - dy/m*R; dx = dx/m*R; dy = dy/m*R; } return dz(dx/R, dy/R, 0.12); }
$('tDash').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); tDashFlag = true; }, {passive:false});
$('tBomb').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); tBombFlag = true; }, {passive:false});
$('tPause').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if(state==='play') setState('pause'); }, {passive:false});

// ---------- UI ----------
let toastT = 0;
function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200); }
let bannerT = 0;
function banner(msg, color){ const b = $('banner'); b.textContent = msg; b.style.color = color || COL.cyan; b.style.textShadow = '0 0 24px ' + (color||COL.cyan); b.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(()=>b.style.opacity = 0, 1500); }

function renderOpts(){
  $('optSound').classList.toggle('off', !opts.sound);
  $('optVibe').classList.toggle('off', !opts.vibe);
}
function toggleOpt(k){
  opts[k] = !opts[k]; save('nd_opts', opts); renderOpts();
  toast((k === 'sound' ? 'Som ' : 'Vibração ') + (opts[k] ? 'ligado' : 'desligado'));
  if(k === 'vibe' && opts.vibe) rumble(150, 0.5, 0.5);
  if(k === 'sound' && opts.sound){ audioOn(); tone(600, 900, 0.12, 'triangle', 0.06); }
}
async function goFullscreen(){
  try{
    const el = document.documentElement;
    if(!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({navigationUI:'hide'});
    else if(document.fullscreenElement) await document.exitFullscreen();
    if(screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(()=>{});
  }catch(e){ toast('Tela cheia não suportada aqui'); }
}
$('optSound').addEventListener('click', () => toggleOpt('sound'));
$('optVibe').addEventListener('click', () => toggleOpt('vibe'));
$('optFull').addEventListener('click', goFullscreen);
if(!document.documentElement.requestFullscreen) $('optFull').style.display = 'none';
renderOpts();

let state = 'menu';
function setState(s){
  state = s;
  $('menu').classList.toggle('show', s === 'menu');
  $('pause').classList.toggle('show', s === 'pause');
  $('over').classList.toggle('show', s === 'over');
  $('hud').style.display = (s === 'play' || s === 'pause') ? 'block' : 'none';
  $('bossbar').style.display = (boss && (s === 'play' || s === 'pause')) ? 'block' : 'none';
  setTouchUI(touchMode && !pad);
  if(s === 'menu') updateStatus();
}
$('startBtn').addEventListener('click', () => { audioOn(); startGame(); });
$('againBtn').addEventListener('click', () => { audioOn(); startGame(); });
$('resumeBtn').addEventListener('click', () => { audioOn(); setState('play'); });
$('menuBtn').addEventListener('click', () => setState('menu'));
$('pauseMenuBtn').addEventListener('click', () => { boss = null; setState('menu'); });
['startBtn','againBtn','resumeBtn'].forEach(id => $(id).addEventListener('touchstart', () => { touchMode = !pad; }, {passive:true}));

// ---------- game state ----------
let P = null, bullets = [], ebullets = [], enemies = [], parts = [], rings = [], pickups = [], floats = [], stars = [];
let score, mult, combo, comboT, wave, waveT, spawnT, shake, nextLife, kills, flash, fireT, time, boss = null, bossesKilled = 0;
const power = {rapid:0, spread:0, shield:0};

for(let i=0;i<90;i++) stars.push({x:Math.random(), y:Math.random(), z:Math.random()*0.8+0.2});

function startGame(){
  P = {x:W/2, y:H/2, vx:0, vy:0, a:-Math.PI/2, r:12, dashT:0, dashCd:0, inv:2, lives:3, bombs:3};
  bullets = []; ebullets = []; enemies = []; parts = []; rings = []; pickups = []; floats = [];
  score = 0; mult = 1; combo = 0; comboT = 0; wave = 1; waveT = 0; spawnT = 1.2; shake = 0; nextLife = 25000; kills = 0; flash = 0; fireT = 0; time = 0;
  boss = null; bossesKilled = 0; power.rapid = power.spread = power.shield = 0;
  setState('play');
  banner('ONDA 1');
  hud();
}

const PW_INFO = {rapid:{l:'RAJADA',c:COL.yellow,t:10}, spread:{l:'LEQUE',c:COL.pink,t:10}, shield:{l:'ESCUDO',c:COL.cyan,t:8}};
function hud(){
  $('score').textContent = score.toLocaleString('pt-BR');
  $('best').textContent = 'RECORDE ' + Math.max(best,score).toLocaleString('pt-BR');
  $('mult').textContent = 'x' + mult;
  $('wave').textContent = boss ? 'CHEFÃO' : 'ONDA ' + wave;
  $('lives').textContent = '♥'.repeat(Math.max(0,P.lives));
  $('bombs').textContent = '◆'.repeat(Math.max(0,P.bombs));
  let h = '';
  for(const k in PW_INFO) if(power[k] > 0) h += `<span class="pw" style="color:${PW_INFO[k].c}">${PW_INFO[k].l}<i style="width:${Math.min(100,power[k]/PW_INFO[k].t*100)}%"></i></span>`;
  $('powers').innerHTML = h;
  if(boss) $('bossfill').style.width = Math.max(0, boss.hp/boss.maxhp*100) + '%';
}

// ---------- entities ----------
const ETYPES = {
  chaser:   {r:12, hp:1, pts:50,  col:COL.pink},
  wanderer: {r:13, hp:1, pts:25,  col:COL.green},
  splitter: {r:19, hp:3, pts:100, col:COL.orange},
  mini:     {r:8,  hp:1, pts:30,  col:COL.orange},
  shooter:  {r:15, hp:2, pts:150, col:COL.purple},
  dasher:   {r:13, hp:2, pts:120, col:COL.blue},
  tank:     {r:26, hp:12,pts:500, col:COL.red},
};
function makeEnemy(type, x, y, spawn=0.7){
  const d = ETYPES[type];
  return {type, x, y, vx:0, vy:0, r:d.r, hp:d.hp, maxhp:d.hp, col:d.col, pts:d.pts, spawn, a:Math.random()*6.28, t:Math.random()*10, cd:1.5+Math.random()*1.5, hit:0, mode:0, mt:1+Math.random()*1.5, tx:0, ty:0};
}
function edgePoint(minDist=240){
  let x, y, tries = 0; const m = 30;
  do {
    const side = Math.random()*4|0;
    if(side === 0){ x = Math.random()*W; y = m + 40; }
    else if(side === 1){ x = W-m; y = Math.random()*H; }
    else if(side === 2){ x = Math.random()*W; y = H-m; }
    else { x = m; y = Math.random()*H; }
  } while(Math.hypot(x-P.x, y-P.y) < minDist && tries++ < 12);
  return [x,y];
}
function spawnEnemy(){
  const lv = wave - 1, r = Math.random(); let type;
  if(lv >= 5 && r < 0.05) type = 'tank';
  else if(lv >= 2 && r < 0.16) type = 'shooter';
  else if(lv >= 3 && r < 0.28) type = 'dasher';
  else if(lv >= 1 && r < 0.42) type = 'splitter';
  else if(r < 0.72) type = 'chaser';
  else type = 'wanderer';
  const [x,y] = edgePoint();
  enemies.push(makeEnemy(type, x, y));
}
// formação em anel ao redor do jogador (a partir da onda 3)
function spawnRing(){
  const n = 10 + wave, R = Math.min(W,H)*0.42;
  for(let i=0;i<n;i++){
    const a = i/n*Math.PI*2;
    const x = Math.max(20, Math.min(W-20, P.x + Math.cos(a)*R)), y = Math.max(60, Math.min(H-20, P.y + Math.sin(a)*R));
    enemies.push(makeEnemy('chaser', x, y, 1.0));
  }
  tone(200, 400, 0.4, 'sawtooth', 0.04);
}

function spawnBoss(){
  const lvl = Math.floor(wave/5);
  const hp = 160 + lvl*90;
  boss = {x:W/2, y:-80, r:46, hp, maxhp:hp, a:0, t:0, phase:0, cd:2, pat:0, hit:0, enter:true, lvl};
  $('bossbar').style.display = 'block';
  banner('⚠ CHEFÃO ⚠', COL.red);
  rumble(700, 0.8, 0.8); noise(1.2, 0.15, 400); tone(80, 40, 1.2, 'sawtooth', 0.1);
}

function burst(x, y, col, n=18, spd=6, life=0.6){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = spd*(0.3+Math.random());
    parts.push({x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:life*(0.5+Math.random()*0.7), max:life, col, w:1.5+Math.random()*1.5});
  }
}
function ring(x, y, col, maxR=60, life=0.4){ rings.push({x,y,col,r:4,maxR,life,max:life}); }
function floatText(x, y, txt, col){ floats.push({x, y, txt, col, life:0.9}); }

function dropPickup(x, y, force){
  if(!force && Math.random() > 0.07) return;
  const r = Math.random();
  const type = r < 0.32 ? 'rapid' : r < 0.62 ? 'spread' : r < 0.86 ? 'shield' : 'bomb';
  pickups.push({x, y, type, life:9, t:0});
}
const PK_COL = {rapid:COL.yellow, spread:COL.pink, shield:COL.cyan, bomb:COL.orange};
const PK_TXT = {rapid:'R', spread:'S', shield:'O', bomb:'◆'};

function addScore(pts, x, y){
  const v = pts * mult; score += v;
  if(x !== undefined && v >= 100) floatText(x, y, '+' + v, mult > 1 ? COL.yellow : '#cfe');
  if(score >= nextLife){ nextLife += 25000; P.lives = Math.min(6, P.lives+1); toast('+1 VIDA ♥'); tone(600,1200,0.3,'triangle',0.08); }
}

function killEnemy(e, i, viaBomb){
  enemies.splice(i,1);
  burst(e.x, e.y, e.col, e.type==='tank'?60:e.r>15?30:18, e.type==='tank'?9:6);
  ring(e.x, e.y, e.col, e.r*3.5);
  combo++; comboT = 2;
  mult = Math.min(10, 1 + Math.floor(combo/12));
  addScore(e.pts, e.x, e.y); kills++;
  if(e.type === 'splitter') for(let k=0;k<3;k++){ const a = k*2.094 + Math.random(); const m = makeEnemy('mini', e.x+Math.cos(a)*10, e.y+Math.sin(a)*10, 0); m.vx = Math.cos(a)*5; m.vy = Math.sin(a)*5; enemies.push(m); }
  if(e.type === 'tank'){ shake = Math.max(shake, 14); rumble(250, 0.9, 0.6); noise(0.5, 0.2); dropPickup(e.x, e.y, true); }
  else if(!viaBomb){ shake = Math.max(shake, e.r>15?6:3); rumble(70, 0.15, 0.45); noise(0.18, 0.07); dropPickup(e.x, e.y); }
}

function killBoss(){
  const b = boss;
  addScore(10000 * (b.lvl), b.x, b.y);
  floatText(b.x, b.y - 30, 'CHEFÃO DESTRUÍDO', COL.red);
  for(let i=0;i<6;i++) setTimeout(() => { burst(b.x + (Math.random()-0.5)*80, b.y + (Math.random()-0.5)*80, [COL.red,COL.pink,COL.yellow][i%3], 50, 10, 1.1); noise(0.5,0.18,800); }, i*120);
  ring(b.x, b.y, COL.white, Math.max(W,H), 0.9);
  shake = 30; flash = 0.6;
  rumble(1200, 1, 1); tone(400, 40, 1.5, 'sawtooth', 0.12);
  dropPickup(b.x-30, b.y, true); dropPickup(b.x+30, b.y, true);
  pickups.push({x:b.x, y:b.y+30, type:'bomb', life:12, t:0});
  boss = null; bossesKilled++; ebullets = [];
  $('bossbar').style.display = 'none';
  P.lives = Math.min(6, P.lives + 1); toast('+1 VIDA ♥');
  wave++; waveT = 0; spawnT = 2.5;
  setTimeout(() => { if(state === 'play') banner('ONDA ' + wave); }, 1600);
}

function playerHit(){
  if(P.inv > 0 || P.dashT > 0) return;
  if(power.shield > 0){
    power.shield = 0; P.inv = 1.2; shake = 10;
    ring(P.x, P.y, COL.cyan, 160, 0.4); rumble(200, 0.6, 0.4); tone(900, 200, 0.3, 'triangle', 0.08);
    for(let i=enemies.length-1;i>=0;i--){ const e = enemies[i]; if(Math.hypot(e.x-P.x,e.y-P.y) < 120) killEnemy(e, i, true); }
    toast('Escudo quebrou!');
    return;
  }
  P.lives--; P.inv = 2.2; combo = 0; mult = 1; flash = 0.5; shake = 22;
  rumble(450, 1.0, 1.0); noise(0.6, 0.22); tone(300, 40, 0.5, 'sawtooth', 0.09);
  burst(P.x, P.y, COL.cyan, 50, 9, 0.9); ring(P.x, P.y, COL.white, 220, 0.5);
  for(let i=enemies.length-1;i>=0;i--){ const e = enemies[i]; if(Math.hypot(e.x-P.x,e.y-P.y) < 200){ burst(e.x,e.y,e.col,12); enemies.splice(i,1); } }
  ebullets = [];
  if(P.lives <= 0) gameOver();
}

function useBomb(){
  if(P.bombs <= 0) { tone(150,100,0.1,'square',0.04); return; }
  P.bombs--; shake = 26; flash = 0.35;
  rumble(600, 1.0, 0.8); noise(0.8, 0.25); tone(200, 30, 0.8, 'sawtooth', 0.1);
  ring(P.x, P.y, COL.orange, Math.max(W,H), 0.7); ring(P.x, P.y, COL.yellow, Math.max(W,H)*0.7, 0.55);
  for(let i=enemies.length-1;i>=0;i--) killEnemy(enemies[i], i, true);
  if(boss && !boss.enter){ boss.hp -= boss.maxhp*0.12; boss.hit = 0.2; if(boss.hp <= 0) killBoss(); }
  ebullets = [];
}

function gameOver(){
  top5.push({s:score, w:wave, d:Date.now()});
  top5.sort((a,b) => b.s - a.s); top5 = top5.slice(0,5); save('nd_top5', top5);
  const isRec = score > best && score > 0;
  if(score > best) best = score;
  $('finalScore').textContent = score.toLocaleString('pt-BR');
  $('recText').textContent = isRec ? '★ NOVO RECORDE ★' : '';
  let mine = false;
  $('topList').innerHTML = '<div class="t">TOP 5</div>' + top5.map((e,i) => {
    const me = !mine && e.s === score && e.w === wave; if(me) mine = true;
    return `<li class="${me?'me':''}"><span>${i+1}. ${e.s.toLocaleString('pt-BR')}</span><span>onda ${e.w||'-'}</span></li>`;
  }).join('');
  const s = Math.floor(time);
  $('overStats').textContent = `Onda ${wave} · ${kills} abates · ${bossesKilled} chefões · ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  state = 'dying';
  $('bossbar').style.display = 'none';
  setTimeout(() => { if(state === 'dying') setState('over'); }, 900);
}

// ---------- input frame ----------
function readInput(){
  const inp = {mx:0,my:0,ax:0,ay:0,fire:false,dash:false,bomb:false,pause:false,start:false,back:false,sq:false};
  if(pad){
    const [lx,ly] = dz(pad.axes[0]||0, pad.axes[1]||0);
    const [rx,ry] = dz(pad.axes[2]||0, pad.axes[3]||0, 0.25);
    inp.mx = lx; inp.my = ly;
    if(btn(14)) inp.mx = -1; if(btn(15)) inp.mx = 1; if(btn(12)) inp.my = -1; if(btn(13)) inp.my = 1;
    inp.ax = rx; inp.ay = ry;
    inp.fire = Math.hypot(rx,ry) > 0.3 || btnVal(7) > 0.2 || btn(5);
    inp.dash = pressed(0) || pressed(6) || pressed(4);
    inp.bomb = pressed(3);
    inp.pause = pressed(9);
    inp.start = pressed(0) || pressed(9);
    inp.back = pressed(1);
    inp.sq = pressed(2);
  }
  let kx = (keys.KeyD||keys.ArrowRight?1:0) - (keys.KeyA||keys.ArrowLeft?1:0);
  let ky = (keys.KeyS||keys.ArrowDown?1:0) - (keys.KeyW||keys.ArrowUp?1:0);
  if(kx || ky){ const m = Math.hypot(kx,ky); inp.mx = kx/m; inp.my = ky/m; }
  if(mouse.active && mouse.down && P){ const dx = mouse.x-P.x, dy = mouse.y-P.y, m = Math.hypot(dx,dy)||1; inp.ax = dx/m; inp.ay = dy/m; inp.fire = true; }
  if(kEdge('Space') || kEdge('ShiftLeft')) inp.dash = true;
  if(kEdge('KeyE') || kEdge('KeyQ')) inp.bomb = true;
  if(kEdge('Escape') || kEdge('KeyP')) inp.pause = true;
  if(kEdge('Enter')) inp.start = true;
  if(kEdge('Backspace')) inp.back = true;
  if(touchMode){
    const [tx,ty] = stickVec(sticks.L); const [ux,uy] = stickVec(sticks.R);
    if(tx || ty){ inp.mx = tx; inp.my = ty; }
    if(sticks.R.id !== null && (ux || uy)){ inp.ax = ux; inp.ay = uy; inp.fire = true; }
    if(tDashFlag){ inp.dash = true; tDashFlag = false; }
    if(tBombFlag){ inp.bomb = true; tBombFlag = false; }
  }
  return inp;
}

// ---------- boss ----------
function bossFire(a, spd, col){ ebullets.push({x:boss.x + Math.cos(a)*boss.r, y:boss.y + Math.sin(a)*boss.r, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, life:6, col}); }
function updateBoss(dt, k){
  const b = boss; b.t += dt; b.hit = Math.max(0, b.hit - dt); b.a += 0.01*k;
  if(b.enter){ b.y += (H*0.3 - b.y)*0.03*k; if(Math.abs(b.y - H*0.3) < 3) b.enter = false; return; }
  const ratio = b.hp / b.maxhp;
  b.phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
  // movimento em lemniscata
  const tx = W/2 + Math.sin(b.t*0.5) * W*0.3, ty = H*0.32 + Math.sin(b.t)*H*0.12;
  b.x += (tx - b.x)*0.02*k; b.y += (ty - b.y)*0.02*k;
  b.cd -= dt;
  if(b.cd <= 0){
    const sp = 3.2 + b.lvl*0.3 + b.phase*0.4;
    b.pat = (b.pat + 1) % 3;
    if(b.pat === 0){ // anel
      const n = 16 + b.phase*6; for(let i=0;i<n;i++) bossFire(i/n*Math.PI*2 + b.t, sp, COL.red);
      b.cd = 1.6 - b.phase*0.3; tone(300, 150, 0.2, 'sawtooth', 0.04);
    } else if(b.pat === 1){ // rajada mirada
      const a0 = Math.atan2(P.y-b.y, P.x-b.x);
      for(let j=0;j<4+b.phase*2;j++) setTimeout(() => { if(!boss) return; for(let s=-1;s<=1;s++) bossFire(Math.atan2(P.y-boss.y,P.x-boss.x) + s*0.18, sp+1.5, COL.pink); tone(700,300,0.06,'square',0.03); }, j*140);
      b.cd = 1.8 - b.phase*0.3;
    } else { // espiral ou invocação
      if(b.phase >= 1 && Math.random() < 0.5){
        for(let i=0;i<4+b.phase*2;i++){ const a = i*1.3; enemies.push(makeEnemy(Math.random()<0.5?'chaser':'dasher', b.x+Math.cos(a)*60, b.y+Math.sin(a)*60, 0.5)); }
        b.cd = 1.4;
      } else {
        for(let i=0;i<24;i++) setTimeout(() => { if(boss) bossFire(boss.t*3 + i*0.5, sp*0.9, COL.purple); }, i*50);
        b.cd = 2.2 - b.phase*0.3;
      }
    }
  }
  if(Math.hypot(P.x-b.x, P.y-b.y) < b.r + P.r - 4) playerHit();
}

// ---------- update ----------
function update(dt, inp){
  const k = dt * 60;
  time += dt;
  for(const p in power) power[p] = Math.max(0, power[p] - dt);

  // ondas
  if(!boss){
    waveT += dt;
    if(waveT >= WAVE_LEN){
      wave++; waveT = 0;
      if(wave % 5 === 0) spawnBoss();
      else { banner('ONDA ' + wave, wave%2 ? COL.pink : COL.cyan); tone(400, 900, 0.35, 'triangle', 0.07); rumble(120, 0.2, 0.5); if(wave >= 3 && Math.random() < 0.6) setTimeout(() => { if(state==='play' && !boss) spawnRing(); }, 1500); }
    }
  }

  // jogador
  P.dashCd = Math.max(0, P.dashCd - dt);
  P.inv = Math.max(0, P.inv - dt);
  if(inp.dash && P.dashCd <= 0){
    let dx = inp.mx, dy = inp.my;
    if(!dx && !dy){ dx = Math.cos(P.a); dy = Math.sin(P.a); }
    const m = Math.hypot(dx,dy)||1;
    P.vx = dx/m*17; P.vy = dy/m*17; P.dashT = 0.18; P.dashCd = 0.9;
    rumble(90, 0.4, 0.2); tone(700, 200, 0.15, 'triangle', 0.06); ring(P.x, P.y, COL.cyan, 40, 0.25);
  }
  if(P.dashT > 0){
    P.dashT -= dt;
    parts.push({x:P.x, y:P.y, vx:-P.vx*0.1, vy:-P.vy*0.1, life:0.3, max:0.3, col:COL.cyan, w:4});
  } else {
    const sp = 5.4;
    P.vx += (inp.mx*sp - P.vx) * Math.min(1, 0.22*k);
    P.vy += (inp.my*sp - P.vy) * Math.min(1, 0.22*k);
  }
  P.x += P.vx * k; P.y += P.vy * k;
  P.x = Math.max(P.r, Math.min(W-P.r, P.x)); P.y = Math.max(P.r+40, Math.min(H-P.r, P.y));

  if(inp.ax || inp.ay) P.a = Math.atan2(inp.ay, inp.ax);
  else if(Math.hypot(inp.mx, inp.my) > 0.2) P.a = Math.atan2(inp.my, inp.mx);
  if(Math.hypot(P.vx,P.vy) > 1 && Math.random() < 0.5*k) parts.push({x:P.x-Math.cos(P.a)*10, y:P.y-Math.sin(P.a)*10, vx:-Math.cos(P.a)*2+(Math.random()-.5), vy:-Math.sin(P.a)*2+(Math.random()-.5), life:0.25, max:0.25, col:COL.cyan, w:2});

  // tiro
  fireT -= dt;
  if(inp.fire && fireT <= 0){
    fireT = power.rapid > 0 ? 0.045 : 0.085;
    const lv = wave - 1;
    let spreads = lv >= 6 ? [-0.14,0,0.14] : lv >= 3 ? [-0.06,0.06] : [0];
    if(power.spread > 0) spreads = [-0.36,-0.18,0,0.18,0.36];
    for(const s of spreads){
      const a = P.a + s + (Math.random()-0.5)*0.04;
      bullets.push({x:P.x+Math.cos(a)*14, y:P.y+Math.sin(a)*14, vx:Math.cos(a)*15, vy:Math.sin(a)*15, life:1.2});
    }
    if(time - lastShotSnd > 0.07){ tone(1200, 600, 0.05, 'square', 0.012); lastShotSnd = time; }
  }
  if(inp.bomb) useBomb();

  // spawn
  if(!boss || wave >= 10){
    spawnT -= dt;
    if(spawnT <= 0){
      const lv = wave - 1;
      const n = boss ? 1 : 1 + Math.floor(lv/2) + (Math.random() < 0.3 ? 1 : 0);
      for(let i=0;i<n;i++) spawnEnemy();
      spawnT = boss ? 2.5 : Math.max(0.35, 1.5 - lv*0.11);
    }
  }

  if(comboT > 0){ comboT -= dt; if(comboT <= 0){ combo = 0; mult = 1; } }

  // balas do jogador
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i]; b.x += b.vx*k; b.y += b.vy*k; b.life -= dt;
    if(b.life <= 0 || b.x < -20 || b.x > W+20 || b.y < -20 || b.y > H+20){ bullets.splice(i,1); continue; }
    if(boss && !boss.enter && (b.x-boss.x)**2 + (b.y-boss.y)**2 < (boss.r+4)**2){
      bullets.splice(i,1); boss.hp--; boss.hit = 0.06; burst(b.x, b.y, COL.red, 3, 3, 0.25);
      if(Math.random() < 0.15) rumble(40, 0.1, 0.3);
      if(boss.hp <= 0) killBoss();
      continue;
    }
    for(let j=enemies.length-1;j>=0;j--){
      const e = enemies[j]; if(!e || e.spawn > 0) continue;
      if((b.x-e.x)**2 + (b.y-e.y)**2 < (e.r+4)**2){
        bullets.splice(i,1); e.hp--; e.hit = 0.08;
        const kb = e.type==='tank' ? 0.012 : 0.06;
        e.vx += b.vx*kb; e.vy += b.vy*kb;
        burst(b.x, b.y, e.col, 4, 3, 0.25);
        if(e.hp <= 0) killEnemy(e, j);
        break;
      }
    }
  }

  if(boss){ updateBoss(dt, k); if(state !== 'play') return; }

  // inimigos
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    if(!e) continue;
    e.t += dt; e.hit = Math.max(0, e.hit - dt);
    if(e.spawn > 0){ e.spawn -= dt; continue; }
    const dx = P.x-e.x, dy = P.y-e.y, d = Math.hypot(dx,dy)||1;
    const lvBoost = 1 + (wave-1)*0.05;
    if(e.type === 'chaser'){ const sp = 2.5*lvBoost; e.vx += (dx/d*sp - e.vx)*0.06*k; e.vy += (dy/d*sp - e.vy)*0.06*k; e.a += 0.1*k; }
    else if(e.type === 'mini'){ const sp = 3.4*lvBoost; e.vx += (dx/d*sp - e.vx)*0.05*k; e.vy += (dy/d*sp - e.vy)*0.05*k; }
    else if(e.type === 'splitter'){ const sp = 1.4*lvBoost; e.vx += (dx/d*sp - e.vx)*0.04*k; e.vy += (dy/d*sp - e.vy)*0.04*k; e.a += 0.03*k; }
    else if(e.type === 'tank'){ const sp = 0.9*lvBoost; e.vx += (dx/d*sp - e.vx)*0.03*k; e.vy += (dy/d*sp - e.vy)*0.03*k; e.a += 0.015*k; }
    else if(e.type === 'wanderer'){
      e.a += Math.sin(e.t*1.3)*0.04*k; const sp = 1.8*lvBoost;
      e.vx += (Math.cos(e.a)*sp - e.vx)*0.05*k; e.vy += (Math.sin(e.a)*sp - e.vy)*0.05*k;
      if(e.x <= e.r || e.x >= W-e.r) e.a = Math.PI - e.a;
      if(e.y <= e.r || e.y >= H-e.r) e.a = -e.a;
    }
    else if(e.type === 'shooter'){
      const want = d > 280 ? 1 : d < 200 ? -1 : 0; const sp = 1.8;
      const tx = dx/d*want*sp + (-dy/d)*1.2, ty = dy/d*want*sp + (dx/d)*1.2;
      e.vx += (tx - e.vx)*0.04*k; e.vy += (ty - e.vy)*0.04*k;
      e.cd -= dt;
      if(e.cd <= 0){ e.cd = Math.max(0.9, 2.2 - (wave-1)*0.1); const a = Math.atan2(dy,dx); ebullets.push({x:e.x, y:e.y, vx:Math.cos(a)*4.2, vy:Math.sin(a)*4.2, life:4, col:COL.purple}); tone(500, 250, 0.1, 'sine', 0.03); }
      e.a = Math.atan2(dy,dx);
    }
    else if(e.type === 'dasher'){
      // 0 = rondando, 1 = mirando (aviso), 2 = investida
      e.mt -= dt;
      if(e.mode === 0){
        const sp = 1.2; e.vx += ((-dy/d)*sp - e.vx)*0.05*k; e.vy += ((dx/d)*sp - e.vy)*0.05*k; e.a = Math.atan2(dy,dx);
        if(e.mt <= 0){ e.mode = 1; e.mt = 0.65; e.tx = dx/d; e.ty = dy/d; }
      } else if(e.mode === 1){
        e.vx *= 0.85; e.vy *= 0.85; e.a = Math.atan2(e.ty, e.tx);
        if(e.mt <= 0){ e.mode = 2; e.mt = 0.55; const sp = 11 + wave*0.2; e.vx = e.tx*sp; e.vy = e.ty*sp; }
      } else {
        parts.push({x:e.x, y:e.y, vx:-e.vx*0.05, vy:-e.vy*0.05, life:0.25, max:0.25, col:COL.blue, w:3});
        if(e.mt <= 0){ e.mode = 0; e.mt = 1.4 + Math.random(); }
      }
    }
    e.x += e.vx*k; e.y += e.vy*k;
    e.x = Math.max(e.r, Math.min(W-e.r, e.x)); e.y = Math.max(e.r, Math.min(H-e.r, e.y));
    if(d < e.r + P.r - 3){ playerHit(); break; } // playerHit pode remover inimigos da lista
  }
  if(state !== 'play') return;

  // balas inimigas
  for(let i=ebullets.length-1;i>=0;i--){
    const b = ebullets[i]; b.x += b.vx*k; b.y += b.vy*k; b.life -= dt;
    if(b.life <= 0 || b.x < -10 || b.x > W+10 || b.y < -10 || b.y > H+10){ ebullets.splice(i,1); continue; }
    if((b.x-P.x)**2 + (b.y-P.y)**2 < (P.r+2)**2){ ebullets.splice(i,1); playerHit(); if(state !== 'play') return; }
  }

  // power-ups (com ímã leve)
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i]; p.life -= dt; p.t += dt;
    const dx = P.x-p.x, dy = P.y-p.y, d = Math.hypot(dx,dy)||1;
    if(d < 120){ p.x += dx/d*3*k; p.y += dy/d*3*k; }
    if(d < P.r + 14){
      pickups.splice(i,1);
      if(p.type === 'bomb'){ P.bombs = Math.min(5, P.bombs+1); toast('+1 BOMBA ◆'); }
      else { power[p.type] = PW_INFO[p.type].t; toast(PW_INFO[p.type].l + '!'); }
      ring(P.x, P.y, PK_COL[p.type], 70, 0.35); rumble(120, 0.2, 0.6); tone(500, 1400, 0.2, 'triangle', 0.08);
      floatText(P.x, P.y-24, p.type === 'bomb' ? '+BOMBA' : PW_INFO[p.type].l, PK_COL[p.type]);
      continue;
    }
    if(p.life <= 0) pickups.splice(i,1);
  }
}

function updateFx(dt){
  const k = dt*60;
  for(let i=parts.length-1;i>=0;i--){ const p = parts[i]; p.x += p.vx*k; p.y += p.vy*k; p.vx *= Math.pow(0.93,k); p.vy *= Math.pow(0.93,k); p.life -= dt; if(p.life <= 0) parts.splice(i,1); }
  for(let i=rings.length-1;i>=0;i--){ const r = rings[i]; r.life -= dt; r.r = r.maxR * (1 - r.life/r.max); if(r.life <= 0) rings.splice(i,1); }
  for(let i=floats.length-1;i>=0;i--){ const f = floats[i]; f.life -= dt; f.y -= 0.8*k; if(f.life <= 0) floats.splice(i,1); }
  shake = Math.max(0, shake - 40*dt);
  flash = Math.max(0, flash - dt);
  if(parts.length > 900) parts.splice(0, parts.length-900);
}

// ---------- render ----------
function drawBg(){
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = boss ? 'rgba(14,4,10,0.42)' : 'rgba(5,6,13,0.42)';
  ctx.fillRect(-30,-30,W+60,H+60);
  const g = 48, px = P ? P.x : W/2, py = P ? P.y : H/2;
  const ox = -(px*0.05)%g, oy = -(py*0.05)%g;
  ctx.strokeStyle = boss ? 'rgba(255,59,92,0.07)' : 'rgba(0,240,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x = ox; x < W; x += g){ ctx.moveTo(x,0); ctx.lineTo(x,H); }
  for(let y = oy; y < H; y += g){ ctx.moveTo(0,y); ctx.lineTo(W,y); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,230,255,0.5)';
  for(const s of stars){
    const sx = ((s.x*W - px*s.z*0.08) % W + W) % W, sy = ((s.y*H - py*s.z*0.08) % H + H) % H;
    ctx.globalAlpha = s.z*0.6; ctx.fillRect(sx, sy, s.z*1.8, s.z*1.8);
  }
  ctx.globalAlpha = 1;
}

function glowStroke(col, w){ ctx.strokeStyle = col; ctx.lineWidth = w*3; ctx.globalAlpha *= 0.18; ctx.stroke(); ctx.globalAlpha /= 0.18; ctx.lineWidth = w; ctx.stroke(); }
function poly(n, r, rot=0){ for(let i=0;i<n;i++){ const a = rot + i*Math.PI*2/n; ctx[i?'lineTo':'moveTo'](Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); }

function drawEnemy(e){
  ctx.save(); ctx.translate(e.x, e.y);
  const col = e.hit > 0 ? '#ffffff' : e.col;
  if(e.spawn > 0){ const s = 1 + e.spawn*2.5; ctx.globalAlpha = 0.4 + 0.4*Math.sin(e.spawn*30); ctx.scale(s,s); }
  // linha de aviso do dasher
  if(e.type === 'dasher' && e.mode === 1){
    ctx.save(); ctx.globalAlpha = 0.25 + 0.35*Math.sin(e.t*40); ctx.strokeStyle = COL.blue; ctx.lineWidth = 2; ctx.setLineDash([8,8]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(e.tx*400, e.ty*400); ctx.stroke(); ctx.restore();
  }
  ctx.rotate(e.a);
  ctx.beginPath();
  const r = e.r;
  if(e.type === 'chaser'){ ctx.moveTo(r,0); ctx.lineTo(0,r*0.7); ctx.lineTo(-r,0); ctx.lineTo(0,-r*0.7); ctx.closePath(); }
  else if(e.type === 'wanderer'){ ctx.rect(-r*0.75,-r*0.75,r*1.5,r*1.5); ctx.moveTo(-r*0.75,-r*0.75); ctx.lineTo(r*0.75,r*0.75); ctx.moveTo(r*0.75,-r*0.75); ctx.lineTo(-r*0.75,r*0.75); }
  else if(e.type === 'splitter' || e.type === 'mini'){ poly(6, r); }
  else if(e.type === 'shooter'){ ctx.moveTo(r,0); ctx.lineTo(-r*0.7,r*0.8); ctx.lineTo(-r*0.3,0); ctx.lineTo(-r*0.7,-r*0.8); ctx.closePath(); }
  else if(e.type === 'dasher'){ ctx.moveTo(r*1.2,0); ctx.lineTo(-r*0.8,r*0.6); ctx.lineTo(-r*0.8,-r*0.6); ctx.closePath(); ctx.moveTo(-r*0.2,0); ctx.lineTo(r*0.5,0); }
  else if(e.type === 'tank'){ poly(8, r); ctx.moveTo(r*0.45,0); ctx.arc(0,0,r*0.45,0,Math.PI*2); }
  glowStroke(col, 2.2);
  ctx.restore();
  if(e.type === 'tank' && e.spawn <= 0){
    ctx.fillStyle = 'rgba(255,59,92,0.25)'; ctx.fillRect(e.x-24, e.y-e.r-12, 48, 4);
    ctx.fillStyle = COL.red; ctx.fillRect(e.x-24, e.y-e.r-12, 48*(e.hp/e.maxhp), 4);
  }
}

function drawBoss(){
  const b = boss, col = b.hit > 0 ? '#ffffff' : COL.red;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.rotate(b.a); ctx.beginPath(); poly(8, b.r); glowStroke(col, 3);
  ctx.rotate(-b.a*2.5); ctx.beginPath(); poly(4, b.r*0.72); glowStroke(b.phase === 2 ? COL.yellow : COL.pink, 2.5);
  ctx.rotate(b.a*4); ctx.beginPath(); poly(3, b.r*0.4); glowStroke(COL.purple, 2);
  const pulse = 6 + Math.sin(b.t*8)*3;
  ctx.beginPath(); ctx.arc(0,0,pulse,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

function drawPickup(p){
  if(p.life < 2.5 && Math.floor(p.life*8)%2 === 0) return;
  const c = PK_COL[p.type], s = 1 + Math.sin(p.t*6)*0.12;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s,s);
  ctx.beginPath(); poly(4, 14, p.t*1.5); glowStroke(c, 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = c; ctx.font = '700 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(PK_TXT[p.type], 0, 1);
  ctx.restore();
}

function drawPlayer(){
  if(P.inv > 0 && Math.floor(P.inv*14)%2 === 0 && state === 'play') return;
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.a);
  ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-10,11); ctx.lineTo(-5,0); ctx.lineTo(-10,-11); ctx.closePath();
  const c = P.dashT > 0 ? '#ffffff' : power.rapid > 0 ? COL.yellow : power.spread > 0 ? COL.pink : COL.cyan;
  glowStroke(c, 2.5);
  ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.fill();
  ctx.restore();
  if(power.shield > 0){
    ctx.beginPath(); ctx.arc(P.x, P.y, 24 + Math.sin(time*10)*1.5, 0, Math.PI*2);
    ctx.globalAlpha = power.shield < 2 ? 0.3 + 0.3*Math.sin(time*25) : 0.6; glowStroke(COL.cyan, 2); ctx.globalAlpha = 1;
  }
  if(P.dashCd > 0){
    ctx.beginPath(); ctx.arc(P.x, P.y, 30, -Math.PI/2, -Math.PI/2 + Math.PI*2*(1 - P.dashCd/0.9));
    ctx.strokeStyle = 'rgba(0,240,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawSticks(){
  if(!touchMode || state !== 'play') return;
  for(const k of ['L','R']){
    const s = sticks[k]; if(s.id === null) continue;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, 55, 0, Math.PI*2); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(s.ox + Math.max(-55,Math.min(55,s.x-s.ox)), s.oy + Math.max(-55,Math.min(55,s.y-s.oy)), 22, 0, Math.PI*2);
    ctx.fillStyle = k==='L' ? 'rgba(0,240,255,0.25)' : 'rgba(255,43,214,0.25)'; ctx.fill();
  }
}

function render(){
  const sx = shake ? (Math.random()-0.5)*shake : 0, sy = shake ? (Math.random()-0.5)*shake : 0;
  ctx.setTransform(DPR,0,0,DPR,sx*DPR,sy*DPR);
  drawBg();
  const playing = state === 'play' || state === 'pause' || state === 'dying' || state === 'over';
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for(const p of parts){
    ctx.strokeStyle = p.col; ctx.globalAlpha = Math.max(0, p.life/p.max); ctx.lineWidth = p.w;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx*2, p.y - p.vy*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for(const r of rings){ ctx.globalAlpha = Math.max(0, r.life/r.max); ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.strokeStyle = r.col; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.globalAlpha = 1;
  if(playing && P){
    for(const p of pickups){ ctx.globalCompositeOperation = 'lighter'; drawPickup(p); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = power.rapid > 0 ? '#fff6b0' : COL.yellow; ctx.lineWidth = 3;
    ctx.beginPath();
    for(const b of bullets){ ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx*0.9, b.y - b.vy*0.9); }
    ctx.stroke();
    for(const b of ebullets){ ctx.fillStyle = b.col || COL.purple; ctx.beginPath(); ctx.arc(b.x, b.y, 5 + Math.sin(b.life*20), 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill(); }
    for(const e of enemies) drawEnemy(e);
    if(boss) drawBoss();
    if(state === 'play' || state === 'pause') drawPlayer();
  }
  ctx.globalCompositeOperation = 'source-over';
  if(floats.length){
    ctx.font = '700 13px Orbitron, sans-serif'; ctx.textAlign = 'center';
    for(const f of floats){ ctx.globalAlpha = Math.min(1, f.life*2); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
    ctx.globalAlpha = 1;
  }
  drawSticks();
  if(flash > 0){ ctx.fillStyle = `rgba(255,255,255,${flash*0.5})`; ctx.fillRect(-30,-30,W+60,H+60); }
}

// ---------- main loop ----------
let last = performance.now(), hudT = 0, statusT = 0, ambT = 0;
const AMB = [COL.cyan, COL.pink, COL.yellow, COL.green, COL.orange, COL.purple];
function loop(now){
  requestAnimationFrame(loop);
  try { frame(now); } catch(err){ console.error('[neon-drift]', err); }
}
function frame(now){
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  const hadPad = !!pad;
  pollPad();
  if(pad && !hadPad) setTouchUI(false);
  if(pad && pad.buttons.some(b => b.pressed)) audioOn();
  const inp = readInput();

  if(state === 'menu'){
    if(inp.start){ audioOn(); startGame(); }
    else if(inp.sq) toggleOpt('sound');
    else if(inp.back) toggleOpt('vibe');
    statusT -= dt; if(statusT <= 0){ updateStatus(); statusT = 0.5; }
    ambT -= dt; if(ambT <= 0){ burst(Math.random()*W, Math.random()*H, AMB[Math.random()*AMB.length|0], 22, 5, 0.9); ambT = 0.7; }
  } else if(state === 'over'){
    if(inp.start){ audioOn(); startGame(); }
    else if(inp.back) setState('menu');
  } else if(state === 'pause'){
    if(inp.pause) setState('play');
    else if(inp.back){ boss = null; setState('menu'); }
  } else if(state === 'play'){
    if(inp.pause) setState('pause');
    else update(dt, inp);
  }
  if(state !== 'pause') updateFx(dt);

  render();

  hudT -= dt; if(hudT <= 0 && P && (state === 'play' || state === 'dying')){ hud(); hudT = 0.1; }

  prevBtn = pad ? pad.buttons.map(b => b.pressed || b.value > 0.5) : [];
}
document.addEventListener('visibilitychange', () => { if(document.hidden && state === 'play') setState('pause'); });

// PWA
if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

if(location.hash === '#debug') window.__nd = { skipTo: n => { wave = n-1; waveT = WAVE_LEN; }, god: () => { P.lives = 99; } };

updateStatus();
requestAnimationFrame(loop);
})();
