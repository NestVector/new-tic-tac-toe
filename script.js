'use strict';

/* ═══════════════════════════════════════════════════════════════
   SAFE LOCALSTORAGE — prevents fatal errors in restricted contexts
═══════════════════════════════════════════════════════════════ */
const safeStorage = (() => {
    try {
        localStorage.setItem('__test__', '1');
        localStorage.removeItem('__test__');
        return localStorage;
    } catch (_) {
        const _mem = {};
        return {
            getItem:    k     => Object.prototype.hasOwnProperty.call(_mem, k) ? _mem[k] : null,
            setItem:    (k,v) => { _mem[k] = String(v); },
            removeItem: k     => { delete _mem[k]; },
        };
    }
})();

/* ═══════════════════════════════════════════════════════════════
   AGE SYSTEM
═══════════════════════════════════════════════════════════════ */
const AGE_GROUP_MAP = {
    '5': 'age-tiny', '6': 'age-tiny',
    '7': 'age-small', '8': 'age-small',
    '9': 'age-mid', '10': 'age-mid',
    '11': 'age-big', '12plus': 'age-big',
};
const AGE_STEP_DELAY = {
    'age-tiny': 280, 'age-small': 200, 'age-mid': 170, 'age-big': 130,
};

let currentAgeGroup = 'age-mid';

// Age → default AI difficulty mapping
const AGE_AI_DIFFICULTY = {
    'age-tiny':  'easy',
    'age-small': 'easy',
    'age-mid':   'medium',
    'age-big':   'hard',
};

function applyAge(ageKey) {
    const group = AGE_GROUP_MAP[ageKey] || 'age-mid';
    currentAgeGroup = group;
    const body = document.body;
    // Remove all age classes
    body.classList.remove('age-tiny', 'age-small', 'age-mid', 'age-big');
    body.classList.add(group);
    // Update pill active state
    document.querySelectorAll('.age-pill').forEach(p => {
        p.classList.toggle('active-age', p.dataset.age === ageKey);
    });
    safeStorage.setItem('selectedAge', ageKey);

    // Auto-set AI difficulty for both games based on age (only if not manually overridden this session)
    const defaultDiff = AGE_AI_DIFFICULTY[group] || 'medium';
    // TTT difficulty
    const tttSel = document.getElementById('difficulty-select');
    if (tttSel) {
        tttSel.value = defaultDiff;
        // Update in-memory value and storage
        try { if (aiDifficulty !== undefined) aiDifficulty = defaultDiff; } catch (_) {}
        safeStorage.setItem('aiDifficulty', defaultDiff);
    }
    // SNL difficulty
    const snlSel = document.getElementById('snl-difficulty-select');
    if (snlSel) {
        snlSel.value = defaultDiff;
        safeStorage.setItem('snlAiDifficulty', defaultDiff);
        try { if (snlGame) snlGame.aiDifficulty = defaultDiff; } catch (_) {}
    }
}

function getStepDelay() {
    return AGE_STEP_DELAY[currentAgeGroup] || 170;
}

// Init age system
(function initAgeSystem() {
    const savedAge = safeStorage.getItem('selectedAge') || '9';
    applyAge(savedAge);
    document.querySelectorAll('.age-pill').forEach(pill => {
        pill.addEventListener('click', () => applyAge(pill.dataset.age));
    });
})();

/* ═══════════════════════════════════════════════════════════════
   SOUND ENGINE  (Web Audio API)
═══════════════════════════════════════════════════════════════ */
class SoundEngine {
    constructor() { this._ctx = null; }

    get ctx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    _note(freq, type, duration, vol = 0.28, delay = 0) {
        try {
            const ac = this.ctx;
            const t = ac.currentTime + delay;
            const osc = ac.createOscillator();
            const g   = ac.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + duration);
            osc.connect(g);
            g.connect(ac.destination);
            osc.start(t);
            osc.stop(t + duration);
        } catch (_) {}
    }

    _noise(duration, vol = 0.3, filter = null, delay = 0) {
        try {
            const ac = this.ctx;
            const t  = ac.currentTime + delay;
            const n  = Math.ceil(ac.sampleRate * duration);
            const buf = ac.createBuffer(1, n, ac.sampleRate);
            const d   = buf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
            const src = ac.createBufferSource();
            src.buffer = buf;
            const g = ac.createGain();
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + duration);
            if (filter) {
                const f = ac.createBiquadFilter();
                f.type = filter.type || 'bandpass';
                f.frequency.value = filter.freq || 1000;
                f.Q.value = filter.Q || 1;
                src.connect(f); f.connect(g);
            } else {
                src.connect(g);
            }
            g.connect(ac.destination);
            src.start(t);
        } catch (_) {}
    }

    playDice() {
        this._noise(0.12, 0.4, { type: 'bandpass', freq: 700, Q: 0.6 });
        this._note(180, 'triangle', 0.08, 0.2, 0.04);
    }

    playStep() {
        this._note(520, 'sine', 0.055, 0.14);
    }

    playAnimal(key) {
        const fn = { frog: '_frog', snake: '_snake', dino: '_dino', fox: '_fox', croc: '_croc' }[key];
        if (fn) this[fn]();
    }

    _frog() {
        // ribbit: two-part descending bleat
        try {
            const ac = this.ctx;
            [0, 0.22].forEach((delay) => {
                const t = ac.currentTime + delay;
                const osc = ac.createOscillator();
                const g = ac.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(520, t);
                osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
                g.gain.setValueAtTime(0.22, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.connect(g); g.connect(ac.destination);
                osc.start(t); osc.stop(t + 0.22);
            });
        } catch (_) {}
    }

    _snake() {
        this._noise(0.55, 0.35, { type: 'highpass', freq: 2800, Q: 0.5 });
        try {
            const ac = this.ctx;
            const t = ac.currentTime + 0.05;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.connect(g); g.connect(ac.destination);
            osc.start(t); osc.stop(t + 0.55);
        } catch (_) {}
    }

    _dino() {
        try {
            const ac = this.ctx;
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(95, t);
            osc.frequency.setValueAtTime(70, t + 0.15);
            osc.frequency.setValueAtTime(50, t + 0.35);
            g.gain.setValueAtTime(0.35, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
            osc.connect(g); g.connect(ac.destination);
            osc.start(t); osc.stop(t + 0.7);
        } catch (_) {}
    }

    _fox() {
        this._note(350, 'triangle', 0.08, 0.25);
        try {
            const ac = this.ctx;
            const t = ac.currentTime + 0.06;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
            osc.frequency.exponentialRampToValueAtTime(600, t + 0.22);
            g.gain.setValueAtTime(0.25, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(g); g.connect(ac.destination);
            osc.start(t); osc.stop(t + 0.28);
        } catch (_) {}
    }

    _croc() {
        try {
            const ac = this.ctx;
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.09);
            g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(g); g.connect(ac.destination);
            osc.start(t); osc.stop(t + 0.12);
        } catch (_) {}
        this._noise(0.06, 0.3, { type: 'bandpass', freq: 400, Q: 2 }, 0.01);
    }

    playLadder() {
        [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
            this._note(f, 'triangle', 0.28, 0.22, i * 0.11);
        });
    }

    playWin() {
        [261.63, 329.63, 392.00, 523.25, 659.25].forEach((f, i) => {
            this._note(f, 'triangle', 0.5, 0.2, i * 0.13);
        });
    }

    playTTTMove() { this._note(600, 'sine', 0.07, 0.18); }
    playTTTWin()  { this.playWin(); }
}

const sound = new SoundEngine();

/* ═══════════════════════════════════════════════════════════════
   BIG CONFETTI
═══════════════════════════════════════════════════════════════ */
function launchBigConfetti() {
    const colours = ['#ef4444','#3b82f6','#22c55e','#fbbf24','#a855f7','#f97316','#ec4899'];
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    for (let i = 0; i < 90; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-rain';
        p.style.left = `${Math.random() * 100}%`;
        const dur = 2.2 + Math.random() * 2.8;
        p.style.animationDuration = `${dur}s`;
        p.style.animationDelay = `${Math.random() * 1.5}s`;
        p.style.backgroundColor = colours[Math.floor(Math.random() * colours.length)];
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        p.style.width  = `${8 + Math.random() * 8}px`;
        p.style.height = `${10 + Math.random() * 10}px`;
        container.appendChild(p);
    }
    setTimeout(() => { container.innerHTML = ''; }, 5500);
}

/* ═══════════════════════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b =>
            b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach(p =>
            p.classList.toggle('hidden', p.id !== `${tab}-panel`));
    });
});

/* ═══════════════════════════════════════════════════════════════
   3D DICE — FACE TRANSFORMS
═══════════════════════════════════════════════════════════════ */
const FACE_TRANSFORMS = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(0deg) rotateY(90deg)',
    3: 'rotateX(90deg) rotateY(0deg)',
    4: 'rotateX(-90deg) rotateY(0deg)',
    5: 'rotateX(0deg) rotateY(-90deg)',
    6: 'rotateX(0deg) rotateY(180deg)',
};

function rollDice3D(value) {
    return new Promise((resolve) => {
        const cube = document.getElementById('dice-cube');
        if (!cube) { resolve(); return; }
        cube.classList.remove('rolling');
        // Force reflow
        void cube.offsetWidth;
        cube.classList.add('rolling');
        function onEnd() {
            cube.removeEventListener('animationend', onEnd);
            cube.classList.remove('rolling');
            cube.style.transform = FACE_TRANSFORMS[value];
            resolve();
        }
        cube.addEventListener('animationend', onEnd, { once: true });
        // Fallback in case animationend doesn't fire
        setTimeout(() => {
            cube.removeEventListener('animationend', onEnd);
            cube.classList.remove('rolling');
            cube.style.transform = FACE_TRANSFORMS[value];
            resolve();
        }, 1100);
    });
}

/* ═══════════════════════════════════════════════════════════════
   S&L MULTIPLAYER — ROOM CODE GENERATION
═══════════════════════════════════════════════════════════════ */
const SNL_WORDS_A = ['HAPPY','SILLY','BOUNCY','FLUFFY','SPARKLY','RAINBOW','WIGGLY','GIGGLY','ZIPPY','SNAPPY','DIZZY','FUZZY'];
const SNL_WORDS_B = ['PANDA','BUNNY','TIGER','UNICORN','DRAGON','PUPPY','KITTY','PENGUIN','MONKEY','TURTLE','PARROT','HEDGEHOG'];

function generateSnlRoomCode() {
    const a = SNL_WORDS_A[Math.floor(Math.random() * SNL_WORDS_A.length)];
    const b = SNL_WORDS_B[Math.floor(Math.random() * SNL_WORDS_B.length)];
    const n = String(Math.floor(Math.random() * 90) + 10);
    return a + b + n;
}

/* ═══════════════════════════════════════════════════════════════
   CREATURES & LADDERS — CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ANIMALS = {
    frog:  { emoji: '🐸', name: 'Frogs',  color: '#22c55e', sound: 'frog'  },
    snake: { emoji: '🐍', name: 'Snakes', color: '#ef4444', sound: 'snake' },
    dino:  { emoji: '🦕', name: 'Dinos',  color: '#0ea5e9', sound: 'dino'  },
    fox:   { emoji: '🦊', name: 'Foxes',  color: '#f97316', sound: 'fox'   },
    croc:  { emoji: '🐊', name: 'Crocs',  color: '#16a34a', sound: 'croc'  },
};

// Hazards: head (higher square) → tail (lower square)
const SNL_HAZARDS_FULL = { 99: 78, 87: 24, 64: 60, 62: 19, 17: 7 };
const SNL_HAZARDS_TINY = { 87: 24, 62: 19, 17: 7 }; // Only 3 for age-tiny
// Ladders: bottom → top
const SNL_LADDERS_FULL = { 4: 25, 9: 31, 20: 55, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
const SNL_LADDERS_TINY = { 4: 25, 20: 55, 40: 59, 71: 91 }; // Only 4 for age-tiny

function getSNLHazards() {
    return currentAgeGroup === 'age-tiny' ? SNL_HAZARDS_TINY : SNL_HAZARDS_FULL;
}
function getSNLLadders() {
    return currentAgeGroup === 'age-tiny' ? SNL_LADDERS_TINY : SNL_LADDERS_FULL;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const TOKEN_CLASSES = ['p0', 'p1', 'p2', 'p3'];
const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

/* Board math helpers */
function squareToPos(sq) {
    const idx = sq - 1;
    const rowFromBottom = Math.floor(idx / 10);
    const posInRow = idx % 10;
    const col = (rowFromBottom % 2 === 0) ? posInRow : (9 - posInRow);
    return { row: 9 - rowFromBottom, col };  // row=0 is top
}

