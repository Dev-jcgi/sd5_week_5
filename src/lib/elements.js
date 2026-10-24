// Web Components que reproducen los elementos especiales del formato de diapositivas:
// <x-icon>, <x-shape>, <x-connector> y <x-embed>.

const ICONS = {
  Globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z"/>',
  Key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  Lightning: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  Star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  Users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  Cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/>',
  Database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  Link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  Warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  CheckCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  Code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  Lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Lightbulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
};

class XIcon extends HTMLElement {
  connectedCallback() {
    const body = ICONS[this.getAttribute('name')] || ICONS.Star;
    this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
}

const SHAPES = {
  'arrow-right': 'polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)',
  'arrow-left': 'polygon(100% 30%,40% 30%,40% 0,0 50%,40% 100%,40% 70%,100% 70%)',
  'arrow-up': 'polygon(30% 100%,30% 40%,0 40%,50% 0,100% 40%,70% 40%,70% 100%)',
  'arrow-down': 'polygon(30% 0,30% 60%,0 60%,50% 100%,100% 60%,70% 60%,70% 0)',
  diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
};
class XShape extends HTMLElement {
  connectedCallback() {
    const k = this.getAttribute('kind');
    if (k === 'ellipse') this.style.borderRadius = '50%';
    if (SHAPES[k]) this.style.clipPath = SHAPES[k];
  }
}

class XConnector extends HTMLElement {
  connectedCallback() {
    const n = (a) => parseFloat(this.getAttribute(a));
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(n);
    if ([x1, y1, x2, y2].some(Number.isNaN)) return;
    const cs = this.getAttribute('style') || '';
    const color = (cs.match(/(?:^|;)\s*color:\s*([^;]+)/) || [, '#888'])[1].trim();
    const w = parseFloat((cs.match(/border-width:\s*([\d.]+)/) || [, 2])[1]);
    const dash = /border-style:\s*dashed/.test(cs) ? `${w * 3} ${w * 2}` : /dotted/.test(cs) ? `${w} ${w * 1.5}` : '';
    const route = this.getAttribute('route') || 'straight';
    let pts;
    if (route === 'hv') pts = [[x1, y1], [x2, y1], [x2, y2]];
    else if (route === 'vh') pts = [[x1, y1], [x1, y2], [x2, y2]];
    else if (route === 'elbow') {
      if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) { const m = (x1 + x2) / 2; pts = [[x1, y1], [m, y1], [m, y2], [x2, y2]]; }
      else { const m = (y1 + y2) / 2; pts = [[x1, y1], [x1, m], [x2, m], [x2, y2]]; }
    } else pts = [[x1, y1], [x2, y2]];
    const head = this.getAttribute('head') || 'end';
    const id = 'h' + Math.random().toString(36).slice(2, 8);
    const s = w * 4;
    const mk = `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="${s}" markerHeight="${s}" refX="${s * 0.8}" refY="${s / 2}" orient="auto-start-reverse"><path d="M0 0L${s} ${s / 2}L0 ${s}z" fill="${color}"/></marker>`;
    const me = head === 'end' || head === 'both' ? `marker-end="url(#${id})"` : '';
    const ms = head === 'both' ? `marker-start="url(#${id})"` : '';
    this.innerHTML = `<svg style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none"><defs>${mk}</defs><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''} ${me} ${ms}/></svg>`;
  }
}

class XEmbed extends HTMLElement {
  setDoc(srcdoc) {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('title', 'Animación');
    f.setAttribute('tabindex', '-1');
    f.style.cssText = 'border:0;width:100%;height:100%;background:transparent;pointer-events:none;display:block';
    // Mismo color-scheme que la página: evita que el navegador pinte el iframe con fondo blanco.
    f.srcdoc = srcdoc.replace(/<head>/i, '<head><meta name="color-scheme" content="dark"><style>:root{color-scheme:dark}</style>');
    this.replaceChildren(f);
  }
}

export function defineSlideElements() {
  if (customElements.get('x-icon')) return;
  customElements.define('x-icon', XIcon);
  customElements.define('x-shape', XShape);
  customElements.define('x-connector', XConnector);
  customElements.define('x-embed', XEmbed);
}
