// Flags & Capitals — quiz logic.
// Loads the generated dataset, builds distractor pools (geographic + look-alike
// flag bias), runs four modes (+ mixed), tracks an endless streak, persists best.

// ----------------------------- Mode metadata -----------------------------
const MODES = [
  { key: 'flag2country', title: 'Guess the Country', desc: 'See a flag → name the country', icon: '🏳️' },
  { key: 'country2flag', title: 'Find the Flag', desc: 'See a country → pick its flag', icon: '🔎' },
  { key: 'country2capital', title: 'Name the Capital', desc: 'See a country → pick its capital', icon: '🏛️' },
  { key: 'capital2country', title: 'Whose Capital?', desc: 'See a capital → name the country', icon: '📍' },
  { key: 'mixed', title: 'Mixed', desc: 'A random mix of all four', icon: '🎲' },
];
const PICKABLE = MODES.slice(0, 4).map((m) => m.key); // modes used by "mixed"

// Famously confusable flags — bias distractors toward these (lowercase cc).
const LOOKALIKE_GROUPS = [
  ['no', 'is', 'dk', 'se', 'fi', 'fo'], // Nordic crosses
  ['td', 'ro', 'md', 'ad'], // blue-yellow-red vertical
  ['nl', 'lu', 'py'], // red-white-blue horizontal
  ['ru', 'si', 'sk'], // white-blue-red (+ arms)
  ['id', 'mc', 'pl', 'sg'], // red/white two-band
  ['ie', 'ci'], // green-white-orange
  ['ml', 'gn', 'sn', 'cm'], // pan-African vertical
  ['it', 'mx'], // green-white-red vertical
  ['hu', 'bg'], // horizontal tribands
  ['ve', 'ec', 'co'], // yellow-blue-red
  ['jo', 'ps', 'sd', 'kw', 'ae', 'eg', 'sy', 'iq', 'ye'], // pan-Arab
  ['bh', 'qa'], // white-maroon serrated
  ['au', 'nz'], // blue ensign + Southern Cross
  ['cl', 'cu'], // red-white-blue + star canton
  ['ar', 'uy'], // sun + light blue
  ['cz', 'ph'], // hoist triangle
  ['us', 'lr', 'my'], // stars & stripes
  ['ni', 'sv', 'hn'], // blue-white-blue Central American
  ['in', 'ne'], // saffron-white-green + centre
  ['tr', 'tn', 'dz', 'pk', 'mr', 'mv', 'ly', 'az', 'km'], // crescent/star
  ['vn', 'cn', 'ma'], // red field + symbol
];

// ----------------------------- State -----------------------------
let COUNTRIES = [];
let WITH_CAPITALS = [];
const byCc = new Map();
const bySubregion = new Map();
const byRegion = new Map();
const lookalike = new Map(); // cc -> [cc, ...] present in dataset

let currentMode = null;
let currentStreak = 0;
let current = null; // active question
let answered = false;
let bests = loadBests();

// ----------------------------- DOM -----------------------------
const $ = (id) => document.getElementById(id);
const els = {
  home: $('home'),
  quiz: $('quiz'),
  tagline: $('tagline'),
  modeList: $('mode-list'),
  homeBtn: $('home-btn'),
  curStreak: $('cur-streak'),
  bestStreak: $('best-streak'),
  prompt: $('prompt'),
  options: $('options'),
  feedback: $('feedback'),
  note: $('note'),
  nextBtn: $('next-btn'),
};

// ----------------------------- Utils -----------------------------
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function flagImg(cc, cls, label) {
  const img = document.createElement('img');
  img.className = 'flag' + (cls ? ' ' + cls : '');
  img.src = `./assets/flags/${cc}.svg`;
  img.alt = label || 'flag';
  img.loading = 'eager';
  img.draggable = false;
  return img;
}

