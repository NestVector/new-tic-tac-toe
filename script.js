/* ============================================================
   ELRS Handset — Virtual RC Transmitter
   Channels: CH1=Roll, CH2=Pitch, CH3=Throttle, CH4=Yaw
             CH5=Arm, CH6=FlightMode, CH7=Beeper, CH8=Turtle
   ============================================================ */

'use strict';

// ── Channel state (microseconds, 1000–2000) ──────────────────
const CH_MIN = 1000;
const CH_MID = 1500;
const CH_MAX = 2000;

const channels = {
    ch1: CH_MID,  // Roll
    ch2: CH_MID,  // Pitch
    ch3: CH_MIN,  // Throttle (starts at min)
    ch4: CH_MID,  // Yaw
    ch5: CH_MIN,  // Arm
    ch6: CH_MIN,  // Flight mode
    ch7: CH_MIN,  // Beeper
    ch8: CH_MIN,  // Turtle mode
};

// ── Link state ────────────────────────────────────────────────
let linked = false;
let bindPhrase = '';

// Simulated telemetry (updated when "linked")
let telem = {
    battery: 0,
    altitude: 0,
    speed: 0,
    lq: 0,
    rssi: 0,
    snr: 0,
    roll: 0,
    pitch: 0,
};

// ── DOM references ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Status bar
const linkDot    = $('link-dot');
const linkLabel  = $('link-label');
const rssiVal    = $('rssi-val');
const txPwr      = $('tx-pwr');
const snrValEl   = $('snr-val');
const linkQuality = $('link-quality');

// Sticks
const leftZone   = $('left-stick-zone');
const leftThumb  = $('left-thumb');
const rightZone  = $('right-stick-zone');
const rightThumb = $('right-thumb');

// Mini bars
const ch1Mini    = $('ch1-mini'); const ch1MiniVal = $('ch1-mini-val');
const ch2Mini    = $('ch2-mini'); const ch2MiniVal = $('ch2-mini-val');
const ch3Mini    = $('ch3-mini'); const ch3MiniVal = $('ch3-mini-val');
const ch4Mini    = $('ch4-mini'); const ch4MiniVal = $('ch4-mini-val');

// Channel footer bars
const chBars = {};
const chVals = {};
for (let i = 1; i <= 8; i++) {
    chBars[i] = $(`ch${i}-bar`);
    chVals[i] = $(`ch${i}-val`);
}

// Telemetry
const battVal    = $('batt-val');
const battFill   = $('batt-fill');
const altVal     = $('alt-val');
const speedVal   = $('speed-val');
const rollValEl  = $('roll-val');
const pitchValEl = $('pitch-val');

// Attitude horizon
const artificialHorizon = $('artificial-horizon');
const pitchLadder       = $('pitch-ladder');
const horizonGround     = document.querySelector('.horizon-ground');

// Bind
const bindBtn    = $('bind-btn');
const bindInput  = $('bind-phrase');
const bindStatus = $('bind-status');

// Flight mode buttons
const fmBtns = document.querySelectorAll('.fm-btn');

// Packet rate
const packetRateEl = $('packet-rate');
const linkModeEl   = $('link-mode');

// ═══════════════════════════════════════════════════════════════
// VIRTUAL STICK CONTROLLER
// ═══════════════════════════════════════════════════════════════

class VirtualStick {
    constructor(zone, thumb, opts = {}) {
        this.zone   = zone;
        this.thumb  = thumb;
        this.springX = opts.springX !== false;   // auto-center X
        this.springY = opts.springY !== false;   // auto-center Y
        this.normalX = 0;   // -1 … +1
        this.normalY = 0;   // -1 (top) … +1 (bottom)
        this.active  = false;
        this.pointerId = null;
        this._bind();
    }

    _bind() {
        this.zone.addEventListener('pointerdown', e => this._onDown(e));
        window.addEventListener('pointermove',    e => this._onMove(e));
        window.addEventListener('pointerup',      e => this._onUp(e));
        window.addEventListener('pointercancel',  e => this._onUp(e));
    }

    _onDown(e) {
        e.preventDefault();
        this.zone.setPointerCapture(e.pointerId);
        this.pointerId = e.pointerId;
        this.active = true;
        this.zone.classList.add('active');
        this._update(e);
    }

