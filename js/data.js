// js/data.js — data loading, indexing, scope, fact formatting, shared utilities.

let COUNTRIES = [];
let TIPS = {};
const byCcMap = new Map();
const byCca3Map = new Map();
const bySubregion = new Map();
const byRegion = new Map();
const lookalikeMap = new Map();

// Famously confusable flags — used to bias quiz distractors (lowercase cc).
const LOOKALIKE_GROUPS = [
  ['no', 'is', 'dk', 'se', 'fi', 'fo'],
  ['td', 'ro', 'md', 'ad'],
  ['nl', 'lu', 'py'],
  ['ru', 'si', 'sk'],
  ['id', 'mc', 'pl', 'sg'],
  ['ie', 'ci'],
  ['ml', 'gn', 'sn', 'cm'],
  ['it', 'mx'],
  ['hu', 'bg'],
  ['ve', 'ec', 'co'],
  ['jo', 'ps', 'sd', 'kw', 'ae', 'eg', 'sy', 'iq', 'ye'],
  ['bh', 'qa'],
  ['au', 'nz'],
  ['cl', 'cu'],
  ['ar', 'uy'],
  ['cz', 'ph'],
  ['us', 'lr', 'my'],
  ['ni', 'sv', 'hn'],
  ['in', 'ne'],
  ['tr', 'tn', 'dz', 'pk', 'mr', 'mv', 'ly', 'az', 'km'],
  ['vn', 'cn', 'ma'],
];

const push = (map, k, v) => {
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(v);
};

export async function loadData() {
  const [countries, tips] = await Promise.all([
    fetch('./data/countries.json').then((r) => r.json()),
    fetch('./data/flag-tips.json').then((r) => r.json()).catch(() => ({})),
  ]);
  COUNTRIES = countries;
  TIPS = tips || {};
  for (const c of COUNTRIES) {
    byCcMap.set(c.cc, c);
    if (c.cca3) byCca3Map.set(c.cca3, c);
    push(bySubregion, c.subregion, c);
    push(byRegion, c.region, c);
  }
  for (const group of LOOKALIKE_GROUPS) {
    for (const cc of group) {
      if (!byCcMap.has(cc)) continue;
      const others = group.filter((x) => x !== cc && byCcMap.has(x));
      lookalikeMap.set(cc, (lookalikeMap.get(cc) || []).concat(others));
    }
  }
  loadScope();
}

export const getAll = () => COUNTRIES;
export const getByCc = (cc) => byCcMap.get(cc);
export const getByCca3 = (c3) => byCca3Map.get(c3);
export const withCapitals = () => COUNTRIES.filter((c) => c.capitals.length >= 1);
export const lookalikeOf = (cc) => lookalikeMap.get(cc) || [];
export const regionList = (r) => byRegion.get(r) || [];
export const subregionList = (s) => bySubregion.get(s) || [];
export const flagPath = (cc) => `./assets/flags/${cc}.svg`;
export const tipFor = (cc) => TIPS[cc] || null;

// ---- Scope (shared by quiz + study) ----
let scope = { type: 'all', value: null };
function loadScope() {
  try {
    const s = JSON.parse(localStorage.getItem('cq:scope'));
    if (s && s.type) scope = s;
  } catch {
    /* default */
  }
  if (scope.type === 'region' && !byRegion.has(scope.value)) scope = { type: 'all', value: null };
  if (scope.type === 'subregion' && !bySubregion.has(scope.value)) scope = { type: 'all', value: null };
}
export const getScope = () => scope;
export function setScope(s) {
  scope = s;
  try {
    localStorage.setItem('cq:scope', JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function scopeLabel(s = scope) {
  return s.type === 'all' ? 'All countries' : s.value;
}
export function scopedCountries(s = scope) {
  if (s.type === 'region') return byRegion.get(s.value) || [];
  if (s.type === 'subregion') return bySubregion.get(s.value) || [];
  return COUNTRIES;
}
// [{region, count, subs:[{value,count}]}] for the picker.
export function scopeGroups() {
  return [...byRegion.keys()]
    .filter(Boolean)
    .sort()
    .map((r) => ({
      region: r,
      count: byRegion.get(r).length,
      subs: [...new Set((byRegion.get(r) || []).map((c) => c.subregion))]
        .filter(Boolean)
        .sort()
        .map((sv) => ({ value: sv, count: bySubregion.get(sv).length })),
    }));
}

// ---- Facts (all derived from the dataset — accurate + offline) ----
export function factsFor(c) {
  const neighbors = (c.borders || []).map((c3) => byCca3Map.get(c3)).filter(Boolean).map((n) => n.name);
  return {
    regionPath: c.subregion && c.subregion !== c.region ? `${c.region} › ${c.subregion}` : c.region,
    neighbors,
    neighborsText: neighbors.length
      ? neighbors.join(', ')
      : c.landlocked
      ? 'Landlocked'
      : 'Island / no land borders',
    area: c.area != null ? c.area.toLocaleString('en-US') + ' km²' : null,
    languages: (c.languages || []).join(', ') || null,
    currency: (c.currencies || []).map((x) => (x.symbol ? `${x.name} (${x.symbol})` : x.name)).join(', ') || null,
  };
}

// ---- Utilities ----
export const rnd = (n) => Math.floor(Math.random() * n);
export const pick = (a) => a[rnd(a.length)];
export function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
export function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}