// ----------------------------- Data prep -----------------------------
function index(data) {
  COUNTRIES = data;
  WITH_CAPITALS = data.filter((c) => c.capitals.length >= 1);
  for (const c of data) {
    byCc.set(c.cc, c);
    if (!bySubregion.has(c.subregion)) bySubregion.set(c.subregion, []);
    bySubregion.get(c.subregion).push(c);
    if (!byRegion.has(c.region)) byRegion.set(c.region, []);
    byRegion.get(c.region).push(c);
  }
  for (const group of LOOKALIKE_GROUPS) {
    for (const cc of group) {
      if (!byCc.has(cc)) continue;
      const others = group.filter((x) => x !== cc && byCc.has(x));
      const set = lookalike.get(cc) || [];
      lookalike.set(cc, set.concat(others));
    }
  }
}

// Pick `n` distinct distractor countries near `target`, drawing first from
// look-alike flags (optional), then same subregion, then region, then global.
function distractorCountries(target, n, { useLookalike = false, filter = null } = {}) {
  const picked = [];
  const seen = new Set([target.cc]);
  const ok = (c) => c && !seen.has(c.cc) && (!filter || filter(c));
  const drain = (list) => {
    for (const c of shuffle(list)) {
      if (picked.length >= n) break;
      if (ok(c)) {
        seen.add(c.cc);
        picked.push(c);
      }
    }
  };
  if (useLookalike) drain((lookalike.get(target.cc) || []).map((cc) => byCc.get(cc)));
  drain(bySubregion.get(target.subregion) || []);
  drain(byRegion.get(target.region) || []);
  drain(COUNTRIES);
  return picked;
}

// ----------------------------- Question builders -----------------------------
function makeQuestion(mode) {
  if (mode === 'flag2country') {
    const t = pick(COUNTRIES);
    const opts = shuffle([t, ...distractorCountries(t, 3, { useLookalike: true })]).map((c) => ({
      label: c.name,
      correct: c.cc === t.cc,
    }));
    return { mode, prompt: { flag: t.cc }, options: opts, note: t.official };
  }

  if (mode === 'country2flag') {
    const t = pick(COUNTRIES);
    const opts = shuffle([t, ...distractorCountries(t, 3, { useLookalike: true })]).map((c) => ({
      flag: c.cc,
      label: c.name,
      correct: c.cc === t.cc,
    }));
    return { mode, prompt: { text: t.name, sub: 'Pick its flag' }, options: opts, note: '' };
  }

  if (mode === 'country2capital') {
    const t = pick(WITH_CAPITALS);
    const answer = pick(t.capitals);
    const used = new Set(t.capitals);
    const caps = [];
    for (const c of distractorCountries(t, 3, { filter: (x) => x.capitals.length >= 1 })) {
      const cap = c.capitals.find((x) => !used.has(x)) || c.capitals[0];
      if (!used.has(cap)) {
        used.add(cap);
        caps.push(cap);
      }
    }
    // Top up if needed (rare).
    for (const c of shuffle(WITH_CAPITALS)) {
      if (caps.length >= 3) break;
      const cap = c.capitals[0];
      if (!used.has(cap)) {
        used.add(cap);
        caps.push(cap);
      }
    }
    const opts = shuffle([answer, ...caps]).map((s) => ({ label: s, correct: s === answer }));
    const others = t.capitals.filter((c) => c !== answer);
    const note = others.length ? `${t.name} also: ${others.join(', ')}` : '';
    return { mode, prompt: { text: t.name, sub: 'What is the capital?' }, options: opts, note };
  }

  // capital2country
  const t = pick(WITH_CAPITALS);
  const cap = pick(t.capitals);
  const opts = shuffle([t, ...distractorCountries(t, 3)]).map((c) => ({
    label: c.name,
    correct: c.cc === t.cc,
  }));
  return { mode, prompt: { text: cap, sub: "Whose capital is this?" }, options: opts, note: '' };
}