function visualToSquare(rowFromTop, col) {
    const rowFromBottom = 9 - rowFromTop;
    return rowFromBottom % 2 === 0
        ? rowFromBottom * 10 + col + 1
        : rowFromBottom * 10 + (9 - col) + 1;
}

function squareCenter(sq) {
    const { row, col } = squareToPos(sq);
    return { x: col * 10 + 5, y: row * 10 + 5 };
}

/* ═══════════════════════════════════════════════════════════════
   CREATURES & LADDERS — GAME CLASS
═══════════════════════════════════════════════════════════════ */
class CreaturesGame {
    constructor(players, animalKey) {
        this.players = players.map((p, i) => ({
            name: p.name,
            isAI: p.isAI,
            position: 0,
            idx: i,
        }));
        this.animalKey = animalKey;
        this.currentIdx = 0;
        this.rolling = false;
        this.busy = false;
        this.over = false;
        this._aiTimer = null;
        // Multiplayer
        this.mpConn = null;
        this.myPlayerIdx = null;
        this.mpMode = false;
        // AI difficulty
        this.aiDifficulty = safeStorage.getItem('snlAiDifficulty') || 'medium';
    }

    destroy() {
        this.destroyed = true;
        if (this._aiTimer) { clearTimeout(this._aiTimer); this._aiTimer = null; }
    }

    get currentPlayer() { return this.players[this.currentIdx]; }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ── Build Board ── */
    buildBoard() {
        const board = document.getElementById('snl-board');
        board.innerHTML = '';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const sq = visualToSquare(r, c);
                const cell = document.createElement('div');
                cell.className = 'snl-cell';
                cell.id = `snl-cell-${sq}`;
                cell.classList.add((r + c) % 2 === 0 ? 'snl-cell-light' : 'snl-cell-dark');

                if (sq === 1)   cell.classList.add('snl-cell-start');
                if (sq === 100) cell.classList.add('snl-cell-finish');
                if (getSNLHazards()[sq])  cell.classList.add('snl-cell-hazard-head');
                if (getSNLLadders()[sq])  cell.classList.add('snl-cell-ladder-bot');
                // Mark ladder destination (top) squares
                const ladderTops = Object.values(getSNLLadders());
                if (ladderTops.includes(sq)) cell.classList.add('snl-cell-ladder-top');

                const num = document.createElement('span');
                num.className = 'snl-cell-num';
                num.textContent = sq;
                cell.appendChild(num);

                if (sq === 100) {
                    const ic = document.createElement('span');
                    ic.className = 'snl-cell-icon';
                    ic.textContent = '🏆';
                    cell.appendChild(ic);
                } else if (getSNLHazards()[sq]) {
                    const ic = document.createElement('span');
                    ic.className = 'snl-cell-icon';
                    ic.textContent = ANIMALS[this.animalKey].emoji;
                    cell.appendChild(ic);
                } else if (getSNLLadders()[sq]) {
                    const ic = document.createElement('span');
                    ic.className = 'snl-cell-icon';
                    ic.textContent = '🪜';
                    cell.appendChild(ic);
                }

                board.appendChild(cell);
            }
        }
        this._drawOverlay();
        this._buildTokens();
        this.players.forEach((_, i) => this._placeToken(i));
    }

    _drawOverlay() {
        const svg = document.getElementById('snl-svg');
        svg.innerHTML = '';
        const NS = 'http://www.w3.org/2000/svg';
        const animal = ANIMALS[this.animalKey];

        // Define arrowhead markers
        const defs = document.createElementNS(NS, 'defs');

        const mkArrow = (id, color) => {
            const marker = document.createElementNS(NS, 'marker');
            marker.setAttribute('id', id);
            marker.setAttribute('markerWidth', '5');
            marker.setAttribute('markerHeight', '5');
            marker.setAttribute('refX', '3');
            marker.setAttribute('refY', '2.5');
            marker.setAttribute('orient', 'auto');
            const poly = document.createElementNS(NS, 'polygon');
            poly.setAttribute('points', '0 0, 5 2.5, 0 5');
            poly.setAttribute('fill', color);
            poly.setAttribute('opacity', '0.85');
            marker.appendChild(poly);
            return marker;
        };
        defs.appendChild(mkArrow('arrow-ladder', '#f59e0b'));
        defs.appendChild(mkArrow('arrow-hazard', animal.color));
        svg.appendChild(defs);

        // Draw ladders
        Object.entries(getSNLLadders()).forEach(([from, to]) => {
            const f = squareCenter(+from);
            const t = squareCenter(+to);
            const dx = t.x - f.x, dy = t.y - f.y;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const nx = (-dy / len) * 1.4, ny = (dx / len) * 1.4;
            const color = '#f59e0b';

            // Rails
            [[nx, ny], [-nx, -ny]].forEach(([ox, oy], ri) => {
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', f.x + ox); line.setAttribute('y1', f.y + oy);
                line.setAttribute('x2', t.x + ox); line.setAttribute('y2', t.y + oy);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '0.9');
                line.setAttribute('stroke-linecap', 'round');
                if (ri === 0) line.setAttribute('marker-end', 'url(#arrow-ladder)');
                svg.appendChild(line);
            });

            // Rungs
            const numRungs = Math.max(2, Math.floor(len / 6));
            for (let i = 1; i <= numRungs; i++) {
                const p = i / (numRungs + 1);
                const rx = f.x + dx * p, ry = f.y + dy * p;
                const rung = document.createElementNS(NS, 'line');
                rung.setAttribute('x1', rx + nx); rung.setAttribute('y1', ry + ny);
                rung.setAttribute('x2', rx - nx); rung.setAttribute('y2', ry - ny);
                rung.setAttribute('stroke', color);
                rung.setAttribute('stroke-width', '0.7');
                svg.appendChild(rung);
            }

            // Emoji at bottom
            const em = document.createElementNS(NS, 'text');
            em.setAttribute('x', f.x); em.setAttribute('y', f.y + 1);
            em.setAttribute('text-anchor', 'middle');
            em.setAttribute('dominant-baseline', 'middle');
            em.setAttribute('font-size', '3.5');
            em.textContent = '🪜';
            svg.appendChild(em);
        });

        // Draw hazard animals
        Object.entries(getSNLHazards()).forEach(([head, tail], i) => {
            const h = squareCenter(+head);
            const t = squareCenter(+tail);
            const cx = (h.x + t.x) / 2 + (i % 2 === 0 ? 12 : -12);
            const cy = (h.y + t.y) / 2;

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', `M ${h.x} ${h.y} Q ${cx} ${cy} ${t.x} ${t.y}`);
            path.setAttribute('stroke', animal.color);
            path.setAttribute('stroke-width', '2.2');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('opacity', '0.75');
            path.setAttribute('marker-end', 'url(#arrow-hazard)');
            svg.appendChild(path);

            // Emoji at head
            const em = document.createElementNS(NS, 'text');
            em.setAttribute('x', h.x); em.setAttribute('y', h.y);
            em.setAttribute('text-anchor', 'middle');
            em.setAttribute('dominant-baseline', 'middle');
            em.setAttribute('font-size', '4.5');
            em.textContent = animal.emoji;
            svg.appendChild(em);
        });
    }

    _buildTokens() {
        const layer = document.getElementById('snl-tokens');
        layer.innerHTML = '';
        this.players.forEach((_, i) => {
            const tok = document.createElement('div');
            tok.className = `snl-token ${TOKEN_CLASSES[i]}`;
            tok.id = `snl-token-${i}`;
            tok.textContent = `P${i + 1}`;
            layer.appendChild(tok);
        });
    }

    _placeToken(playerIdx) {
        const player = this.players[playerIdx];
        const tok = document.getElementById(`snl-token-${playerIdx}`);
        if (!tok) return;
        if (player.position === 0) {
            // Off-board start position
            const { row, col } = squareToPos(1);
            tok.style.left = `${col * 10 + 5 - (playerIdx * 2.5)}%`;
            tok.style.top  = `${row * 10 + 5 + 9}%`;
            return;
        }
        const { row, col } = squareToPos(player.position);
        // Offset tokens that share a square
        const offset = (playerIdx * 2.2) % 6 - 3;
        tok.style.left = `${col * 10 + 5 + (playerIdx % 2 === 0 ? offset : -offset)}%`;
        tok.style.top  = `${row * 10 + 5 + (playerIdx < 2 ? -2 : 2)}%`;
    }

    _updateActiveToken() {
        document.querySelectorAll('.snl-token').forEach((t, i) => {
            t.classList.toggle('active-token', i === this.currentIdx && !this.over);
        });
    }

    _showGhostToken(playerIdx, targetSquare) {
        this._clearGhostToken();
        const layer = document.getElementById('snl-tokens');
        if (!layer) return;
        const ghost = document.createElement('div');
        ghost.className = `snl-ghost-token ${TOKEN_CLASSES[playerIdx]}`;
        ghost.id = 'snl-ghost-token';
        ghost.style.opacity = '0.45';
        const { row, col } = squareToPos(targetSquare);
        const offset = (playerIdx * 2.2) % 6 - 3;
        ghost.style.left = `${col * 10 + 5 + (playerIdx % 2 === 0 ? offset : -offset)}%`;
        ghost.style.top  = `${row * 10 + 5 + (playerIdx < 2 ? -2 : 2)}%`;
        ghost.textContent = `P${playerIdx + 1}`;
        layer.appendChild(ghost);
    }

    _clearGhostToken() {
        const existing = document.getElementById('snl-ghost-token');
        if (existing) existing.remove();
    }

    updatePlayersPanel() {
        const panel = document.getElementById('snl-players-status');
        panel.innerHTML = '';
        this.players.forEach((p, i) => {
            const card = document.createElement('div');
            card.className = `snl-player-card${i === this.currentIdx ? ' current-turn' : ''}`;
            if (p.won) card.classList.add('winner-card');
            const pct = Math.min(100, Math.round(p.position));
            card.innerHTML = `
                <div class="snl-player-card-top">
                    <div class="snl-player-dot ${TOKEN_CLASSES[i]}"></div>
                    <div class="snl-player-info">
                        <div class="snl-player-name-display">${p.name}${p.isAI ? ' 🤖' : ''}</div>
                        <div class="snl-player-pos-display">${p.won ? '🏆 Winner!' : (p.position === 0 ? 'Ready to start!' : `Square ${p.position} / 100`)}</div>
                    </div>
                </div>
                <div class="snl-player-progress">
                    <div class="snl-player-progress-fill" style="width:${pct}%"></div>
                </div>`;
            panel.appendChild(card);
        });
    }

    setMessage(msg) {
        document.getElementById('snl-message').textContent = msg;
    }

    setTurnDisplay() {
        const p = this.currentPlayer;
        document.getElementById('snl-turn-display').textContent =
            `${p.name}'s Turn${p.isAI ? ' 🤖' : ''}`;
    }

    setRollBtnState() {
        if (this.destroyed) return;
        const btn = document.getElementById('snl-roll-btn');
        const p = this.currentPlayer;
        const mpBlock = this.mpMode && this.myPlayerIdx !== this.currentIdx;
        btn.disabled = this.busy || this.over || p.isAI || mpBlock;
    }

    /* ── Roll ── */
    async roll() {
        if (this.busy || this.over) return;
        if (this.currentPlayer.isAI) return;
        if (this.mpMode && this.myPlayerIdx !== this.currentIdx) return;
        const result = Math.floor(Math.random() * 6) + 1;
        // In MP mode, send the roll to peer before animating
        if (this.mpMode && this.mpConn) {
            try { this.mpConn.send({ type: 'snl-roll', result }); } catch (_) {}
        }
        await this._doRoll(result);
    }

    async _doRoll(predeterminedResult) {
        if (this.busy) return;
        this.busy = true;
        this.setRollBtnState();
        sound.playDice();

        // Determine result
        const result = (predeterminedResult !== undefined)
            ? predeterminedResult
            : Math.floor(Math.random() * 6) + 1;

        try {
            // Animate 3D dice
            await rollDice3D(result);
            await this._movePlayer(result);
        } catch (err) {
            // On any unexpected error, recover by resetting and advancing turn
            this.busy = false;
            this.setRollBtnState();
        }
    }

    async _movePlayer(steps) {
        const player = this.currentPlayer;
        const newPos = player.position + steps;

        if (newPos > 100) {
            this.setMessage(`Need ${100 - player.position} or less! Stay at ${player.position || 'Start'}.`);
            await this._sleep(900);
            this._nextTurn();
            return;
        }

        // Show ghost/shadow token at destination before movement begins
        this._showGhostToken(this.currentIdx, newPos);
        await this._sleep(700);
        this._clearGhostToken();

        // Step-by-step movement
        const from = player.position;
        const stepDelay = getStepDelay();
        for (let pos = from + 1; pos <= newPos; pos++) {
            player.position = pos;
            this._placeToken(this.currentIdx);
            sound.playStep();
            await this._sleep(stepDelay);
        }

        // Check win first
        if (player.position === 100) {
            await this._handleWin();
            return;
        }

        // Check hazard
        if (getSNLHazards()[player.position]) {
            const dest = getSNLHazards()[player.position];
            const a = ANIMALS[this.animalKey];
            const msg = currentAgeGroup === 'age-tiny'
                ? `${a.emoji} Oh no! Go back to ${dest}!`
                : `${a.emoji} Oh no! ${a.name} slide you to ${dest}!`;
            this.setMessage(msg);
            sound.playAnimal(this.animalKey);
            const container = document.getElementById('snl-board-container');
            container.classList.add('board-shake');
            await this._sleep(600);
            container.classList.remove('board-shake');
            player.position = dest;
            this._placeToken(this.currentIdx);
            await this._sleep(400);

        } else if (getSNLLadders()[player.position]) {
            const dest = getSNLLadders()[player.position];
            const msg = currentAgeGroup === 'age-tiny'
                ? `🪜 Yay! Move forward to ${dest}!`
                : `🪜 Lucky! Ladder up to ${dest}!`;
            this.setMessage(msg);
            sound.playLadder();
            await this._sleep(700);
            player.position = dest;
            this._placeToken(this.currentIdx);
            const tok = document.getElementById(`snl-token-${this.currentIdx}`);
            if (tok) {
                tok.classList.add('token-bounce');
                await this._sleep(550);
                tok.classList.remove('token-bounce');
            }
        } else {
            this.setMessage('');
        }

        this.updatePlayersPanel();

        // Check win after hazard/ladder
        if (player.position === 100) {
            await this._handleWin();
            return;
        }

        this._nextTurn();
    }

    async _handleWin() {
        this.over = true;
        this.busy = false;
        const p = this.currentPlayer;
        p.won = true;
        this.setMessage(`🏆 ${p.name} wins! Amazing!`);
        document.getElementById('snl-turn-display').textContent = `🎉 ${p.name} wins!`;
        sound.playWin();
        launchBigConfetti();
        this.updatePlayersPanel();
        this._updateActiveToken();
        this.setRollBtnState();
    }

    _nextTurn() {
        this.busy = false;
        this.currentIdx = (this.currentIdx + 1) % this.players.length;
        this._updateActiveToken();
        this.updatePlayersPanel();
        this.setTurnDisplay();
        this.setRollBtnState();

        if (this.players[this.currentIdx].isAI && !this.over) {
            const diff = this.aiDifficulty || 'medium';
            let delay = 1100;
            if (diff === 'easy') delay = 1400;
            else if (diff === 'hard') delay = 700;

            // Easy: 30% chance to skip turn
            if (diff === 'easy' && Math.random() < 0.30) {
                this.setMessage('🤖 Computer is thinking...');
                this._aiTimer = setTimeout(() => {
                    this._aiTimer = null;
                    this.busy = false;
                    this._nextTurn(); // skip
                }, delay);
                return;
            }

            this._aiTimer = setTimeout(() => {
                this._aiTimer = null;
                this._doRoll();
            }, delay);
        }
    }
}

