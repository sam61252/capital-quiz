// js/map.js — equirectangular world map: locator pin + mastery dots.
// The base SVG is exact plate-carrée, so percentage positioning aligns precisely.

let svgText = null;
async function base() {
  if (svgText == null) {
    svgText = await fetch('./assets/world-equirect.svg').then((r) => r.text()).catch(() => '');
  }
  return svgText;
}

// latlng is [lat, lng]
function pos(c) {
  const ll = c.latlng;
  if (!ll) return null;
  const lat = ll[0];
  const lng = ll[1];
  return { left: ((lng + 180) / 360) * 100, top: ((90 - lat) / 180) * 100 };
}

function scaffold(container, svg) {
  container.innerHTML = `<div class="map-wrap"><div class="map-base">${svg}</div><div class="map-pins"></div></div>`;
  return container.querySelector('.map-pins');
}

export async function renderLocator(container, country) {
  const pins = scaffold(container, await base());
  const p = pos(country);
  if (p) {
    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.style.left = p.left + '%';
    pin.style.top = p.top + '%';
    pins.appendChild(pin);
  }
}

export async function renderMastery(container, countries, levelFn) {
  const pins = scaffold(container, await base());
  for (const c of countries) {
    const p = pos(c);
    if (!p) continue;
    const d = document.createElement('div');
    d.className = 'dot ' + levelFn(c);
    d.style.left = p.left + '%';
    d.style.top = p.top + '%';
    pins.appendChild(d);
  }
}