// ----------------------------- Rendering -----------------------------
function renderHome() {
  els.modeList.innerHTML = '';
  for (const m of MODES) {
    const card = document.createElement('button');
    card.className = 'mode-card';
    card.type = 'button';
    card.innerHTML = `
      <span class="mode-icon" aria-hidden="true">${m.icon}</span>
      <span class="mode-text">
        <span class="mode-title">${m.title}</span><br />
        <span class="mode-desc">${m.desc}</span>
      </span>
      <span class="best-badge">Best <b>${bests[m.key] || 0}</b></span>`;
    card.addEventListener('click', () => startMode(m.key));
    els.modeList.appendChild(card);
  }
}

function startMode(key) {
  currentMode = key;
  currentStreak = 0;
  els.home.classList.add('hidden');
  els.quiz.classList.remove('hidden');
  updateStreakBar();
  nextQuestion();
}

function goHome() {
  els.quiz.classList.add('hidden');
  els.home.classList.remove('hidden');
  renderHome();
}

function updateStreakBar() {
  els.curStreak.textContent = currentStreak;
  els.bestStreak.textContent = bests[currentMode] || 0;
}

function nextQuestion() {
  answered = false;
  const mode = currentMode === 'mixed' ? pick(PICKABLE) : currentMode;
  current = makeQuestion(mode);
  renderQuestion(current);
}

function renderQuestion(q) {
  // Prompt
  els.prompt.innerHTML = '';
  if (q.prompt.flag) {
    els.prompt.appendChild(flagImg(q.prompt.flag, 'flag-prompt', 'Flag to identify'));
  } else {
    const text = document.createElement('div');
    text.className = 'prompt-text';
    text.textContent = q.prompt.text;
    const sub = document.createElement('div');
    sub.className = 'prompt-sub';
    sub.textContent = q.prompt.sub || '';
    els.prompt.append(text, sub);
  }

  // Options
  const isFlagGrid = q.options.some((o) => o.flag);
  els.options.className = 'options' + (isFlagGrid ? ' grid' : '');
  els.options.innerHTML = '';
  for (const opt of q.options) {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.type = 'button';
    if (opt.flag) {
      btn.setAttribute('aria-label', opt.label);
      btn.appendChild(flagImg(opt.flag, null, opt.label));
    } else {
      btn.textContent = opt.label;
    }
    btn.addEventListener('click', () => onAnswer(btn, opt));
    els.options.appendChild(btn);
  }

  // Reset feedback
  els.feedback.classList.add('hidden');
  els.note.textContent = '';
}

function onAnswer(btn, opt) {
  if (answered) return;
  answered = true;

  const buttons = [...els.options.children];
  const correctBtn = buttons[current.options.findIndex((o) => o.correct)];

  if (opt.correct) {
    btn.classList.add('correct');
    currentStreak += 1;
    if (currentStreak > (bests[currentMode] || 0)) {
      bests[currentMode] = currentStreak;
      saveBests();
    }
  } else {
    btn.classList.add('wrong');
    correctBtn.classList.add('correct');
    currentStreak = 0;
  }

  els.options.classList.add('locked');
  updateStreakBar();

  if (current.note) els.note.textContent = current.note;
  els.feedback.classList.remove('hidden');
  els.nextBtn.focus();
}

// ----------------------------- Persistence -----------------------------
function loadBests() {
  try {
    return JSON.parse(localStorage.getItem('cq:bests')) || {};
  } catch {
    return {};
  }
}
function saveBests() {
  try {
    localStorage.setItem('cq:bests', JSON.stringify(bests));
  } catch {
    /* ignore */
  }
}

// ----------------------------- Boot -----------------------------
els.homeBtn.addEventListener('click', goHome);
els.nextBtn.addEventListener('click', nextQuestion);

fetch('./data/countries.json')
  .then((r) => r.json())
  .then((data) => {
    index(data);
    els.tagline.textContent = `${COUNTRIES.length} countries · flags & capitals quiz`;
    renderHome();
  })
  .catch((err) => {
    els.modeList.innerHTML = `<p style="color:var(--wrong)">Could not load country data: ${err.message}</p>`;
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