/* ═══════════════════════════════════════════════════════════════
   SNL — SETUP UI
═══════════════════════════════════════════════════════════════ */
let snlGame = null;
let snlAnimal = 'frog';
let snlPlayerCount = 2;

function buildPlayerConfigs(count) {
    const container = document.getElementById('snl-player-configs');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'snl-player-config';
        const badge = document.createElement('div');
        badge.className = `player-token-badge p${i}`;
        badge.textContent = `P${i + 1}`;
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'snl-name-input';
        nameInput.value = DEFAULT_NAMES[i];
        nameInput.maxLength = 14;
        nameInput.placeholder = `Player ${i + 1}`;
        const aiToggle = document.createElement('button');
        aiToggle.type = 'button';
        aiToggle.className = 'snl-ai-toggle';
        aiToggle.dataset.isAi = 'false';
        aiToggle.dataset.playerIdx = i;
        aiToggle.textContent = '👤 Human';
        aiToggle.addEventListener('click', () => {
            const isAi = aiToggle.dataset.isAi === 'true';
            aiToggle.dataset.isAi = String(!isAi);
            aiToggle.textContent = !isAi ? '🤖 Computer' : '👤 Human';
            aiToggle.classList.toggle('snl-ai-toggle-on', !isAi);
        });
        row.appendChild(badge);
        row.appendChild(nameInput);
        row.appendChild(aiToggle);
        container.appendChild(row);
    }
}

// Animal picker
document.querySelectorAll('.animal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.animal-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        snlAnimal = btn.dataset.animal;
        const a = ANIMALS[snlAnimal];
        document.getElementById('tab-snl-label').textContent = `${a.emoji} ${a.name} & Ladders`;
        document.getElementById('snl-main-title').textContent = `${a.emoji} ${a.name} & Ladders`;
    });
});

// Player count
document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.count-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        snlPlayerCount = +btn.dataset.count;
        buildPlayerConfigs(snlPlayerCount);
    });
});

// Build initial player configs
buildPlayerConfigs(snlPlayerCount);

// Start game
document.getElementById('snl-start-btn').addEventListener('click', () => {
    const configs = [];
    document.querySelectorAll('.snl-player-config').forEach((row, i) => {
        const nameEl    = row.querySelector('.snl-name-input');
        const aiToggle  = row.querySelector('.snl-ai-toggle');
        configs.push({
            name: (nameEl.value.trim() || DEFAULT_NAMES[i]).slice(0, 14),
            isAI: aiToggle ? aiToggle.dataset.isAi === 'true' : false,
        });
    });

    if (snlGame) snlGame.destroy();
    snlGame = new CreaturesGame(configs, snlAnimal);
    snlGame.aiDifficulty = safeStorage.getItem('snlAiDifficulty') || 'medium';

    document.getElementById('snl-setup').classList.add('hidden');
    document.getElementById('snl-game-screen').classList.remove('hidden');

    snlGame.buildBoard();
    snlGame.setTurnDisplay();
    snlGame.setMessage('');
    snlGame.updatePlayersPanel();
    snlGame.setRollBtnState();
    snlGame._updateActiveToken();

    // If first player is AI, kick it off
    if (snlGame.currentPlayer.isAI) {
        snlGame._aiTimer = setTimeout(() => {
            snlGame._aiTimer = null;
            snlGame._doRoll();
        }, 1200);
    }
});

// Roll button
document.getElementById('snl-roll-btn').addEventListener('click', () => {
    if (snlGame) snlGame.roll();
});

// Back to setup
document.getElementById('snl-back-btn').addEventListener('click', () => {
    if (snlGame) {
        snlGame.destroy();
        // Close any MP connection
        if (snlGame.mpConn) { try { snlGame.mpConn.close(); } catch (_) {} }
        snlGame = null;
    }
    snlDestroyPeer();
    document.getElementById('snl-game-screen').classList.add('hidden');
    document.getElementById('snl-setup').classList.remove('hidden');
});

/* ═══════════════════════════════════════════════════════════════
   SNL — S&L MULTIPLAYER (PeerJS)
═══════════════════════════════════════════════════════════════ */
let snlPeer = null;
let snlConn = null;

function snlDestroyPeer() {
    if (snlConn) { try { snlConn.close(); } catch (_) {} snlConn = null; }
    if (snlPeer) { try { snlPeer.destroy(); } catch (_) {} snlPeer = null; }
}

function snlSetMpStatus(text, type) {
    const el = document.getElementById('snl-mp-status-text');
    if (!el) return;
    el.textContent = text;
    el.className = `mp-status${type ? ' ' + type : ''}`;
}

function openSnlMpOverlay() {
    const overlay = document.getElementById('snl-mp-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.getElementById('snl-mp-lobby').classList.remove('hidden');
    document.getElementById('snl-mp-waiting').classList.add('hidden');
    snlSetMpStatus('');
    const inp = document.getElementById('snl-mp-code-input');
    if (inp) inp.value = '';
}

function closeSnlMpOverlay() {
    const overlay = document.getElementById('snl-mp-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function startSnlMultiplayerGame(myIdx) {
    closeSnlMpOverlay();

    // Build a 2-player game (host = P1/idx 0, guest = P2/idx 1)
    const hostName = (document.querySelector('.snl-name-input') || {}).value || 'Player 1';
    const configs = [
        { name: hostName.trim() || 'Player 1', isAI: false },
        { name: 'Online Player', isAI: false },
    ];

    if (snlGame) snlGame.destroy();
    snlGame = new CreaturesGame(configs, snlAnimal);
    snlGame.mpMode = true;
    snlGame.myPlayerIdx = myIdx;
    snlGame.mpConn = snlConn;
    snlGame.aiDifficulty = safeStorage.getItem('snlAiDifficulty') || 'medium';

    document.getElementById('snl-setup').classList.add('hidden');
    document.getElementById('snl-game-screen').classList.remove('hidden');

    snlGame.buildBoard();
    snlGame.setTurnDisplay();
    snlGame.setMessage(myIdx === 0 ? "Your turn! Roll the dice!" : "Waiting for opponent to roll...");
    snlGame.updatePlayersPanel();
    snlGame.setRollBtnState();
    snlGame._updateActiveToken();
}

function setupSnlConnHandlers(connection, isHost) {
    snlConn = connection;

    if (!isHost) {
        // Guest side: wait for connection open, then start game
        connection.on('open', () => {
            snlSetMpStatus('Connected!', 'connected');
            const hint = document.getElementById('snl-mp-hint');
            if (hint) hint.textContent = 'Connected! Starting game...';
            setTimeout(() => startSnlMultiplayerGame(1), 700);
        });
    }

    connection.on('data', (data) => {
        if (!snlGame || !snlGame.mpMode) return;
        if (data.type === 'snl-roll') {
            if (typeof data.result === 'number' && data.result >= 1 && data.result <= 6) {
                if (!snlGame.busy && !snlGame.over) {
                    snlGame._doRoll(data.result);
                }
            }
        } else if (data.type === 'snl-reset') {
            const myIdx = snlGame ? snlGame.myPlayerIdx : (isHost ? 0 : 1);
            if (snlGame) snlGame.destroy();
            startSnlMultiplayerGame(myIdx);
        }
    });

    connection.on('close', () => {
        if (snlGame && snlGame.mpMode) {
            snlGame.setMessage('Opponent disconnected.');
            snlGame.mpMode = false;
            snlGame.mpConn = null;
            snlGame.setRollBtnState();
        }
        snlConn = null;
    });

    connection.on('error', (err) => {
        snlSetMpStatus(`Error: ${err.type}`, 'error');
    });
}

// Open MP overlay button
const snlMpOpenBtn = document.getElementById('snl-mp-open-btn');
if (snlMpOpenBtn) {
    snlMpOpenBtn.addEventListener('click', openSnlMpOverlay);
}

// Close MP overlay
const snlMpCloseBtn = document.getElementById('snl-mp-close');
if (snlMpCloseBtn) {
    snlMpCloseBtn.addEventListener('click', () => {
        closeSnlMpOverlay();
        snlDestroyPeer();
    });
}

const snlMpOverlay = document.getElementById('snl-mp-overlay');
if (snlMpOverlay) {
    snlMpOverlay.addEventListener('click', (e) => {
        if (e.target === snlMpOverlay) {
            closeSnlMpOverlay();
            snlDestroyPeer();
        }
    });
}

// Create game room
const snlMpCreateBtn = document.getElementById('snl-mp-create');
if (snlMpCreateBtn) {
    snlMpCreateBtn.addEventListener('click', () => {
        snlDestroyPeer();
        document.getElementById('snl-mp-lobby').classList.add('hidden');
        document.getElementById('snl-mp-waiting').classList.remove('hidden');
        document.getElementById('snl-mp-room-code').textContent = '—';
        const hint = document.getElementById('snl-mp-hint');
        if (hint) hint.textContent = 'Connecting to server...';
        snlSetMpStatus('');
        const snlMpCopyBtn = document.getElementById('snl-mp-copy');
        if (snlMpCopyBtn) snlMpCopyBtn.disabled = true;

        const roomCode = generateSnlRoomCode();
        snlPeer = new Peer(roomCode);

        snlPeer.on('open', (id) => {
            document.getElementById('snl-mp-room-code').textContent = id;
            if (hint) hint.textContent = 'Waiting for a friend to join...';
            if (snlMpCopyBtn) snlMpCopyBtn.disabled = false;
        });

        snlPeer.on('connection', (connection) => {
            if (snlConn) { connection.close(); return; }
            if (hint) hint.textContent = 'Friend connected! Starting game...';
            setupSnlConnHandlers(connection, true);
            // Host is player index 0 — start after connection opens
            connection.on('open', () => {
                setTimeout(() => startSnlMultiplayerGame(0), 700);
            });
        });

        snlPeer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                snlPeer.destroy();
                snlMpCreateBtn.click();
                return;
            }
            snlSetMpStatus(`Error: ${err.type}`, 'error');
            document.getElementById('snl-mp-lobby').classList.remove('hidden');
            document.getElementById('snl-mp-waiting').classList.add('hidden');
        });
    });
}

