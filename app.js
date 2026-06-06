// Flags & Capitals — app shell: routing, home, scope picker, quiz play, and the
// spaced-repetition Study course (learn cards, practice, progress).
import * as data from './js/data.js';
import * as srs from './js/srs.js';
import * as quiz from './js/quiz.js';
import * as map from './js/map.js';

// ----------------------------- DOM helpers -----------------------------
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function flagImg(cc, cls, alt) {
  const i = document.createElement('img');
  i.className = 'flag' + (cls ? ' ' + cls : '');
  i.src = data.flagPath(cc);
  i.alt = alt || 'flag';
  i.loading = 'eager';
  i.draggable = false;
  return i;
}
function show(view) {
  for (const v of ['home', 'quiz', 'study']) $(v).classList.toggle('hidden', v !== view);
  window.scrollTo(0, 0);
}
function load(k, d) {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch {
    return d;
  }
}
function save(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

// ----------------------------- Quiz modes -----------------------------
const MODES = [
  { key: 'flag2country', title: 'Guess the Country', desc: 'See a flag → name it', icon: '🏳️' },
  { key: 'country2flag', title: 'Find the Flag', desc: 'See a country → pick its flag', icon: '🔎' },
  { key: 'country2capital', title: 'Name the Capital', desc: 'See a country → pick its capital', icon: '🏛️' },
  { key: 'capital2country', title: 'Whose Capital?', desc: 'See a capital → name the country', icon: '📍' },
  { key: 'mixed', title: 'Mixed', desc: 'A random mix of all four', icon: '🎲' },
];
const PICKABLE = MODES.slice(0, 4).map((m) => m.key);

let bests = load('cq:bests', {});
let focus = load('cq:focus', 'both'); // 'both' | 'flag' | 'capital'

// ----------------------------- Shared question card -----------------------------
function renderPrompt(node, q) {
  node.innerHTML = '';
  if (q.prompt.flag) {
    node.appendChild(flagImg(q.prompt.flag, 'flag-prompt', 'Flag to identify'));
    if (q.prompt.sub) node.appendChild(el('div', 'prompt-sub', q.prompt.sub));
  } else {
    node.appendChild(el('div', 'prompt-text', q.prompt.text));
    if (q.prompt.sub) node.appendChild(el('div', 'prompt-sub', q.prompt.sub));
  }
}

// Builds a full question card (prompt + options/typing + feedback). Calls
// onAnswer(correct) right after the user answers, and onNext() when Next is tapped.
function buildQuestionCard(q, { onAnswer, onNext, nextLabel = 'Next →' }) {
  const card = el('div', 'qcard');
  const prompt = el('div', 'prompt');
  renderPrompt(prompt, q);
  card.appendChild(prompt);

  const fb = el('div', 'feedback hidden');
  const note = el('p', 'note');
  const nextBtn = el('button', 'next-btn', nextLabel);
  nextBtn.type = 'button';
  fb.append(note, nextBtn);

  let done = false;
  const finish = (correct) => {
    if (done) return;
    done = true;
    if (onAnswer) onAnswer(correct);
    if (!note.textContent && q.note) note.textContent = q.note;
    fb.classList.remove('hidden');
    nextBtn.focus();
  };

  if (q.typing) {
    const form = el('form', 'type-form');
    const input = el('input', 'type-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.placeholder = 'Type your answer…';
    const check = el('button', 'next-btn', 'Check');
    check.type = 'submit';
    form.append(input, check);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (done) return;
      const correct = quiz.checkTyped(input.value, q.accept);
      input.classList.add(correct ? 'correct' : 'wrong');
      input.readOnly = true;
      check.classList.add('hidden');
      note.textContent = (correct ? '✓ ' : '✗ ') + q.answer;
      finish(correct);
    });
    card.appendChild(form);
    setTimeout(() => input.focus(), 30);
  } else {
    const opts = el('div', 'options' + (q.options.some((o) => o.flag) ? ' grid' : ''));
    q.options.forEach((o) => {
      const b = el('button', 'option');
      b.type = 'button';
      if (o.flag) {
        b.setAttribute('aria-label', o.label);
        b.appendChild(flagImg(o.flag, null, o.label));
      } else {
        b.textContent = o.label;
      }
      b.addEventListener('click', () => {
        if (done) return;
        const correctBtn = [...opts.children][q.options.findIndex((x) => x.correct)];
        if (o.correct) b.classList.add('correct');
        else {
          b.classList.add('wrong');
          correctBtn.classList.add('correct');
        }
        opts.classList.add('locked');
        finish(o.correct);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
  }

  nextBtn.addEventListener('click', () => onNext && onNext());
  card.appendChild(fb);
  return card;
}

// ----------------------------- Home -----------------------------
function renderHome() {
  updateScopeButton();
  const wrap = $('home-cards');
  wrap.innerHTML = '';

  const study = el('button', 'mode-card primary');
  study.type = 'button';
  study.innerHTML =
    `<span class="mode-icon">🎓</span><span class="mode-text">` +
    `<span class="mode-title">Study the course</span>` +
    `<span class="mode-desc">Flashcards + spaced repetition</span></span><span class="best-badge">›</span>`;
  study.onclick = startStudy;
  wrap.appendChild(study);

  const prog = el('button', 'mode-card');
  prog.type = 'button';
  prog.innerHTML =
    `<span class="mode-icon">📊</span><span class="mode-text">` +
    `<span class="mode-title">Progress</span><span class="mode-desc">Your mastery map & stats</span></span>` +
    `<span class="best-badge">›</span>`;
  prog.onclick = showProgress;
  wrap.appendChild(prog);

  wrap.appendChild(el('div', 'section-label', 'Quick quiz · endless streak'));
  for (const m of MODES) {
    const card = el('button', 'mode-card');
    card.type = 'button';
    card.innerHTML =
      `<span class="mode-icon">${m.icon}</span><span class="mode-text">` +
      `<span class="mode-title">${m.title}</span><span class="mode-desc">${m.desc}</span></span>` +
      `<span class="best-badge">Best <b>${bests[m.key] || 0}</b></span>`;
    card.onclick = () => startMode(m.key);
    wrap.appendChild(card);
  }
}

// ----------------------------- Scope picker -----------------------------
function updateScopeButton() {
  $('scope-btn').textContent = `🌐 ${data.scopeLabel()} · ${data.scopedCountries().length}`;
}
function openScope() {
  buildScopeList();
  $('scope-modal').classList.remove('hidden');
}
function closeScope() {
  $('scope-modal').classList.add('hidden');
}
function buildScopeList() {
  const list = $('scope-list');
  list.innerHTML = '';
  const cur = JSON.stringify(data.getScope());
  const item = (label, count, scopeObj, cls) => {
    const b = el('button', 'scope-item' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.innerHTML = `<span>${label}</span><span class="scope-count">${count}</span>`;
    if (JSON.stringify(scopeObj) === cur) b.classList.add('on');
    b.onclick = () => {
      data.setScope(scopeObj);
      closeScope();
      afterScopeChange();
    };
    list.appendChild(b);
  };
  item('All countries', data.getAll().length, { type: 'all', value: null }, 'all');
  for (const g of data.scopeGroups()) {
    item(g.region, g.count, { type: 'region', value: g.region }, 'region');
    for (const s of g.subs) item('· ' + s.value, s.count, { type: 'subregion', value: s.value }, 'sub');
  }
}
function afterScopeChange() {
  updateScopeButton();
  if (!$('home').classList.contains('hidden')) renderHome();
  else if (!$('study').classList.contains('hidden')) renderStudySetup();
  else if (!$('quiz').classList.contains('hidden')) $('quiz-scope').textContent = data.scopeLabel();
}

// ----------------------------- Quiz play (endless streak) -----------------------------
let currentMode = null;
let currentStreak = 0;

function startMode(key) {
  currentMode = key;
  currentStreak = 0;
  show('quiz');
  $('quiz-scope').textContent = data.scopeLabel();
  updateStreakBar();
  nextQuestion();
}
function nextQuestion() {
  const mode = currentMode === 'mixed' ? data.pick(PICKABLE) : currentMode;
  const q = quiz.makeQuestion(mode, { pool: data.scopedCountries() });
  const body = $('quiz-body');
  body.innerHTML = '';
  body.appendChild(
    buildQuestionCard(q, {
      onAnswer: (correct) => {
        if (correct) {
          currentStreak++;
          if (currentStreak > (bests[currentMode] || 0)) {
            bests[currentMode] = currentStreak;
            save('cq:bests', bests);
          }
        } else currentStreak = 0;
        updateStreakBar();
      },
      onNext: nextQuestion,
    })
  );
}
function updateStreakBar() {
  $('cur-streak').textContent = currentStreak;
  $('best-streak').textContent = bests[currentMode] || 0;
}

// ----------------------------- Study course (SRS) -----------------------------
const focusSkills = () => (focus === 'both' ? ['flag', 'capital'] : [focus]);
const applicableSkills = (c) => focusSkills().filter((s) => s === 'flag' || (s === 'capital' && c.capitals.length >= 1));
let pending = []; // queued practice items {country, skill}

function startStudy() {
  show('study');
  renderStudySetup();
}
function updateStudyStatus() {
  const st = srs.stats(data.scopedCountries(), focusSkills());
  $('study-status').innerHTML = `<span class="best">${st.mastered} mastered · ${st.due} due</span>`;
}
function renderStudySetup() {
  updateStudyStatus();
  const body = $('study-body');
  body.innerHTML = '';
  const scoped = data.scopedCountries();
  const st = srs.stats(scoped, focusSkills());

  const card = el('div', 'study-setup');
  card.appendChild(el('h2', 'study-h', 'Study the course'));
  card.appendChild(el('p', 'muted', `${data.scopeLabel()} · ${scoped.length} countries`));

  card.appendChild(el('div', 'seg-label', 'Focus'));
  const seg = el('div', 'seg');
  for (const [k, lab] of [['both', 'Both'], ['flag', 'Flags'], ['capital', 'Capitals']]) {
    const b = el('button', 'seg-btn' + (focus === k ? ' on' : ''), lab);
    b.type = 'button';
    b.onclick = () => {
      focus = k;
      save('cq:focus', focus);
      renderStudySetup();
    };
    seg.appendChild(b);
  }
  card.appendChild(seg);

  const row = el('div', 'stat-row');
  row.innerHTML =
    `<span class="pill new">${st.new} new</span>` +
    `<span class="pill learning">${st.learning} learning</span>` +
    `<span class="pill mastered">${st.mastered} mastered</span>`;
  card.appendChild(row);
  card.appendChild(el('p', 'muted', st.due ? `${st.due} due for review` : 'Nothing due right now'));

  const start = el('button', 'next-btn', st.due ? 'Review & learn →' : 'Start learning →');
  start.onclick = beginSession;
  card.appendChild(start);

  const change = el('button', 'ghost-btn', 'Change area');
  change.onclick = openScope;
  card.appendChild(change);
  const pr = el('button', 'ghost-btn', 'View progress');
  pr.onclick = showProgress;
  card.appendChild(pr);

  body.appendChild(card);
}
function beginSession() {
  pending = [];
  nextStudyItem();
}
function pickDue() {
  const now = Date.now();
  let best = null;
  for (const c of data.scopedCountries()) {
    for (const s of applicableSkills(c)) {
      if (srs.isDue(c.cc, s, now)) {
        const st = srs.getState(c.cc, s);
        if (!best || st.due < best.due) best = { country: c, skill: s, due: st.due };
      }
    }
  }
  return best;
}
function pickNewCountry() {
  const news = data
    .scopedCountries()
    .filter((c) => {
      const ap = applicableSkills(c);
      return ap.length && ap.every((s) => srs.box(c.cc, s) === 0);
    })
    .sort((a, b) => (b.area || 0) - (a.area || 0)); // famous/large first
  return news[0] || null;
}
function nextStudyItem() {
  updateStudyStatus();
  if (pending.length) return renderPractice(pending.shift());
  const due = pickDue();
  if (due) return renderPractice({ country: due.country, skill: due.skill, review: true });
  const nc = pickNewCountry();
  if (nc) return renderLearn(nc);
  return renderCaughtUp();
}
function renderLearn(c) {
  const body = $('study-body');
  body.innerHTML = '';
  const card = el('div', 'learn-card');
  card.appendChild(el('div', 'learn-badge', 'New'));
  card.appendChild(flagImg(c.cc, 'flag-prompt', 'Flag of ' + c.name));
  card.appendChild(el('div', 'learn-name', c.name));
  if (c.official && c.official !== c.name) card.appendChild(el('div', 'learn-official', c.official));

  const f = data.factsFor(c);
  const facts = el('div', 'facts');
  const fact = (k, v) => {
    if (!v) return;
    const r = el('div', 'fact');
    r.appendChild(el('span', 'fact-k', k));
    r.appendChild(el('span', 'fact-v', v));
    facts.appendChild(r);
  };
  fact('Capital', c.capitals.join(', ') || '—');
  fact('Region', f.regionPath);
  fact('Borders', f.neighborsText);
  fact('Area', f.area);
  fact('Language', f.languages);
  fact('Currency', f.currency);
  card.appendChild(facts);

  const tip = data.tipFor(c.cc);
  if (tip) {
    const t = el('div', 'tip');
    t.appendChild(el('span', 'tip-icon', '🚩'));
    t.appendChild(el('span', 'tip-text', tip));
    card.appendChild(t);
  }

  const mapBox = el('div', 'map-box');
  card.appendChild(mapBox);
  map.renderLocator(mapBox, c);

  const go = el('button', 'next-btn', 'Practice →');
  go.onclick = () => {
    for (const s of applicableSkills(c)) pending.push({ country: c, skill: s });
    nextStudyItem();
  };
  card.appendChild(go);
  body.appendChild(card);
}
function renderPractice(item, onNext = nextStudyItem) {
  const { country, skill, review } = item;
  const body = $('study-body');
  body.innerHTML = '';
  const useTyping = srs.box(country.cc, skill) >= 2;
  let mode;
  let typing = false;
  if (skill === 'flag') {
    if (useTyping) {
      mode = 'flag2country';
      typing = true;
    } else mode = data.pick(['flag2country', 'country2flag']);
  } else {
    mode = data.pick(['country2capital', 'capital2country']);
    typing = useTyping;
  }
  const q = quiz.makeQuestion(mode, { target: country, pool: data.scopedCountries(), typing });

  body.appendChild(el('div', 'practice-head ' + (review ? 'review' : 'newq'), review ? '↻ Review' : '✦ New'));
  body.appendChild(
    buildQuestionCard(q, {
      onAnswer: (correct) => {
        srs.grade(country.cc, skill, correct);
        updateStudyStatus();
      },
      onNext,
    })
  );
}
function renderCaughtUp() {
  const body = $('study-body');
  body.innerHTML = '';
  const c = el('div', 'study-setup');
  c.appendChild(el('div', 'big-emoji', '🎉'));
  c.appendChild(el('h2', 'study-h', 'All caught up!'));
  c.appendChild(el('p', 'muted', 'No new cards or reviews due in this area right now.'));
  const fp = el('button', 'next-btn', 'Free practice');
  fp.onclick = freePractice;
  c.appendChild(fp);
  const pr = el('button', 'ghost-btn', 'View progress');
  pr.onclick = showProgress;
  c.appendChild(pr);
  const back = el('button', 'ghost-btn', 'Study menu');
  back.onclick = renderStudySetup;
  c.appendChild(back);
  body.appendChild(c);
}
function freePractice() {
  const scoped = data.scopedCountries();
  let c;
  let s = null;
  let tries = 0;
  do {
    c = data.pick(scoped);
    const ap = applicableSkills(c);
    s = ap.length ? data.pick(ap) : null;
    tries++;
  } while (!s && tries < 50);
  if (!s) return renderStudySetup();
  renderPractice({ country: c, skill: s, review: false }, freePractice);
}
function showProgress() {
  show('study');
  $('study-status').textContent = '';
  const body = $('study-body');
  body.innerHTML = '';
  const all = data.getAll();

  body.appendChild(el('h2', 'study-h', 'Progress'));
  const stAll = srs.stats(all, ['flag', 'capital']);
  const total = stAll.new + stAll.learning + stAll.mastered;
  body.appendChild(el('p', 'muted', `${stAll.mastered} of ${total} skills mastered · ${stAll.due} due for review`));

  const mapBox = el('div', 'map-box');
  body.appendChild(mapBox);
  map.renderMastery(mapBox, all.filter((c) => c.latlng), (c) => srs.countryLevel(c));

  const legend = el('div', 'legend');
  legend.innerHTML =
    `<span class="dot new"></span>new <span class="dot learning"></span>learning <span class="dot mastered"></span>mastered`;
  body.appendChild(legend);

  for (const g of data.scopeGroups()) {
    const inR = data.regionList(g.region);
    const m = inR.filter((c) => srs.countryLevel(c) === 'mastered').length;
    const l = inR.filter((c) => srs.countryLevel(c) === 'learning').length;
    const row = el('button', 'prog-region');
    row.type = 'button';
    row.appendChild(el('div', 'prog-name', `${g.region} — ${m}/${inR.length}`));
    const track = el('div', 'bar');
    const fm = el('div', 'bar-fill mastered');
    fm.style.width = (m / inR.length) * 100 + '%';
    const fl = el('div', 'bar-fill learning');
    fl.style.left = (m / inR.length) * 100 + '%';
    fl.style.width = (l / inR.length) * 100 + '%';
    track.append(fm, fl);
    row.appendChild(track);
    row.onclick = () => {
      data.setScope({ type: 'region', value: g.region });
      updateScopeButton();
      renderStudySetup();
    };
    body.appendChild(row);
  }
  const back = el('button', 'ghost-btn', 'Back to study');
  back.onclick = renderStudySetup;
  body.appendChild(back);
}

// ----------------------------- Boot -----------------------------
$('quiz-home-btn').onclick = () => {
  show('home');
  renderHome();
};
$('study-home-btn').onclick = () => {
  show('home');
  renderHome();
};
$('scope-btn').onclick = openScope;
$('scope-close').onclick = closeScope;
$('scope-modal').addEventListener('click', (e) => {
  if (e.target.id === 'scope-modal') closeScope();
});

data
  .loadData()
  .then(() => {
    srs.loadSrs();
    $('tagline').textContent = `${data.getAll().length} countries · learn & quiz`;
    renderHome();
    show('home');
  })
  .catch((err) => {
    $('home-cards').innerHTML = `<p style="color:var(--wrong)">Could not load data: ${err.message}</p>`;
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
