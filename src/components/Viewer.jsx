import { useEffect, useState } from 'react';
import SlideStage from './SlideStage.jsx';
import { SLIDES } from '../lib/slides.js';

/** Repaso libre de las diapositivas (sin sala). Útil después de clase. */
export default function Viewer() {
  const start = +(new URLSearchParams(location.hash.split('?')[1] || '').get('s') || 1) - 1;
  const [i, setI] = useState(Math.max(0, Math.min(SLIDES.length - 1, start)));
  useEffect(() => {
    const on = (e) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(SLIDES.length - 1, x + 1)); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  return (
    <div className="page viewer">
      <div className="viewer-stage"><SlideStage index={i} /></div>
      <nav className="ctrl" aria-label="Navegación">
        <button className="cbtn" onClick={() => setI(Math.max(0, i - 1))} aria-label="Anterior">◀</button>
        <span className="mono cnum">{i + 1}/{SLIDES.length}</span>
        <button className="cbtn" onClick={() => setI(Math.min(SLIDES.length - 1, i + 1))} aria-label="Siguiente">▶</button>
        <span className="grow" />
        <span className="note">{SLIDES[i].title}</span>
      </nav>
    </div>
  );
}