    _onMove(e) {
        if (!this.active || e.pointerId !== this.pointerId) return;
        e.preventDefault();
        this._update(e);
    }

    _onUp(e) {
        if (e.pointerId !== this.pointerId) return;
        this.active = false;
        this.pointerId = null;
        this.zone.classList.remove('active');

        // Spring back to center
        if (this.springX) this.normalX = 0;
        if (this.springY) this.normalY = 0;
        this._positionThumb();
    }

    _update(e) {
        const rect = this.zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const radius = Math.min(rect.width, rect.height) / 2 - 24;

        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) {
            dx = (dx / dist) * radius;
            dy = (dy / dist) * radius;
        }

        this.normalX = dx / radius;   // -1 … +1
        this.normalY = dy / radius;   // -1 … +1 (up = negative)
        this._positionThumb();
    }

    _positionThumb() {
        const rect  = this.zone.getBoundingClientRect();
        const radius = Math.min(rect.width, rect.height) / 2 - 24;
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const tx = cx + this.normalX * radius;
        const ty = cy + this.normalY * radius;
        this.thumb.style.left = tx + 'px';
        this.thumb.style.top  = ty + 'px';
    }

    // Returns channel value 1000–2000 for axis
    chanX() { return Math.round(CH_MID + this.normalX * 500); }
    chanY() { return Math.round(CH_MID - this.normalY * 500); }   // invert Y so up=max
}

// Left stick: Throttle (Y, no spring) + Yaw (X, spring)
const leftStick = new VirtualStick(leftZone, leftThumb, { springX: true, springY: false });
// Throttle starts at bottom — normalY = +1
leftStick.normalY = 1;
leftStick._positionThumb();

// Right stick: Pitch (Y, spring) + Roll (X, spring)
const rightStick = new VirtualStick(rightZone, rightThumb, { springX: true, springY: true });

// ═══════════════════════════════════════════════════════════════
// AUX TOGGLE SWITCHES
// ═══════════════════════════════════════════════════════════════

const switchConfigs = {
    'sw-arm':    { onLabel: 'ARMED',    offLabel: 'DISARMED', labelId: 'sw-arm-label',    ch: 5 },
    'sw-beeper': { onLabel: 'ON',       offLabel: 'OFF',       labelId: 'sw-beeper-label', ch: 7 },
    'sw-mode':   { onLabel: 'AUX 2',    offLabel: 'AUX 1',    labelId: 'sw-mode-label',   ch: 6 },
    'sw-turtle': { onLabel: 'ON',       offLabel: 'OFF',       labelId: 'sw-turtle-label', ch: 8 },
};

document.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => {
        const id  = sw.id;
        const cfg = switchConfigs[id];
        if (!cfg) return;
        const on = sw.classList.toggle('on');
        $( cfg.labelId ).textContent = on ? cfg.onLabel : cfg.offLabel;
        channels[`ch${cfg.ch}`] = on ? CH_MAX : CH_MIN;
    });
});

// ═══════════════════════════════════════════════════════════════
// FLIGHT MODE BUTTONS
// ═══════════════════════════════════════════════════════════════

fmBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        fmBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ch6 = parseInt(btn.dataset.ch6, 10);
        channels.ch6 = ch6;
    });
});

// ═══════════════════════════════════════════════════════════════
// BIND / LINK SIMULATION
// ═══════════════════════════════════════════════════════════════

bindBtn.addEventListener('click', () => {
    const phrase = bindInput.value.trim();
    if (!phrase) {
        setBindStatus('Enter a binding phrase first.', 'error');
        return;
    }
    bindBtn.disabled = true;
    bindBtn.textContent = '...';
    setBindStatus('Searching for receiver…', '');

    // Simulate binding sequence
    setTimeout(() => {
        setBindStatus('Receiver found! Handshaking…', '');
    }, 1000);

    setTimeout(() => {
        linked    = true;
        bindPhrase = phrase;
        bindBtn.textContent = 'UNBIND';
        bindBtn.disabled = false;
        setBindStatus(`Linked — "${phrase}"`, 'ok');
        linkDot.classList.add('connected');
        linkLabel.textContent = 'LINKED';

        // Start telemetry simulation
        startTelemSim();
    }, 2500);
});