// Copy room code
const snlMpCopyBtn = document.getElementById('snl-mp-copy');
if (snlMpCopyBtn) {
    snlMpCopyBtn.addEventListener('click', () => {
        const code = document.getElementById('snl-mp-room-code').textContent;
        if (code && code !== '—') {
            navigator.clipboard.writeText(code).then(() => {
                snlMpCopyBtn.textContent = 'Copied!';
                setTimeout(() => { snlMpCopyBtn.textContent = 'Copy'; }, 2000);
            });
        }
    });
}

// Join game room
const snlMpJoinBtn = document.getElementById('snl-mp-join');
if (snlMpJoinBtn) {
    snlMpJoinBtn.addEventListener('click', () => {
        const inp = document.getElementById('snl-mp-code-input');
        const code = (inp ? inp.value.trim().toUpperCase() : '');
        if (!code) return;
        snlMpJoinBtn.disabled = true;
        snlDestroyPeer();
        snlSetMpStatus('Connecting...', '');
        snlPeer = new Peer();
        snlPeer.on('open', () => {
            const c = snlPeer.connect(code, { reliable: true });
            setupSnlConnHandlers(c, false);
        });
        snlPeer.on('error', (err) => {
            snlSetMpStatus(`Error: ${err.type}`, 'error');
            snlMpJoinBtn.disabled = false;
        });
    });
}

/* ═══════════════════════════════════════════════════════════════
   SNL AI DIFFICULTY SETTING
═══════════════════════════════════════════════════════════════ */
const snlDifficultySelect = document.getElementById('snl-difficulty-select');
if (snlDifficultySelect) {
    snlDifficultySelect.value = safeStorage.getItem('snlAiDifficulty') || 'medium';
    snlDifficultySelect.addEventListener('change', () => {
        const val = snlDifficultySelect.value;
        safeStorage.setItem('snlAiDifficulty', val);
        if (snlGame) snlGame.aiDifficulty = val;
    });
}

/* ═══════════════════════════════════════════════════════════════
   TIC-TAC-TOE
═══════════════════════════════════════════════════════════════ */
const cells = document.querySelectorAll('.cell');
const boardEl = document.getElementById('board');
const winLine = document.getElementById('win-line');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const undoBtn = document.getElementById('undo');
const resetScoresBtn = document.getElementById('reset-scores');
const modeBtn = document.getElementById('mode');
const scoreLabelX = document.getElementById('score-label-x');
const scoreLabelO = document.getElementById('score-label-o');
const scoreCardX = document.querySelector('.score-item.score-x');
const scoreCardO = document.querySelector('.score-item.score-o');

let currentPlayer = 'X';
let gameActive = true;
let aiMode = false;
let board = ['', '', '', '', '', '', '', '', ''];
let moveHistory = [];
let aiTimeoutId = null;
let autoAdvanceIntervalId = null;
let autoAdvanceTimeoutId = null;
let aiDifficulty = safeStorage.getItem('aiDifficulty') || 'easy';

let multiplayerMode = false;
let peer = null;
let conn = null;
let myRole = null;

function loadPlayerNames() {
    let saved = null;
    try { saved = JSON.parse(safeStorage.getItem('playerNames') || 'null'); } catch { saved = null; }
    return { X: sanitizePlayerName(saved?.X, 'X'), O: sanitizePlayerName(saved?.O, 'O') };
}

let playerNames = loadPlayerNames();

let savedScores = null;
try { savedScores = JSON.parse(safeStorage.getItem('scores') || 'null'); } catch { savedScores = null; }
const scores = {
    X:    Number.isInteger(savedScores?.X)    ? savedScores.X    : 0,
    O:    Number.isInteger(savedScores?.O)    ? savedScores.O    : 0,
    draw: Number.isInteger(savedScores?.draw) ? savedScores.draw : 0,
};

const winningConditions = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
];

function sanitizePlayerName(raw, player) {
    const t = String(raw || '').trim().slice(0, 16);
    return t || `Player ${player}`;
}

function getPlayerName(player) {
    if (multiplayerMode) return player === myRole ? 'You' : 'Opponent';
    if (aiMode && player === 'O') return 'AI';
    return playerNames[player];
}

function persistPlayerNames() { safeStorage.setItem('playerNames', JSON.stringify(playerNames)); }

function updateNameDisplay() {
    scoreLabelX.textContent = getPlayerName('X');
    scoreLabelO.textContent = getPlayerName('O');
}

function updateStatus(text, type) {
    statusDisplay.textContent = text;
    statusDisplay.className = type ? `status-${type.toLowerCase()}` : '';
}

function clearAutoAdvance() {
    if (autoAdvanceIntervalId !== null) { clearInterval(autoAdvanceIntervalId); autoAdvanceIntervalId = null; }
    if (autoAdvanceTimeoutId !== null)  { clearTimeout(autoAdvanceTimeoutId);  autoAdvanceTimeoutId = null; }
}

function setActivePlayerHighlight() {
    scoreCardX.classList.remove('active-turn');
    scoreCardO.classList.remove('active-turn');
    if (!gameActive) return;
    if (currentPlayer === 'X') scoreCardX.classList.add('active-turn');
    if (currentPlayer === 'O') scoreCardO.classList.add('active-turn');
}

function updateUndoButtonState() {
    undoBtn.disabled = aiMode || multiplayerMode || !gameActive || moveHistory.length === 0;
}

function setAiThinking(isThinking) { boardEl.classList.toggle('ai-thinking', isThinking); }

function triggerConfettiBurst(player) {
    const burst = document.createElement('div');
    burst.className = `confetti-burst ${player.toLowerCase()}`;
    for (let i = 0; i < 28; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 50 + Math.random() * 120;
        piece.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        piece.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        piece.style.setProperty('--rot', `${Math.floor(Math.random() * 720 - 360)}deg`);
        piece.style.setProperty('--delay', `${Math.floor(Math.random() * 80)}ms`);
        piece.style.setProperty('--duration', `${620 + Math.floor(Math.random() * 320)}ms`);
        burst.appendChild(piece);
    }
    boardEl.appendChild(burst);
    setTimeout(() => burst.remove(), 1100);
}

function startAutoAdvance(message, type) {
    if (multiplayerMode) return;
    clearAutoAdvance();
    let remaining = 3;
    updateStatus(`${message} Next round in ${remaining}...`, type);
    autoAdvanceIntervalId = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) updateStatus(`${message} Next round in ${remaining}...`, type);
    }, 1000);
    autoAdvanceTimeoutId = setTimeout(() => { clearAutoAdvance(); resetGame({ preserveCountdown: false }); }, 3000);
}

function getTurnMessage() {
    if (multiplayerMode) {
        return currentPlayer === myRole ? `Your turn (${currentPlayer})` : `Opponent's turn (${currentPlayer})`;
    }
    if (aiMode && currentPlayer === 'O') return "AI's turn";
    return `${getPlayerName(currentPlayer)}'s turn`;
}

function handleCellClick(e) {
    attemptMove(parseInt(e.currentTarget.getAttribute('data-cell-index'), 10));
}

function handleCellKeydown(e) {
    const index = parseInt(e.currentTarget.getAttribute('data-cell-index'), 10);
    let next = null;
    if (e.key === 'ArrowLeft'  && index % 3 !== 0) next = index - 1;
    if (e.key === 'ArrowRight' && index % 3 !== 2) next = index + 1;
    if (e.key === 'ArrowUp'    && index >= 3)       next = index - 3;
    if (e.key === 'ArrowDown'  && index <= 5)       next = index + 3;
    if (next !== null) { e.preventDefault(); cells[next].focus(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attemptMove(index); }
}

function attemptMove(index) {
    if (board[index] !== '' || !gameActive) return;
    if (aiMode && currentPlayer === 'O') return;
    if (multiplayerMode && currentPlayer !== myRole) return;
    const player = aiMode ? 'X' : currentPlayer;
    makeMove(index, player);
    if (multiplayerMode && conn) conn.send({ type: 'move', index });
    if (aiMode && gameActive) { setAiThinking(true); aiTimeoutId = setTimeout(aiMove, 400); }
}

function makeMove(index, player) {
    board[index] = player;
    moveHistory.push({ index, player });
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase(), 'taken', 'pop');
    cell.addEventListener('animationend', () => cell.classList.remove('pop'), { once: true });
    sound.playTTTMove();

    const result = checkResult();
    if (result === 'win') {
        const winnerName = getPlayerName(player);
        const message = `${winnerName} wins!`;
        updateStatus(message, player);
        triggerConfettiBurst(player);
        sound.playTTTWin();
        scores[player] += 1;
        updateScoreDisplay();
        gameActive = false;
        setActivePlayerHighlight();
        updateUndoButtonState();
        startAutoAdvance(message, player);
        return;
    }
    if (result === 'draw') {
        const message = "It's a draw!";
        updateStatus(message, 'draw');
        scores.draw += 1;
        updateScoreDisplay();
        gameActive = false;
        setActivePlayerHighlight();
        updateUndoButtonState();
        startAutoAdvance(message, 'draw');
        return;
    }
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();
}

function evaluateBoard(b) {
    for (const [a, bi, c] of winningConditions) {
        if (b[a] && b[a] === b[bi] && b[a] === b[c]) return b[a] === 'O' ? 1 : -1;
    }
    return 0;
}

function minimax(b, depth, isMaximizing) {
    const score = evaluateBoard(b);
    if (score !== 0) return score * (10 - depth);
    if (!b.includes('')) return 0;
    const empty = b.map((v, i) => (v === '' ? i : null)).filter(v => v !== null);
    if (isMaximizing) {
        let best = -Infinity;
        for (const i of empty) { b[i]='O'; best=Math.max(best,minimax(b,depth+1,false)); b[i]=''; }
        return best;
    }
    let best = Infinity;
    for (const i of empty) { b[i]='X'; best=Math.min(best,minimax(b,depth+1,true)); b[i]=''; }
    return best;
}

function aiMove() {
    setAiThinking(false);
    aiTimeoutId = null;
    if (!gameActive) return;
    const empty = board.map((v, i) => (v === '' ? i : null)).filter(v => v !== null);
    if (empty.length === 0) return;
    let idx;
    if (aiDifficulty === 'easy' || (aiDifficulty === 'medium' && Math.random() < 0.5)) {
        idx = empty[Math.floor(Math.random() * empty.length)];
    } else {
        let bestScore = -Infinity, bestIdx = empty[0];
        for (const i of empty) {
            const b = [...board]; b[i] = 'O';
            const s = minimax(b, 0, false);
            if (s > bestScore) { bestScore = s; bestIdx = i; }
        }
        idx = bestIdx;
    }
    makeMove(idx, 'O');
}

function checkResult() {
    for (const [a, b, c] of winningConditions) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            cells[a].classList.add('winner');
            cells[b].classList.add('winner');
            cells[c].classList.add('winner');
            drawWinLine(a, b, c);
            return 'win';
        }
    }
    if (!board.includes('')) return 'draw';
    return null;
}

function drawWinLine(a, b, c) {
    winLine.className = 'win-line';
    if (a===0&&b===1&&c===2) winLine.classList.add('row-0');
    else if (a===3&&b===4&&c===5) winLine.classList.add('row-1');
    else if (a===6&&b===7&&c===8) winLine.classList.add('row-2');
    else if (a===0&&b===3&&c===6) winLine.classList.add('col-0');
    else if (a===1&&b===4&&c===7) winLine.classList.add('col-1');
    else if (a===2&&b===5&&c===8) winLine.classList.add('col-2');
    else if (a===0&&b===4&&c===8) winLine.classList.add('diag-main');
    else if (a===2&&b===4&&c===6) winLine.classList.add('diag-anti');
}

