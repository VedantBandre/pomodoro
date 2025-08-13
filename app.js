const el = (id) => document.getElementById(id);
const phaseEl = el("phase"), timeEl = el("time");
const startBtn = el("start"), pauseBtn = el("pause"), resumeBtn = el("resume"), resetBtn = el("reset");
const inputs = { work: el("work"), short: el("short"), long: el("long"), cycles: el("cycles"), sound: el("sound") };
const saveBtn = el("save");

const DEFAULTS = { work: 25, short: 5, long: 15, cycles: 4, sound: true };

let state = {
  phase: "work",          // 'work' | 'short' | 'long'
  running: false,
  end: null,
  remaining: mins(DEFAULTS.work), // ms
  cycleCount: 0
};

let rafId = null;
let audio = null;

init();

// Converts minutes to milliseconds
function mins(m){ return Math.max(0, Math.round(m * 60 * 1000)); }

// Formats milliseconds into MM:SS
function fmt(ms){
  ms = Math.max(0, ms|0);
  const s = (ms/1000|0), m = (s/60|0), r = s % 60;
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

// Initializes the app
function init(){
  const saved = loadSettings();
  setInputs(saved);
  audio = new Audio("sounds/ding.mp3");
  audio.preload = "auto";
  draw();
  wire();
  // Ask for notifications on first interaction
  document.addEventListener("click", maybeRequestNotificationPermission, { once: true });
}

// Attaches event listeners
function wire(){
  startBtn.onclick = start;
  pauseBtn.onclick = pause;
  resumeBtn.onclick = resume;
  resetBtn.onclick = reset;
  saveBtn.onclick = saveSettings;
}

function start(){
  if (state.running) return;
  state.running = true;
  state.end = performance.now() + state.remaining;
  tick();
}

function pause(){
  if (!state.running) return;
  state.remaining = Math.max(0, state.end - performance.now());
  state.running = false;
  cancelAnimationFrame(rafId);
  draw();
}

function resume(){
  if (state.running || state.remaining <= 0) return;
  state.running = true;
  state.end = performance.now() + state.remaining;
  tick();
}

function reset(){
  state.running = false;
  cancelAnimationFrame(rafId);
  state.phase = "work";
  state.cycleCount = 0;
  state.remaining = mins(loadSettings().work);
  draw();
}

// Updates the timer on each animation frame
function tick(){
  if (!state.running) return;
  const left = state.end - performance.now();
  if (left <= 0){
    state.running = false;
    cancelAnimationFrame(rafId);
    onPhaseEnd();
    return;
  }
  state.remaining = left;
  draw();
  rafId = requestAnimationFrame(tick);
}

// Handles phase completion
function onPhaseEnd(){
  notify(`${label(state.phase)} finished`);
  if (loadSettings().sound) audio.play().catch(()=>{});
  // Advance phase
  if (state.phase === "work"){
    state.cycleCount++;
    const { cycles } = loadSettings();
    state.phase = (state.cycleCount % cycles === 0) ? "long" : "short";
  } else {
    state.phase = "work";
  }
  state.remaining = mins(durationFor(state.phase));
  draw();
}

function durationFor(phase){
  const { work, short, long } = loadSettings();
  return phase === "work" ? work : (phase === "short" ? short : long);
}

function label(phase){
  return phase === "work" ? "Work" : (phase === "short" ? "Short break" : "Long break");
}

// Updates the UI
function draw(){
  phaseEl.textContent = label(state.phase);
  timeEl.textContent = fmt(state.remaining);
  startBtn.disabled = state.running;
  pauseBtn.disabled = !state.running;
  resumeBtn.disabled = state.running || state.remaining <= 0;
  document.title = `${fmt(state.remaining)} • Pomodoro`; // nice touch
}

// Notification & Preferences
function maybeRequestNotificationPermission(){
  if ("Notification" in window && Notification.permission === "default"){
    Notification.requestPermission();
  }
}

function notify(msg){
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("Pomodoro", { body: msg });
  }
}

function loadSettings(){
  try {
    const raw = JSON.parse(localStorage.getItem("settings") || "{}");
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function setInputs(cfg){
  inputs.work.value = cfg.work;
  inputs.short.value = cfg.short;
  inputs.long.value = cfg.long;
  inputs.cycles.value = cfg.cycles;
  inputs.sound.checked = !!cfg.sound;
}

function saveSettings(){
  const cfg = {
    work:   clampNum(inputs.work.value,   1, 600),
    short:  clampNum(inputs.short.value,  1, 600),
    long:   clampNum(inputs.long.value,   1, 600),
    cycles: clampNum(inputs.cycles.value, 1, 20),
    sound:  !!inputs.sound.checked
  };
  localStorage.setItem("settings", JSON.stringify(cfg));
  // If not running, reset remaining to match new phase length
  if (!state.running) state.remaining = mins(durationFor(state.phase));
  draw();
}

function clampNum(v, lo, hi){
  v = Number(v || 0);
  return Math.max(lo, Math.min(hi, v));
}