bindBtn.addEventListener('click', function handler() {
    if (linked) {
        // Second click = unbind
        linked = false;
        linkDot.classList.remove('connected');
        linkLabel.textContent = 'NO LINK';
        rssiVal.textContent = '—';
        snrValEl.textContent = '—';
        linkQuality.textContent = '—';
        battVal.textContent = '—';
        altVal.textContent = '—';
        speedVal.textContent = '—';
        battFill.style.width = '0%';
        setBindStatus('Enter binding phrase and press BIND', '');
        bindBtn.textContent = 'BIND';
        stopTelemSim();
    }
}, { once: false });

function setBindStatus(msg, cls) {
    bindStatus.textContent = msg;
    bindStatus.className   = 'bind-status' + (cls ? ' ' + cls : '');
}

// ═══════════════════════════════════════════════════════════════
// TELEMETRY SIMULATION (when linked)
// ═══════════════════════════════════════════════════════════════

let telemTimer = null;
let telemTick  = 0;

function startTelemSim() {
    telemTick = 0;
    telem.battery  = 16.6;
    telem.altitude = 0;
    telem.speed    = 0;
    telem.lq       = 100;
    telem.rssi     = -60;
    telem.snr      = 12;
    telemTimer = setInterval(updateTelemSim, 500);
}

function stopTelemSim() {
    clearInterval(telemTimer);
    telemTimer = null;
}

function updateTelemSim() {
    telemTick++;
    // Battery drains slowly
    telem.battery = Math.max(14.8, telem.battery - 0.002);

    // Altitude follows throttle stick
    const throttleNorm = (channels.ch3 - CH_MIN) / (CH_MAX - CH_MIN);
    telem.altitude += (throttleNorm - 0.3) * 0.5;
    telem.altitude  = Math.max(0, telem.altitude);

    // Speed follows roll/pitch deviation
    const rollDev  = Math.abs(channels.ch1 - CH_MID) / 500;
    const pitchDev = Math.abs(channels.ch2 - CH_MID) / 500;
    telem.speed     = Math.round((rollDev + pitchDev) * 60);

    // Simulate LQ/RSSI drift
    telem.lq   = Math.min(100, Math.max(70, telem.lq   + (Math.random() - 0.5) * 4));
    telem.rssi = Math.min(-40, Math.max(-90, telem.rssi + (Math.random() - 0.5) * 2));
    telem.snr  = Math.min(20, Math.max(5,   telem.snr   + (Math.random() - 0.5)));

    // Attitude follows sticks
    telem.roll  = (channels.ch1 - CH_MID) / 500 * 45;
    telem.pitch = -(channels.ch2 - CH_MID) / 500 * 30;

    updateTelemDisplay();
}

function updateTelemDisplay() {
    if (!linked) return;

    // Top bar
    rssiVal.textContent = telem.rssi.toFixed(0);
    snrValEl.textContent = telem.snr.toFixed(1);
    linkQuality.textContent = telem.lq.toFixed(0);

    // Telem panel
    battVal.textContent  = telem.battery.toFixed(1);
    altVal.textContent   = telem.altitude.toFixed(1);
    speedVal.textContent = telem.speed;

    // Battery bar
    const battPercent = Math.max(0, Math.min(100,
        ((telem.battery - 14.8) / (16.8 - 14.8)) * 100));
    battFill.style.width = battPercent + '%';
    battFill.style.background = battPercent > 50 ? 'var(--green)'
        : battPercent > 25 ? 'var(--orange)' : 'var(--red)';

    // Artificial horizon
    updateHorizon(telem.roll, telem.pitch);
    rollValEl.textContent  = telem.roll.toFixed(1) + '°';
    pitchValEl.textContent = telem.pitch.toFixed(1) + '°';
}