function updateScoreDisplay() {
    document.getElementById('score-x').textContent    = scores.X;
    document.getElementById('score-o').textContent    = scores.O;
    document.getElementById('score-draw').textContent = scores.draw;
    safeStorage.setItem('scores', JSON.stringify(scores));
}

function resetBoardVisuals() {
    winLine.className = 'win-line';
    cells.forEach(cell => { cell.textContent = ''; cell.className = 'cell'; });
}

function resetGame(options = {}) {
    const { preserveCountdown = false } = options;
    if (aiTimeoutId !== null) { clearTimeout(aiTimeoutId); aiTimeoutId = null; }
    if (!preserveCountdown) clearAutoAdvance();
    setAiThinking(false);
    board = ['','','','','','','','',''];
    moveHistory = [];
    resetBoardVisuals();
    gameActive = true;
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();
    if (aiMode && currentPlayer === 'O') { setAiThinking(true); aiTimeoutId = setTimeout(aiMove, 400); }
}

function undoLastMove() {
    if (undoBtn.disabled) return;
    const lastMove = moveHistory.pop();
    if (!lastMove) return;
    board[lastMove.index] = '';
    const cell = cells[lastMove.index];
    cell.textContent = '';
    cell.className = 'cell';
    currentPlayer = lastMove.player;
    winLine.className = 'win-line';
    cells.forEach(c => c.classList.remove('winner'));
    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();
}

cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
    cell.addEventListener('keydown', handleCellKeydown);
});

resetBtn.addEventListener('click', () => {
    if (multiplayerMode && myRole !== 'X') { updateStatus('Ask the host to start a new round.', null); return; }
    resetGame();
    if (multiplayerMode && conn) conn.send({ type: 'reset', starterPlayer: currentPlayer });
});

undoBtn.addEventListener('click', undoLastMove);

resetScoresBtn.addEventListener('click', () => {
    if (multiplayerMode && myRole !== 'X') { updateStatus('Ask the host to reset scores.', null); return; }
    scores.X = 0; scores.O = 0; scores.draw = 0;
    updateScoreDisplay();
    resetGame();
    if (multiplayerMode && conn) {
        conn.send({ type: 'reset-scores' });
        conn.send({ type: 'reset', starterPlayer: currentPlayer });
    }
});

modeBtn.addEventListener('click', () => {
    if (multiplayerMode) return;
    aiMode = !aiMode;
    modeBtn.textContent = aiMode ? 'Switch to Human Mode' : 'Switch to AI Mode';
    updateNameDisplay();
    resetGame();
});

// Settings
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose   = document.getElementById('settings-close');
const darkModeToggle  = document.getElementById('dark-mode-toggle');
const settingsPanel   = document.getElementById('settings-panel');
const difficultySelect= document.getElementById('difficulty-select');
const playerXNameInput= document.getElementById('player-x-name');
const playerONameInput= document.getElementById('player-o-name');

function openSettings()  { settingsOverlay.classList.remove('hidden'); darkModeToggle.focus(); }
function closeSettings() { settingsOverlay.classList.add('hidden'); settingsBtn.focus(); }

function savePlayerName(player, raw) {
    playerNames[player] = sanitizePlayerName(raw, player);
    persistPlayerNames();
    updateNameDisplay();
    if (gameActive) updateStatus(getTurnMessage(), currentPlayer);
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });
settingsOverlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSettings(); return; }
    if (e.key === 'Tab') {
        const focusable = settingsPanel.querySelectorAll('input, button, select, [tabindex]');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

playerXNameInput.value = playerNames.X;
playerONameInput.value = playerNames.O;

playerXNameInput.addEventListener('change', () => { savePlayerName('X', playerXNameInput.value); playerXNameInput.value = playerNames.X; });
playerONameInput.addEventListener('change', () => { savePlayerName('O', playerONameInput.value); playerONameInput.value = playerNames.O; });

darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode', darkModeToggle.checked);
    safeStorage.setItem('darkMode', darkModeToggle.checked);
});

if (safeStorage.getItem('darkMode') === 'true') {
    darkModeToggle.checked = true;
    document.body.classList.add('dark-mode');
}

difficultySelect.value = aiDifficulty;
difficultySelect.addEventListener('change', () => {
    aiDifficulty = difficultySelect.value;
    safeStorage.setItem('aiDifficulty', aiDifficulty);
});

// Multiplayer (PeerJS WebRTC)
const mpBtn        = document.getElementById('mp-btn');
const mpOverlay    = document.getElementById('mp-overlay');
const mpLobby      = document.getElementById('mp-lobby');
const mpWaiting    = document.getElementById('mp-waiting');
const mpRoomCode   = document.getElementById('mp-room-code');
const mpStatusText = document.getElementById('mp-status-text');
const mpCodeInput  = document.getElementById('mp-code-input');
const mpHint       = document.getElementById('mp-hint');

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function isValidPlayerSymbol(v) { return v === 'X' || v === 'O'; }

function openMultiplayerLobby() {
    mpOverlay.classList.remove('hidden');
    mpLobby.classList.remove('hidden');
    mpWaiting.classList.add('hidden');
    mpStatusText.textContent = '';
    mpStatusText.className = 'mp-status';
    mpCodeInput.value = '';
}

function closeMultiplayerLobby() { mpOverlay.classList.add('hidden'); }

function setMpStatus(text, type) {
    mpStatusText.textContent = text;
    mpStatusText.className = `mp-status${type ? ' ' + type : ''}`;
}

function destroyPeer() {
    if (conn) { try { conn.close(); } catch {} conn = null; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
}

function enterMultiplayerMode(role) {
    multiplayerMode = true; myRole = role; aiMode = false;
    modeBtn.textContent = 'Switch to AI Mode';
    modeBtn.disabled = true;
    closeMultiplayerLobby();
    mpBtn.textContent = 'Disconnect';
    updateNameDisplay();
}

function exitMultiplayerMode() {
    destroyPeer();
    multiplayerMode = false; myRole = null;
    mpBtn.textContent = 'Multiplayer';
    modeBtn.disabled = false;
    updateNameDisplay();
    resetGame();
}

function setupConnHandlers(connection) {
    conn = connection;
    conn.on('open', () => {
        if (myRole === 'X') { enterMultiplayerMode('X'); resetGame(); conn.send({ type: 'init', starterPlayer: currentPlayer }); }
        else { setMpStatus('Connected! Waiting for game start...', 'connected'); }
    });
    conn.on('data', (data) => {
        switch (data.type) {
            case 'init':
                if (!isValidPlayerSymbol(data.starterPlayer)) break;
                enterMultiplayerMode('O'); resetGame();
                currentPlayer = data.starterPlayer;
                updateStatus(getTurnMessage(), currentPlayer);
                setActivePlayerHighlight(); updateUndoButtonState();
                break;
            case 'move':
                if (typeof data.index === 'number' && data.index >= 0 && data.index <= 8 && Number.isInteger(data.index))
                    makeMove(data.index, currentPlayer);
                break;
            case 'reset':
                if (!isValidPlayerSymbol(data.starterPlayer)) break;
                resetGame(); currentPlayer = data.starterPlayer;
                updateStatus(getTurnMessage(), currentPlayer);
                setActivePlayerHighlight();
                break;
            case 'reset-scores':
                scores.X = 0; scores.O = 0; scores.draw = 0; updateScoreDisplay();
                break;
        }
    });
    conn.on('close', () => {
        if (multiplayerMode) {
            multiplayerMode = false; myRole = null; conn = null;
            mpBtn.textContent = 'Multiplayer';
            modeBtn.disabled = false;
            updateNameDisplay(); resetGame();
            updateStatus('Opponent disconnected. Playing locally.', null);
        }
    });
    conn.on('error', (err) => {
        setMpStatus(`Connection error: ${err.type}`, 'error');
        document.getElementById('mp-join').disabled = false;
    });
}

mpBtn.addEventListener('click', () => { multiplayerMode ? exitMultiplayerMode() : openMultiplayerLobby(); });
document.getElementById('mp-close').addEventListener('click', closeMultiplayerLobby);
mpOverlay.addEventListener('click', e => { if (e.target === mpOverlay) closeMultiplayerLobby(); });

document.getElementById('mp-create').addEventListener('click', () => {
    destroyPeer();
    mpLobby.classList.add('hidden');
    mpWaiting.classList.remove('hidden');
    mpRoomCode.textContent = '—';
    mpHint.textContent = 'Connecting to server...';
    setMpStatus('');
    document.getElementById('mp-copy').disabled = true;
    const roomCode = generateRoomCode();
    peer = new Peer(roomCode);
    peer.on('open', (id) => { myRole = 'X'; mpRoomCode.textContent = id; mpHint.textContent = 'Waiting for opponent to join...'; document.getElementById('mp-copy').disabled = false; });
    peer.on('connection', (connection) => { if (conn) { connection.close(); return; } mpHint.textContent = 'Opponent connected!'; setupConnHandlers(connection); });
    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') { peer.destroy(); document.getElementById('mp-create').click(); return; }
        setMpStatus(`Error: ${err.type}`, 'error');
        mpLobby.classList.remove('hidden'); mpWaiting.classList.add('hidden');
    });
});

document.getElementById('mp-join').addEventListener('click', () => {
    const code = mpCodeInput.value.trim().toUpperCase();
    if (!code) return;
    const joinBtn = document.getElementById('mp-join');
    joinBtn.disabled = true;
    destroyPeer();
    setMpStatus('Connecting...', '');
    myRole = 'O';
    peer = new Peer();
    peer.on('open', () => { const c = peer.connect(code, { reliable: true }); setupConnHandlers(c); });
    peer.on('error', (err) => { setMpStatus(`Error: ${err.type}`, 'error'); myRole = null; document.getElementById('mp-join').disabled = false; });
});

document.getElementById('mp-copy').addEventListener('click', () => {
    const code = mpRoomCode.textContent;
    if (code && code !== '—') {
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('mp-copy');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
    }
});

// Init TTT
updateNameDisplay();
updateScoreDisplay();
resetGame();

/* ═══════════════════════════════════════════════════════════════
   MUTE TOGGLE
═══════════════════════════════════════════════════════════════ */
let _soundMuted = false;

(function patchSoundEngineForMute() {
    ['playDice','playStep','playAnimal','playLadder','playWin','playTTTMove','playTTTWin'].forEach(fn => {
        const orig = sound[fn].bind(sound);
        sound[fn] = function(...a) { if (!_soundMuted) orig(...a); };
    });
})();

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
    _soundMuted = !_soundMuted;
    muteBtn.textContent = _soundMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', _soundMuted);
    muteBtn.title = _soundMuted ? 'Sounds off — click to turn on' : 'Sounds on — click to mute';
});

/* ═══════════════════════════════════════════════════════════════
   HOW TO PLAY MODALS
═══════════════════════════════════════════════════════════════ */
function openHtp(overlayId) {
    document.getElementById(overlayId).classList.remove('hidden');
}
function closeHtp(overlayId) {
    document.getElementById(overlayId).classList.add('hidden');
}

document.getElementById('snl-how-to-play-btn').addEventListener('click', () => openHtp('snl-htp-overlay'));
document.getElementById('snl-htp-close').addEventListener('click', () => closeHtp('snl-htp-overlay'));
document.getElementById('snl-htp-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeHtp('snl-htp-overlay');
});

document.getElementById('ttt-how-to-play-btn').addEventListener('click', () => openHtp('ttt-htp-overlay'));
document.getElementById('ttt-htp-close').addEventListener('click', () => closeHtp('ttt-htp-overlay'));
document.getElementById('ttt-htp-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeHtp('ttt-htp-overlay');
});

// Close HTP modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeHtp('snl-htp-overlay');
        closeHtp('ttt-htp-overlay');
    }
});

/* ═══════════════════════════════════════════════════════════════
   PRINCESS MAKEOVER GAME
═══════════════════════════════════════════════════════════════ */
class MakeoverGame {
    constructor() {
        // State
        this.selectedColor = '#ff6eb4';
        this.nailColors    = new Array(10).fill(null);
        this.toeColors     = new Array(10).fill(null);
        this.faceColors    = {};
        this.skinTone      = '#fcd9b6';
        this.hairColor     = '#8B4513';
        this.nailArt       = 'plain';
        this.earringStyle  = 'none';
        this.sunglassStyle = 'off';
        this.hatStyle      = 'none';
        this.frecklesStyle = 'off';
        this.necklaceStyle = 'none';

        this._skinTones = ['#fcd9b6','#f4b88a','#c68642','#8d5524','#4a2912'];

        this._initNailClips();
        this._buildPalette();
        this._bindNailArt();
        this._bindNails();
        this._bindToes();
        this._bindFaceParts();
        this._bindSkinTones();
        this._bindAccessories();
        this._bindButtons();
    }

