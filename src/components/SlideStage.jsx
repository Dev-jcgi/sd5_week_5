import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SLIDES } from '../lib/slides.js';

const BUILD = {
  fade: { opacity: 0 },
  rise: { opacity: 0, y: 40 },
  drop: { opacity: 0, y: -60 },
  left: { opacity: 0, x: -60 },
  right: { opacity: 0, x: 60 },
  scale: { opacity: 0, scale: 0.85 },
  pop: { opacity: 0, scale: 0.6, ease: 'back.out(2)' },
};

/** Muestra una diapositiva de 1920×1080 escalada al contenedor, con transición y animaciones de entrada. */
export default function SlideStage({ index, className = '' }) {
  const box = useRef(null);
  const holder = useRef(null);
  const [scale, setScale] = useState(1);
  const prev = useRef(index);

  useLayoutEffect(() => {
    const el = box.current;
    const fit = () => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080) || 0.1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const slide = SLIDES[index];
    if (!slide || !holder.current) return;
    const dir = index >= prev.current ? 1 : -1;
    prev.current = index;
    const h = holder.current;
    h.innerHTML = slide.html;
    h.querySelectorAll('x-embed[data-embed]').forEach((e) => e.setDoc?.(slide.embeds[+e.dataset.embed]));
    const sec = h.querySelector('section');
    if (!sec) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const tr = sec.dataset.transition || 'fade';
    gsap.fromTo(sec, tr === 'push' ? { x: 120 * dir, opacity: 0 } : tr === 'magic' ? { scale: 0.97, opacity: 0 } : { opacity: 0 },
      { x: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out' });
    const items = [...sec.querySelectorAll('[data-build-in]')]
      .map((el) => { const [kind, order] = el.dataset.buildIn.split(' '); return { el, kind, order: +order || 1 }; })
      .sort((a, b) => a.order - b.order);
    items.forEach(({ el, kind }, i) => {
      const from = BUILD[kind] || BUILD.fade;
      gsap.from(el, { ...from, duration: 0.7, delay: 0.25 + i * 0.18, ease: from.ease || 'power3.out', clearProps: 'transform,opacity' });
    });
  }, [index]);

  return (
    <div ref={box} className={`stage-box ${className}`}>
      <div className="stage-canvas" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
        <div ref={holder} className="slide-holder" />
      </div>
    </div>
  );
}
