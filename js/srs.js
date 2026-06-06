// js/srs.js — Leitner spaced repetition.
// Card key = `${cc}:${skill}`, skill ∈ 'flag' | 'capital'.

const DAY = 86400000;
const MIN10 = 600000;
const INTERVAL = { 1: DAY, 2: 3 * DAY, 3: 7 * DAY, 4: 16 * DAY, 5: 45 * DAY };
const MASTER_BOX = 4;

let store = {};
const key = (cc, skill) => `${cc}:${skill}`;

export function loadSrs() {
  try {
    store = JSON.parse(localStorage.getItem('cq:srs')) || {};
  } catch {
    store = {};
  }
}
function save() {
  try {
    localStorage.setItem('cq:srs', JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export const getState = (cc, skill) => store[key(cc, skill)] || null;
export const box = (cc, skill) => (store[key(cc, skill)] ? store[key(cc, skill)].box : 0);

export function grade(cc, skill, correct) {
  const k = key(cc, skill);
  const now = Date.now();
  const s = store[k] || { box: 0, due: 0, reps: 0, lapses: 0, last: 0 };
  s.reps++;
  s.last = now;
  if (correct) {
    s.box = Math.min(5, s.box + 1);
    s.due = now + (INTERVAL[s.box] || DAY);
  } else {
    s.box = Math.max(1, s.box - 1);
    s.due = now + MIN10;
    s.lapses++;
  }
  store[k] = s;
  save();
  return s;
}

export function level(cc, skill) {
  const s = store[key(cc, skill)];
  if (!s || s.box === 0) return 'new';
  return s.box >= MASTER_BOX ? 'mastered' : 'learning';
}

export function isDue(cc, skill, now = Date.now()) {
  const s = store[key(cc, skill)];
  return !!s && s.box > 0 && s.due <= now;
}

// Overall mastery for a country, considering its applicable skills.
export function countryLevel(c) {
  const skills = ['flag', ...(c.capitals.length ? ['capital'] : [])];
  const lv = skills.map((s) => level(c.cc, s));
  if (lv.every((x) => x === 'mastered')) return 'mastered';
  if (lv.some((x) => x !== 'new')) return 'learning';
  return 'new';
}

export function stats(countries, skills) {
  let n = 0;
  let l = 0;
  let m = 0;
  let due = 0;
  const now = Date.now();
  for (const c of countries) {
    for (const sk of skills) {
      if (sk === 'capital' && !c.capitals.length) continue;
      const lvl = level(c.cc, sk);
      if (lvl === 'new') n++;
      else if (lvl === 'mastered') m++;
      else l++;
      if (isDue(c.cc, sk, now)) due++;
    }
  }
  return { new: n, learning: l, mastered: m, due };
}