    /* ── Colour palette ──────────────────────────────── */
    get _palette() {
        return [
            '#ff6eb4','#ff9ed2','#c77dff','#a0c4ff',
            '#ffd166','#ff6b6b','#06d6a0','#f4a261',
            '#e63946','#ffffff','#ffb3c6','#b5ead7',
            '#f9c74f','#90e0ef','#a8dadc','#e63b7a',
            '#1e293b','#8B4513','#7c3aed','#10b981'
        ];
    }

    _buildPalette() {
        const container = document.getElementById('mkv-palette');
        container.innerHTML = '';
        this._palette.forEach((color, i) => {
            const btn = document.createElement('button');
            btn.className = 'mkv-swatch';
            btn.style.backgroundColor = color;
            btn.setAttribute('aria-label', `Color ${i + 1}`);
            if (i === 0) btn.classList.add('active');
            btn.addEventListener('click', () => {
                this.selectedColor = color;
                container.querySelectorAll('.mkv-swatch').forEach(s =>
                    s.classList.toggle('active', s === btn));
            });
            container.appendChild(btn);
        });
    }

    /* ── Nail clip paths (for nail art overlays) ─────── */
    _initNailClips() {
        const svgNS = 'http://www.w3.org/2000/svg';
        [['mkv-nails-svg', '.mkv-nail', 'nail', 'data-nail'],
         ['mkv-toes-svg',  '.mkv-toe',  'toe',  'data-toe' ]].forEach(([svgId, sel, prefix, attr]) => {
            const svg = document.getElementById(svgId);
            let defs = svg.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS(svgNS, 'defs');
                svg.insertBefore(defs, svg.firstChild);
            }
            svg.querySelectorAll(sel).forEach(el => {
                const idx = el.getAttribute(attr.replace('data-', ''));
                const cp  = document.createElementNS(svgNS, 'clipPath');
                cp.id     = `mkv-${prefix}-clip-${idx}`;
                const shape = el.cloneNode();
                shape.removeAttribute('class');
                shape.removeAttribute(attr);
                cp.appendChild(shape);
                defs.appendChild(cp);
            });
        });
    }

    /* ── Nail art picker ─────────────────────────────── */
    _bindNailArt() {
        document.querySelectorAll('.mkv-art-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.nailArt = btn.dataset.art;
                document.querySelectorAll('.mkv-art-btn').forEach(b =>
                    b.classList.toggle('active', b === btn));
                // Re-render art on already-painted nails/toes
                const nSvg = document.getElementById('mkv-nails-svg');
                const tSvg = document.getElementById('mkv-toes-svg');
                document.querySelectorAll('.mkv-nail').forEach((nail, i) => {
                    if (this.nailColors[i]) this._renderNailArt(nSvg, nail, i, this.nailColors[i], 'nail');
                    else nSvg.getElementById(`mkv-nail-ov-${i}`)?.remove();
                });
                document.querySelectorAll('.mkv-toe').forEach((toe, i) => {
                    if (this.toeColors[i]) this._renderNailArt(tSvg, toe, i, this.toeColors[i], 'toe');
                    else tSvg.getElementById(`mkv-toe-ov-${i}`)?.remove();
                });
            });
        });
    }

    /* ── Skin tones ──────────────────────────────────── */
    _bindSkinTones() {
        document.querySelectorAll('.mkv-skin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.skin, 10);
                this.skinTone = this._skinTones[idx];
                document.querySelectorAll('.mkv-skin-btn').forEach(b => {
                    b.classList.toggle('active', b === btn);
                    b.setAttribute('aria-pressed', String(b === btn));
                });
                this._applySkinTone();
            });
        });
    }

    _applySkinTone() {
        const t = this.skinTone;
        const el = (id) => document.getElementById(id);
        if (el('mkv-face-base'))  el('mkv-face-base').setAttribute('fill', t);
        if (el('mkv-face-cover')) el('mkv-face-cover').setAttribute('fill', t);
        if (el('mkv-neck'))       el('mkv-neck').setAttribute('fill', t);
        document.querySelectorAll('.mkv-nail').forEach((nail, i) => {
            if (!this.nailColors[i]) nail.setAttribute('fill', '#f3f4f6');
        });
        document.querySelectorAll('.mkv-toe').forEach((toe, i) => {
            if (!this.toeColors[i]) toe.setAttribute('fill', '#f3f4f6');
        });
    }

    /* ── Nails ───────────────────────────────────────── */
    _bindNails() {
        const svg = document.getElementById('mkv-nails-svg');
        document.querySelectorAll('.mkv-nail').forEach(nail => {
            nail.addEventListener('click', () => {
                const idx = parseInt(nail.dataset.nail, 10);
                this.nailColors[idx] = this.selectedColor;
                nail.setAttribute('fill', this.selectedColor);
                nail.setAttribute('stroke', this._darken(this.selectedColor));
                this._renderNailArt(svg, nail, idx, this.selectedColor, 'nail');
                this._sparkle(nail);
                this._playPaint();
            });
        });
    }

    /* ── Toes ────────────────────────────────────────── */
    _bindToes() {
        const svg = document.getElementById('mkv-toes-svg');
        document.querySelectorAll('.mkv-toe').forEach(toe => {
            toe.addEventListener('click', () => {
                const idx = parseInt(toe.dataset.toe, 10);
                this.toeColors[idx] = this.selectedColor;
                toe.setAttribute('fill', this.selectedColor);
                toe.setAttribute('stroke', this._darken(this.selectedColor));
                this._renderNailArt(svg, toe, idx, this.selectedColor, 'toe');
                this._sparkle(toe);
                this._playPaint();
            });
        });
    }

    /* ── Nail art overlay renderer ───────────────────── */
    _renderNailArt(svgEl, el, idx, color, prefix) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const ovId  = `mkv-${prefix}-ov-${idx}`;
        svgEl.getElementById(ovId)?.remove();
        if (this.nailArt === 'plain') return;

        const x = parseFloat(el.getAttribute('x'));
        const y = parseFloat(el.getAttribute('y'));
        const w = parseFloat(el.getAttribute('width'));
        const h = parseFloat(el.getAttribute('height'));

        const g = document.createElementNS(svgNS, 'g');
        g.id = ovId;
        g.setAttribute('clip-path', `url(#mkv-${prefix}-clip-${idx})`);
        g.setAttribute('pointer-events', 'none');

        const mk = (tag, attrs) => {
            const node = document.createElementNS(svgNS, tag);
            Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
            return node;
        };

        if (this.nailArt === 'french') {
            g.appendChild(mk('rect', {x, y, width: w, height: h * 0.28, fill: 'white', opacity: '0.88'}));
        } else if (this.nailArt === 'glitter') {
            for (let i = 0; i < 9; i++) {
                g.appendChild(mk('circle', {
                    cx: x + 2 + Math.random() * (w - 4),
                    cy: y + 2 + Math.random() * (h - 4),
                    r:  1 + Math.random() * 1.5,
                    fill: 'white', opacity: String(0.45 + Math.random() * 0.5)
                }));
            }
        } else if (this.nailArt === 'stripes') {
            for (let i = 0; i < 4; i++) {
                g.appendChild(mk('rect', {x, y: y + i * (h / 4), width: w, height: h / 8, fill: 'white', opacity: '0.38'}));
            }
        } else if (this.nailArt === 'dots') {
            [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]].forEach(([px, py]) => {
                g.appendChild(mk('circle', {cx: x + w * px, cy: y + h * py, r: Math.min(w, h) * 0.09, fill: 'white', opacity: '0.75'}));
            });
        } else if (this.nailArt === 'hearts') {
            const cx = x + w / 2, cy = y + h * 0.48, s = Math.min(w, h) * 0.22;
            g.appendChild(mk('path', {
                d: `M${cx},${cy+s*0.4} C${cx-s*1.1},${cy-s*0.3} ${cx-s*1.9},${cy+s*0.5} ${cx},${cy+s*1.8} C${cx+s*1.9},${cy+s*0.5} ${cx+s*1.1},${cy-s*0.3} ${cx},${cy+s*0.4}Z`,
                fill: 'white', opacity: '0.82'
            }));
        } else if (this.nailArt === 'stars') {
            const cx = x + w / 2, cy = y + h * 0.5, r1 = Math.min(w, h) * 0.26, r2 = r1 * 0.44;
            const pts = Array.from({length: 10}, (_, i) => {
                const r = i % 2 === 0 ? r1 : r2;
                const a = (i * Math.PI / 5) - Math.PI / 2;
                return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
            }).join(' ');
            g.appendChild(mk('polygon', {points: pts, fill: 'white', opacity: '0.84'}));
        }

        svgEl.appendChild(g);
    }

    /* ── Face parts (makeup) ─────────────────────────── */
    _bindFaceParts() {
        document.querySelectorAll('.mkv-face-part').forEach(part => {
            part.addEventListener('click', () => {
                const p = part.dataset.part;
                if (p === 'blush-l' || p === 'blush-r') {
                    this.faceColors[p] = this.selectedColor;
                    part.setAttribute('fill', this.selectedColor);
                    part.setAttribute('opacity', '0.55');
                } else if (p === 'shadow-l' || p === 'shadow-r') {
                    this.faceColors[p] = this.selectedColor;
                    part.setAttribute('fill', this.selectedColor);
                    part.setAttribute('opacity', '0.65');
                } else if (p === 'lips') {
                    this.faceColors[p] = this.selectedColor;
                    part.setAttribute('fill', this.selectedColor);
                } else if (p === 'hair') {
                    this.hairColor = this.selectedColor;
                    part.setAttribute('fill', this.selectedColor);
                } else if (p === 'earring-l' || p === 'earring-r') {
                    if (this.earringStyle !== 'none') {
                        this.faceColors[p] = this.selectedColor;
                        this._renderEarrings();
                    }
                }
                this._sparkle(part);
                this._playPaint();
            });
        });
    }

    /* ── Accessories ─────────────────────────────────── */
    _bindAccessories() {
        document.querySelectorAll('.mkv-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const acc   = btn.dataset.acc;
                const style = btn.dataset.style;
                document.querySelectorAll(`.mkv-acc-btn[data-acc="${acc}"]`).forEach(b =>
                    b.classList.toggle('active', b === btn));

                if (acc === 'earring') {
                    this.earringStyle = style;
                    this._renderEarrings();
                } else if (acc === 'sunglasses') {
                    this.sunglassStyle = style;
                    this._renderSunglasses();
                } else if (acc === 'hat') {
                    this.hatStyle = style;
                    this._renderHat();
                } else if (acc === 'freckles') {
                    this.frecklesStyle = style;
                    this._renderFreckles();
                } else if (acc === 'necklace') {
                    this.necklaceStyle = style;
                    this._renderNecklace();
                }
                this._playPaint();
            });
        });
    }

    _renderEarrings() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg   = document.getElementById('mkv-face-svg');
        const color = this.faceColors['earring-l'] || this.selectedColor;

        // Remove old earring renders
        svg.querySelectorAll('.mkv-earring-render').forEach(el => el.remove());

        if (this.earringStyle === 'none') return;

        const positions = [{x: 18, y: 130}, {x: 182, y: 130}];
        positions.forEach(pos => {
            let el;
            if (this.earringStyle === 'circle') {
                el = document.createElementNS(svgNS, 'circle');
                el.setAttribute('cx', pos.x);
                el.setAttribute('cy', pos.y);
                el.setAttribute('r', '9');
                el.setAttribute('fill', color);
            } else if (this.earringStyle === 'star') {
                el = document.createElementNS(svgNS, 'text');
                el.setAttribute('x', pos.x);
                el.setAttribute('y', pos.y + 5);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('font-size', '14');
                el.textContent = '⭐';
            } else if (this.earringStyle === 'heart') {
                el = document.createElementNS(svgNS, 'text');
                el.setAttribute('x', pos.x);
                el.setAttribute('y', pos.y + 5);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('font-size', '14');
                el.textContent = '❤️';
            } else if (this.earringStyle === 'diamond') {
                // Diamond drop: circle stud + line + diamond
                const g = document.createElementNS(svgNS, 'g');
                g.setAttribute('class', 'mkv-earring-render');
                const stud = document.createElementNS(svgNS, 'circle');
                stud.setAttribute('cx', pos.x); stud.setAttribute('cy', pos.y - 6);
                stud.setAttribute('r', '5'); stud.setAttribute('fill', color);
                const line = document.createElementNS(svgNS, 'line');
                line.setAttribute('x1', pos.x); line.setAttribute('y1', pos.y - 1);
                line.setAttribute('x2', pos.x); line.setAttribute('y2', pos.y + 6);
                line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2');
                const gem = document.createElementNS(svgNS, 'polygon');
                const cx = pos.x, cy = pos.y + 11;
                gem.setAttribute('points', `${cx},${cy-6} ${cx+6},${cy} ${cx},${cy+6} ${cx-6},${cy}`);
                gem.setAttribute('fill', color);
                g.appendChild(stud); g.appendChild(line); g.appendChild(gem);
                svg.appendChild(g);
                return;
            }
            if (el) {
                el.setAttribute('class', 'mkv-earring-render');
                el.setAttribute('pointer-events', 'none');
                svg.appendChild(el);
            }
        });
    }

    _renderSunglasses() {
        const sg = document.getElementById('mkv-sunglasses');
        if (this.sunglassStyle === 'off') {
            sg.setAttribute('display', 'none');
            return;
        }
        sg.setAttribute('display', 'block');
        const lensColor = this.sunglassStyle === 'pink' ? '#f9a8d4'
                        : this.sunglassStyle === 'blue' ? '#93c5fd'
                        : '#1e293b';
        const opacity   = this.sunglassStyle === 'dark' ? '0.85' : '0.7';
        sg.querySelectorAll('rect').forEach(r => {
            r.setAttribute('fill', lensColor);
            r.setAttribute('opacity', opacity);
        });
    }

    _renderHat() {
        const hatG = document.getElementById('mkv-hat');
        if (this.hatStyle === 'none') {
            hatG.setAttribute('display', 'none');
            return;
        }
        hatG.setAttribute('display', 'block');

        // Remove previously injected custom hat elements
        const svg = document.getElementById('mkv-face-svg');
        svg.querySelectorAll('.mkv-hat-custom').forEach(el => el.remove());

        const svgNS = 'http://www.w3.org/2000/svg';

        if (this.hatStyle === 'princess') {
            // Crown / tiara
            hatG.setAttribute('display', 'none');
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('class', 'mkv-hat-custom');
            const crown = document.createElementNS(svgNS, 'text');
            crown.setAttribute('x', '100'); crown.setAttribute('y', '30');
            crown.setAttribute('text-anchor', 'middle'); crown.setAttribute('font-size', '46');
            crown.textContent = '👑';
            g.appendChild(crown);
            svg.insertBefore(g, svg.firstChild);
        } else if (this.hatStyle === 'cap') {
            hatG.setAttribute('display', 'none');
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('class', 'mkv-hat-custom');
            // Cap body
            const body = document.createElementNS(svgNS, 'ellipse');
            body.setAttribute('cx','100'); body.setAttribute('cy','40');
            body.setAttribute('rx','70'); body.setAttribute('ry','38');
            body.setAttribute('fill','#ef4444');
            // Brim
            const brim = document.createElementNS(svgNS, 'ellipse');
            brim.setAttribute('cx','125'); brim.setAttribute('cy','68');
            brim.setAttribute('rx','50'); brim.setAttribute('ry','10');
            brim.setAttribute('fill','#dc2626');
            g.appendChild(body); g.appendChild(brim);
            svg.insertBefore(g, svg.firstChild);
        } else if (this.hatStyle === 'witch') {
            hatG.setAttribute('display', 'none');
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('class', 'mkv-hat-custom');
            // Wide brim
            const brim = document.createElementNS(svgNS, 'ellipse');
            brim.setAttribute('cx','100'); brim.setAttribute('cy','42');
            brim.setAttribute('rx','85'); brim.setAttribute('ry','14');
            brim.setAttribute('fill','#1e1e2e');
            // Cone
            const cone = document.createElementNS(svgNS, 'polygon');
            cone.setAttribute('points','100,-25 60,40 140,40');
            cone.setAttribute('fill','#1e1e2e');
            // Band
            const band = document.createElementNS(svgNS, 'rect');
            band.setAttribute('x','60'); band.setAttribute('y','28');
            band.setAttribute('width','80'); band.setAttribute('height','12');
            band.setAttribute('fill','#7c3aed');
            g.appendChild(cone); g.appendChild(brim); g.appendChild(band);
            svg.insertBefore(g, svg.firstChild);
        } else if (this.hatStyle === 'bow') {
            hatG.setAttribute('display', 'none');
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('class', 'mkv-hat-custom');
            const bow = document.createElementNS(svgNS, 'text');
            bow.setAttribute('x','100'); bow.setAttribute('y','18');
            bow.setAttribute('text-anchor','middle'); bow.setAttribute('font-size','38');
            bow.textContent = '🎀';
            g.appendChild(bow);
            svg.insertBefore(g, svg.firstChild);
        }
    }

    /* ── Freckles ────────────────────────────────────── */
    _renderFreckles() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const g = document.getElementById('mkv-freckles-group');
        g.innerHTML = '';
        if (this.frecklesStyle === 'off') return;

        const allPos = [
            [36,118],[44,113],[40,126],[50,122],[34,131],
            [46,136],[54,116],[37,138],[50,130],[42,142],
            [164,118],[156,113],[160,126],[150,122],[166,131],
            [154,136],[146,116],[163,138],[150,130],[158,142]
        ];
        const count = this.frecklesStyle === 'more' ? 20 : 10;
        allPos.slice(0, count).forEach(([cx, cy]) => {
            const c = document.createElementNS(svgNS, 'circle');
            c.setAttribute('cx', cx); c.setAttribute('cy', cy);
            c.setAttribute('r', '2.2');
            c.setAttribute('fill', '#b97c5d');
            c.setAttribute('opacity', '0.52');
            g.appendChild(c);
        });
    }

    /* ── Necklace ────────────────────────────────────── */
    _renderNecklace() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const g = document.getElementById('mkv-necklace-group');
        g.innerHTML = '';
        if (this.necklaceStyle === 'none') return;

        const color = this.selectedColor;
        const mk = (tag, attrs) => {
            const node = document.createElementNS(svgNS, tag);
            Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
            return node;
        };

        if (this.necklaceStyle === 'simple') {
            g.appendChild(mk('path', {d: 'M62,196 Q100,216 138,196', fill: 'none', stroke: color, 'stroke-width': '3', 'stroke-linecap': 'round'}));
        } else if (this.necklaceStyle === 'pearl') {
            g.appendChild(mk('path', {d: 'M62,196 Q100,216 138,196', fill: 'none', stroke: '#e2e8f0', 'stroke-width': '1'}));
            for (let i = 0; i <= 8; i++) {
                const t = i / 8;
                const px = 62 + 76 * t;
                const py = 196 + 20 * 4 * t * (1 - t);
                g.appendChild(mk('circle', {cx: px, cy: py, r: '4.5', fill: '#f1f5f9', stroke: '#94a3b8', 'stroke-width': '0.8'}));
            }
        } else if (this.necklaceStyle === 'gem') {
            g.appendChild(mk('path', {d: 'M66,195 Q100,212 134,195', fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round'}));
            g.appendChild(mk('polygon', {points: '100,209 108,215 100,221 92,215', fill: color, stroke: 'white', 'stroke-width': '1'}));
            g.appendChild(mk('line', {x1: '97', y1: '213', x2: '100', y2: '210', stroke: 'white', 'stroke-width': '1.2', 'stroke-linecap': 'round'}));
        }
    }

    /* ── Sparkle + sound helpers ─────────────────────── */
    _sparkle(el) {
        el.classList.add('mkv-sparkle-pop');
        setTimeout(() => el.classList.remove('mkv-sparkle-pop'), 450);
    }

    _playPaint() {
        try {
            // Use the existing SoundEngine for a soft chime
            sound._note(880, 'sine', 0.12, 0.18);
        } catch(e) { /* silent fail if audio unavailable */ }
    }

    _darken(hex) {
        // Slightly darken a hex color for stroke
        const n = parseInt(hex.replace('#',''), 16);
        const r = Math.max(0, (n >> 16) - 30);
        const g = Math.max(0, ((n >> 8) & 0xff) - 30);
        const b = Math.max(0, (n & 0xff) - 30);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    /* ── Buttons ─────────────────────────────────────── */
    _bindButtons() {
        document.getElementById('mkv-done-btn').addEventListener('click', () => {
            document.getElementById('mkv-celebration').classList.remove('hidden');
            launchBigConfetti();
            try { sound.playWin(); } catch(e) {}
        });

        document.getElementById('mkv-reset-btn').addEventListener('click', () => {
            this._reset();
        });
    }

    _reset() {
        this.nailColors    = new Array(10).fill(null);
        this.toeColors     = new Array(10).fill(null);
        this.faceColors    = {};
        this.nailArt       = 'plain';
        this.earringStyle  = 'none';
        this.sunglassStyle = 'off';
        this.hatStyle      = 'none';
        this.frecklesStyle = 'off';
        this.necklaceStyle = 'none';
        this.hairColor     = '#8B4513';

        // Reset nail + toe colors and art overlays
        const nSvg = document.getElementById('mkv-nails-svg');
        const tSvg = document.getElementById('mkv-toes-svg');
        document.querySelectorAll('.mkv-nail').forEach((n, i) => {
            n.setAttribute('fill', '#f3f4f6');
            n.setAttribute('stroke', '#d1d5db');
            nSvg.getElementById(`mkv-nail-ov-${i}`)?.remove();
        });
        document.querySelectorAll('.mkv-toe').forEach((t, i) => {
            t.setAttribute('fill', '#f3f4f6');
            t.setAttribute('stroke', '#d1d5db');
            tSvg.getElementById(`mkv-toe-ov-${i}`)?.remove();
        });

        // Reset face parts
        document.getElementById('mkv-hair').setAttribute('fill', '#8B4513');
        document.getElementById('mkv-blush-l').setAttribute('fill', '#ffb3c6');
        document.getElementById('mkv-blush-l').setAttribute('opacity', '0.5');
        document.getElementById('mkv-blush-r').setAttribute('fill', '#ffb3c6');
        document.getElementById('mkv-blush-r').setAttribute('opacity', '0.5');
        document.getElementById('mkv-shadow-l').setAttribute('fill', 'transparent');
        document.getElementById('mkv-shadow-r').setAttribute('fill', 'transparent');
        document.getElementById('mkv-lips').setAttribute('fill', '#e57373');

        // Reset accessories
        document.getElementById('mkv-sunglasses').setAttribute('display', 'none');
        document.getElementById('mkv-hat').setAttribute('display', 'none');
        document.getElementById('mkv-freckles-group').innerHTML = '';
        document.getElementById('mkv-necklace-group').innerHTML = '';
        document.getElementById('mkv-face-svg').querySelectorAll('.mkv-earring-render, .mkv-hat-custom').forEach(el => el.remove());

        // Reset all picker buttons
        document.querySelectorAll('.mkv-acc-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.style === 'none' || btn.dataset.style === 'off'));
        document.querySelectorAll('.mkv-art-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.art === 'plain'));

        // Hide celebration
        document.getElementById('mkv-celebration').classList.add('hidden');
    }
}

// Lazy-init on first tab visit
let makeoverGame = null;
document.getElementById('tab-mkv').addEventListener('click', () => {
    if (!makeoverGame) makeoverGame = new MakeoverGame();
});

/* ═══════════════════════════════════════════════════════════════
   NAIL ART STUDIO
═══════════════════════════════════════════════════════════════ */
class NailArtStudio {
    constructor() {
        this.selectedColor   = '#ff6eb4';
        this.selectedColor2  = '#c77dff';
        this.gradientDir     = 'vertical';
        this.selectedPattern = 'stripes';
        this.selectedSticker = '⭐';
        this.selectedTool    = 'color';
        this.nailStates = Array.from({length: 5}, () => ({fill: '#f3f4f6'}));

        this._labels = ['Thumb','Index','Middle','Ring','Pinky'];
        this._widths = [110, 100, 108, 96, 80]; // CSS px

        this._buildNails();
        this._buildPalettes();
        this._bindTools();
        this._bindPatterns();
        this._bindStickers();
        this._bindGradientDir();
        this._bindButtons();
        this._updateToolUI();
    }

    get _palette() {
        return [
            '#ff6eb4','#ff9ed2','#c77dff','#a0c4ff',
            '#ffd166','#ff6b6b','#06d6a0','#f4a261',
            '#e63946','#ffffff','#ffb3c6','#b5ead7',
            '#f9c74f','#90e0ef','#a8dadc','#e63b7a',
            '#1e293b','#8B4513','#7c3aed','#10b981'
        ];
    }

    /* ── Build five nail SVGs ─────────────────────────── */
    _buildNails() {
        const NS  = 'http://www.w3.org/2000/svg';
        const row = document.getElementById('nas-nails-row');
        row.innerHTML = '';

        // Universal nail shape + sheen in viewBox 0 0 100 160
        const NAIL  = 'M 18,112 Q 18,10 50,10 Q 82,10 82,112 L 77,143 Q 50,152 23,143 Z';
        const SHEEN = 'M 26,18 Q 38,12 50,15 Q 44,52 33,50 Q 22,47 26,18 Z';

        this._labels.forEach((label, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'nas-nail-wrap';
            wrap.dataset.nail = i;
            wrap.style.width = this._widths[i] + 'px';

            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', '0 0 100 160');
            svg.setAttribute('class', 'nas-nail-svg');
            svg.setAttribute('role', 'button');
            svg.setAttribute('tabindex', '0');
            svg.setAttribute('aria-label', label + ' nail');

            // defs: clip + gradient
            const defs = document.createElementNS(NS, 'defs');

            const clip = document.createElementNS(NS, 'clipPath');
            clip.id = `nas-clip-${i}`;
            const cp = document.createElementNS(NS, 'path');
            cp.setAttribute('d', NAIL);
            clip.appendChild(cp);
            defs.appendChild(clip);

            const grad = document.createElementNS(NS, 'linearGradient');
            grad.id = `nas-grad-${i}`;
            grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
            grad.setAttribute('x2','0'); grad.setAttribute('y2','1');
            ['#f3f4f6','#f3f4f6'].forEach((c, si) => {
                const s = document.createElementNS(NS, 'stop');
                s.setAttribute('offset', si === 0 ? '0%' : '100%');
                s.setAttribute('stop-color', c);
                grad.appendChild(s);
            });
            defs.appendChild(grad);
            svg.appendChild(defs);

            // Base shape
            const base = document.createElementNS(NS, 'path');
            base.setAttribute('d', NAIL);
            base.setAttribute('fill', '#f3f4f6');
            base.setAttribute('stroke', '#d1d5db');
            base.setAttribute('stroke-width', '1.5');
            base.setAttribute('class', 'nas-nail-base');
            svg.appendChild(base);

            // Art layer (clipped)
            const layer = document.createElementNS(NS, 'g');
            layer.setAttribute('class', 'nas-art-layer');
            layer.setAttribute('clip-path', `url(#nas-clip-${i})`);
            layer.setAttribute('pointer-events', 'none');
            svg.appendChild(layer);

            // Sheen highlight
            const sheen = document.createElementNS(NS, 'path');
            sheen.setAttribute('d', SHEEN);
            sheen.setAttribute('fill', 'white');
            sheen.setAttribute('opacity', '0.22');
            sheen.setAttribute('pointer-events', 'none');
            svg.appendChild(sheen);

            wrap.appendChild(svg);

            const lbl = document.createElement('span');
            lbl.className = 'nas-nail-label';
            lbl.textContent = label;
            wrap.appendChild(lbl);

            wrap.addEventListener('click', () => this._applyTool(i));
            svg.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._applyTool(i); }
            });

            row.appendChild(wrap);
        });
    }

    /* ── Colour palettes (primary + secondary) ───────── */
    _buildPalettes() {
        ['nas-palette1','nas-palette2'].forEach((cid, palIdx) => {
            const container = document.getElementById(cid);
            container.innerHTML = '';
            this._palette.forEach((color, i) => {
                const btn = document.createElement('button');
                btn.className = 'nas-swatch';
                btn.style.backgroundColor = color;
                btn.setAttribute('aria-label', `Color ${i + 1}`);
                if (palIdx === 0 && i === 0) btn.classList.add('active');
                if (palIdx === 1 && i === 2) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    if (palIdx === 0) this.selectedColor  = color;
                    else              this.selectedColor2 = color;
                    container.querySelectorAll('.nas-swatch').forEach(s =>
                        s.classList.toggle('active', s === btn));
                });
                container.appendChild(btn);
            });
        });
    }

    /* ── Tool picker ──────────────────────────────────── */
    _bindTools() {
        document.querySelectorAll('.nas-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedTool = btn.dataset.tool;
                document.querySelectorAll('.nas-tool-btn').forEach(b =>
                    b.classList.toggle('active', b === btn));
                this._updateToolUI();
            });
        });
    }

    _updateToolUI() {
        const t = this.selectedTool;
        document.getElementById('nas-color2-row').classList.toggle('hidden', t !== 'gradient');
        document.getElementById('nas-pattern-row').classList.toggle('hidden', t !== 'pattern');
        document.getElementById('nas-sticker-row').classList.toggle('hidden', t !== 'sticker');
        document.getElementById('nas-col1-label').textContent =
            t === 'gradient' ? 'Color 1:' : 'Color:';
    }

    /* ── Pattern / sticker / dir pickers ─────────────── */
    _bindPatterns() {
        document.querySelectorAll('.nas-pat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedPattern = btn.dataset.pat;
                document.querySelectorAll('.nas-pat-btn').forEach(b =>
                    b.classList.toggle('active', b === btn));
            });
        });
    }

    _bindStickers() {
        document.querySelectorAll('.nas-stk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedSticker = btn.dataset.stk;
                document.querySelectorAll('.nas-stk-btn').forEach(b =>
                    b.classList.toggle('active', b === btn));
            });
        });
    }

    _bindGradientDir() {
        document.querySelectorAll('.nas-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.gradientDir = btn.dataset.dir;
                document.querySelectorAll('.nas-dir-btn').forEach(b =>
                    b.classList.toggle('active', b === btn));
            });
        });
    }

    /* ── Apply active tool to nail i ─────────────────── */
    _applyTool(i) {
        const NS   = 'http://www.w3.org/2000/svg';
        const wrap = document.querySelector(`.nas-nail-wrap[data-nail="${i}"]`);
        const svg  = wrap.querySelector('.nas-nail-svg');
        const base = svg.querySelector('.nas-nail-base');
        const layer = svg.querySelector('.nas-art-layer');

        const mk = (tag, attrs) => {
            const el = document.createElementNS(NS, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            return el;
        };

        if (this.selectedTool === 'clear') {
            base.setAttribute('fill', '#f3f4f6');
            base.setAttribute('stroke', '#d1d5db');
            layer.innerHTML = '';
            this.nailStates[i] = {fill: '#f3f4f6'};

        } else if (this.selectedTool === 'color') {
            base.setAttribute('fill', this.selectedColor);
            base.setAttribute('stroke', this._darken(this.selectedColor));
            this.nailStates[i].fill = this.selectedColor;

        } else if (this.selectedTool === 'gradient') {
            const grad = svg.querySelector(`#nas-grad-${i}`);
            const stops = grad.querySelectorAll('stop');
            const dirs = {vertical: [0,0,0,1], horizontal: [0,0,1,0], diagonal: [0,0,1,1]};
            const [x1,y1,x2,y2] = dirs[this.gradientDir];
            grad.setAttribute('x1', x1); grad.setAttribute('y1', y1);
            grad.setAttribute('x2', x2); grad.setAttribute('y2', y2);
            stops[0].setAttribute('stop-color', this.selectedColor);
            stops[1].setAttribute('stop-color', this.selectedColor2);
            base.setAttribute('fill', `url(#nas-grad-${i})`);
            base.setAttribute('stroke', this._darken(this.selectedColor));
            this.nailStates[i].fill = 'gradient';

        } else if (this.selectedTool === 'pattern') {
            layer.querySelectorAll('.nas-pat-el').forEach(el => el.remove());
            const c = this.selectedColor;
            const pat = this.selectedPattern;

            if (pat === 'stripes') {
                for (let y = 0; y < 160; y += 14)
                    layer.appendChild(mk('rect', {x:0, y, width:100, height:6, fill:c, opacity:'0.45', class:'nas-pat-el'}));

            } else if (pat === 'dots') {
                for (let row = 0; row <= 8; row++)
                    for (let col = 0; col <= 5; col++)
                        layer.appendChild(mk('circle', {cx: 8+col*16, cy: 12+row*18, r:5, fill:c, opacity:'0.55', class:'nas-pat-el'}));

            } else if (pat === 'checker') {
                for (let row = 0; row < 9; row++)
                    for (let col = 0; col < 7; col++)
                        if ((row+col)%2===0)
                            layer.appendChild(mk('rect', {x:col*16, y:row*18, width:16, height:18, fill:c, opacity:'0.42', class:'nas-pat-el'}));

            } else if (pat === 'waves') {
                for (let y = 14; y <= 160; y += 22) {
                    const path = document.createElementNS(NS, 'path');
                    path.setAttribute('d', `M 0,${y} Q 25,${y-10} 50,${y} Q 75,${y+10} 100,${y}`);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', c);
                    path.setAttribute('stroke-width', '4');
                    path.setAttribute('opacity', '0.55');
                    path.setAttribute('class', 'nas-pat-el');
                    layer.appendChild(path);
                }

            } else if (pat === 'diamonds') {
                for (let row = 0; row <= 6; row++)
                    for (let col = 0; col <= 4; col++) {
                        const cx = 8 + col*20 + (row%2===0?0:10), cy = 15+row*22;
                        layer.appendChild(mk('polygon', {
                            points:`${cx},${cy-9} ${cx+8},${cy} ${cx},${cy+9} ${cx-8},${cy}`,
                            fill:c, opacity:'0.5', class:'nas-pat-el'
                        }));
                    }

            } else if (pat === 'flowers') {
                [[50,30],[25,65],[75,65],[35,105],[65,105],[50,138]].forEach(([cx,cy]) => {
                    for (let p = 0; p < 5; p++) {
                        const a = (p*Math.PI*2/5) - Math.PI/2;
                        layer.appendChild(mk('circle', {cx: cx+10*Math.cos(a), cy: cy+10*Math.sin(a), r:5.5, fill:c, opacity:'0.5', class:'nas-pat-el'}));
                    }
                    layer.appendChild(mk('circle', {cx, cy, r:4, fill:'white', opacity:'0.7', class:'nas-pat-el'}));
                });
            }

        } else if (this.selectedTool === 'sticker') {
            const tx = document.createElementNS(NS, 'text');
            tx.setAttribute('x', 20 + Math.random() * 55);
            tx.setAttribute('y', 28 + Math.random() * 98);
            tx.setAttribute('font-size', '20');
            tx.setAttribute('text-anchor', 'middle');
            tx.setAttribute('dominant-baseline', 'middle');
            layer.appendChild(tx);
            tx.textContent = this.selectedSticker;
        }

        this._sparkle(wrap);
        this._playPop();
    }

    /* ── Helpers ──────────────────────────────────────── */
    _sparkle(el) {
        el.classList.add('mkv-sparkle-pop');
        setTimeout(() => el.classList.remove('mkv-sparkle-pop'), 450);
    }

    _playPop() {
        try { sound._note(880, 'sine', 0.12, 0.18); } catch(e) {}
    }

    _darken(hex) {
        const n = parseInt(hex.replace('#',''), 16);
        const r = Math.max(0, (n>>16)-30);
        const g = Math.max(0, ((n>>8)&0xff)-30);
        const b = Math.max(0, (n&0xff)-30);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    /* ── Action buttons ───────────────────────────────── */
    _bindButtons() {
        document.getElementById('nas-done-btn').addEventListener('click', () => {
            document.getElementById('nas-celebration').classList.remove('hidden');
            launchBigConfetti();
            try { sound.playWin(); } catch(e) {}
        });

        ['nas-clear-all-btn','nas-reset-btn'].forEach(id => {
            document.getElementById(id).addEventListener('click', () => this._reset());
        });
    }

    _reset() {
        this.nailStates = Array.from({length: 5}, () => ({fill: '#f3f4f6'}));
        document.querySelectorAll('.nas-nail-wrap').forEach((wrap, i) => {
            const svg = wrap.querySelector('.nas-nail-svg');
            svg.querySelector('.nas-nail-base').setAttribute('fill', '#f3f4f6');
            svg.querySelector('.nas-nail-base').setAttribute('stroke', '#d1d5db');
            svg.querySelector('.nas-art-layer').innerHTML = '';
            const stops = svg.querySelectorAll(`#nas-grad-${i} stop`);
            stops.forEach(s => s.setAttribute('stop-color', '#f3f4f6'));
        });
        document.getElementById('nas-celebration').classList.add('hidden');
    }
}

let nailArtStudio = null;
document.getElementById('tab-nas').addEventListener('click', () => {
    if (!nailArtStudio) nailArtStudio = new NailArtStudio();
});
