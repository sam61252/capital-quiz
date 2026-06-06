// js/quiz.js — question generation (MCQ + typing) and answer checking. No DOM.
import * as data from './data.js';

// Pick `n` distinct distractor countries near `target`. Tiers: look-alike flags →
// same subregion → same region → whole pool → global fallback (guarantees `n`).
export function distractorCountries(target, n, { useLookalike = false, filter = null, pool = null } = {}) {
  pool = pool || data.getAll();
  const inPool = new Set(pool.map((c) => c.cc));
  const picked = [];
  const seen = new Set([target.cc]);
  const ok = (c) => c && !seen.has(c.cc) && (!filter || filter(c));
  const drain = (list) => {
    for (const c of data.shuffle(list)) {
      if (picked.length >= n) break;
      if (ok(c)) {
        seen.add(c.cc);
        picked.push(c);
      }
    }
  };
  if (useLookalike) {
    drain(data.lookalikeOf(target.cc).map((cc) => data.getByCc(cc)).filter((c) => c && inPool.has(c.cc)));
  }
  drain(pool.filter((c) => c.subregion === target.subregion));
  drain(pool.filter((c) => c.region === target.region));
  drain(pool);
  if (picked.length < n) drain(data.getAll());
  return picked.slice(0, n);
}

const acc = (arr) => arr.filter(Boolean).map(data.normalize);

// mode: flag2country | country2flag | country2capital | capital2country
// opts: { target?, pool?, typing? }
export function makeQuestion(mode, opts = {}) {
  const pool = opts.pool || data.getAll();
  const typing = !!opts.typing;
  const needCap = mode === 'country2capital' || mode === 'capital2country';
  let t = opts.target;
  if (!t) {
    const src = needCap ? pool.filter((c) => c.capitals.length >= 1) : pool;
    t = data.pick(src.length ? src : needCap ? data.withCapitals() : data.getAll());
  }

  if (mode === 'flag2country') {
    if (typing) {
      return { mode, typing: true, prompt: { flag: t.cc, sub: 'Type the country' }, answer: t.name, accept: acc([t.name, t.official]), target: t };
    }
    const options = data.shuffle([t, ...distractorCountries(t, 3, { useLookalike: true, pool })]).map((c) => ({ label: c.name, correct: c.cc === t.cc }));
    return { mode, prompt: { flag: t.cc, sub: 'Which country?' }, options, note: t.official, target: t };
  }

  if (mode === 'country2flag') {
    const options = data.shuffle([t, ...distractorCountries(t, 3, { useLookalike: true, pool })]).map((c) => ({ flag: c.cc, label: c.name, correct: c.cc === t.cc }));
    return { mode, prompt: { text: t.name, sub: 'Pick its flag' }, options, note: '', target: t };
  }

  if (mode === 'country2capital') {
    const answer = data.pick(t.capitals);
    if (typing) {
      return { mode, typing: true, prompt: { text: t.name, sub: 'Type the capital' }, answer: t.capitals.join(' / '), accept: acc(t.capitals), target: t };
    }
    const used = new Set(t.capitals);
    const caps = [];
    for (const c of distractorCountries(t, 3, { filter: (x) => x.capitals.length >= 1, pool })) {
      const cap = c.capitals.find((x) => !used.has(x)) || c.capitals[0];
      if (!used.has(cap)) {
        used.add(cap);
        caps.push(cap);
      }
    }
    for (const c of data.shuffle(data.withCapitals())) {
      if (caps.length >= 3) break;
      const cap = c.capitals[0];
      if (!used.has(cap)) {
        used.add(cap);
        caps.push(cap);
      }
    }
    const options = data.shuffle([answer, ...caps]).map((s) => ({ label: s, correct: s === answer }));
    const others = t.capitals.filter((c) => c !== answer);
    return { mode, prompt: { text: t.name, sub: 'What is the capital?' }, options, note: others.length ? `${t.name} also: ${others.join(', ')}` : '', target: t };
  }

  // capital2country
  const cap = data.pick(t.capitals);
  if (typing) {
    return { mode, typing: true, prompt: { text: cap, sub: 'Type the country' }, answer: t.name, accept: acc([t.name, t.official]), target: t };
  }
  const options = data.shuffle([t, ...distractorCountries(t, 3, { pool })]).map((c) => ({ label: c.name, correct: c.cc === t.cc }));
  return { mode, prompt: { text: cap, sub: 'Whose capital is this?' }, options, note: '', target: t };
}

export function checkTyped(input, accept) {
  const x = data.normalize(input);
  if (!x) return false;
  for (const a of accept) {
    if (x === a) return true;
    if (a.length > 4 && data.levenshtein(x, a) <= 1) return true; // tolerate 1 typo
  }
  return false;
}