function updateHorizon(rollDeg, pitchDeg) {
    // Rotate horizon for roll
    artificialHorizon.style.transform = `rotate(${-rollDeg}deg)`;

    // Shift ground for pitch (positive pitch = nose up = ground moves down)
    const pitchOffset = (pitchDeg / 90) * 50;  // % of container height
    const groundHeight = 50 - pitchOffset;
    horizonGround.style.height = Math.max(0, Math.min(100, groundHeight)) + '%';

    // Shift pitch ladder opposite direction
    const ladderShift = (pitchDeg / 90) * 40;
    pitchLadder.style.transform = `translateY(${ladderShift}%)`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN UPDATE LOOP — runs at ~50 Hz
// ═══════════════════════════════════════════════════════════════

function updateChannels() {
    // Map sticks to channels
    channels.ch1 = rightStick.chanX();   // Roll
    channels.ch2 = rightStick.chanY();   // Pitch (inverted handled in chanY)
    channels.ch3 = leftStick.chanY();    // Throttle (bottom=1000, top=2000)
    channels.ch4 = leftStick.chanX();    // Yaw

    // Note: ch3 = throttle uses Y with no spring
    // chanY() gives top=2000, bottom=1000 — correct for throttle
    // But leftStick.normalY starts at +1 (bottom), so ch3 starts at 1000 ✓
}

function updateChannelUI() {
    // Footer bars
    for (let i = 1; i <= 8; i++) {
        const val = channels[`ch${i}`];
        const pct = ((val - CH_MIN) / (CH_MAX - CH_MIN)) * 100;
        chBars[i].style.height = pct + '%';
        chVals[i].textContent  = val;
    }

    // Mini bars (side panels)
    const miniData = [
        { fill: ch1Mini, valEl: ch1MiniVal, ch: 'ch1' },
        { fill: ch2Mini, valEl: ch2MiniVal, ch: 'ch2' },
        { fill: ch3Mini, valEl: ch3MiniVal, ch: 'ch3' },
        { fill: ch4Mini, valEl: ch4MiniVal, ch: 'ch4' },
    ];
    miniData.forEach(({ fill, valEl, ch }) => {
        const val = channels[ch];
        const pct = ((val - CH_MIN) / (CH_MAX - CH_MIN)) * 100;
        fill.style.width   = pct + '%';
        valEl.textContent  = val;
    });
}

// Keyboard control (for testing on desktop)
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

const KEYBOARD_STEP = 0.04;

function applyKeyboard() {
    // W/S = throttle up/down (left stick Y, no spring)
    if (keys['KeyW']) leftStick.normalY = Math.max(-1, leftStick.normalY - KEYBOARD_STEP);
    if (keys['KeyS']) leftStick.normalY = Math.min( 1, leftStick.normalY + KEYBOARD_STEP);

    // A/D = yaw left/right (left stick X)
    if (keys['KeyA']) leftStick.normalX = Math.max(-1, leftStick.normalX - KEYBOARD_STEP);
    if (keys['KeyD']) leftStick.normalX = Math.min( 1, leftStick.normalX + KEYBOARD_STEP);

    // Arrow keys = pitch/roll (right stick)
    if (keys['ArrowLeft'])  rightStick.normalX = Math.max(-1, rightStick.normalX - KEYBOARD_STEP);
    if (keys['ArrowRight']) rightStick.normalX = Math.min( 1, rightStick.normalX + KEYBOARD_STEP);
    if (keys['ArrowUp'])    rightStick.normalY = Math.max(-1, rightStick.normalY - KEYBOARD_STEP);
    if (keys['ArrowDown'])  rightStick.normalY = Math.min( 1, rightStick.normalY + KEYBOARD_STEP);

    // Spring back right stick when no key held
    if (!keys['ArrowLeft']  && !keys['ArrowRight']) {
        rightStick.normalX *= 0.85;
        if (Math.abs(rightStick.normalX) < 0.01) rightStick.normalX = 0;
    }
    if (!keys['ArrowUp'] && !keys['ArrowDown']) {
        rightStick.normalY *= 0.85;
        if (Math.abs(rightStick.normalY) < 0.01) rightStick.normalY = 0;
    }

    // Spring back yaw when no key
    if (!keys['KeyA'] && !keys['KeyD']) {
        leftStick.normalX *= 0.85;
        if (Math.abs(leftStick.normalX) < 0.01) leftStick.normalX = 0;
    }

    // Update thumb positions
    leftStick._positionThumb();
    rightStick._positionThumb();
}

// ── Main loop ─────────────────────────────────────────────────
let lastFrame = 0;
function loop(ts) {
    if (ts - lastFrame >= 20) {   // ~50 fps
        lastFrame = ts;
        applyKeyboard();
        updateChannels();
        updateChannelUI();
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ── Keyboard hint ─────────────────────────────────────────────
console.info(
    '%cELRS Handset — Keyboard Controls\n' +
    'W/S       — Throttle up/down\n' +
    'A/D       — Yaw left/right\n' +
    'Arrow keys — Pitch/Roll',
    'font-family:monospace; color:#00d4ff'
);
