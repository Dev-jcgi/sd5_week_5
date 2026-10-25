import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { MODE } from '../lib/backend.js';
import { SLIDES } from '../lib/slides.js';
import SlideStage from './SlideStage.jsx';

const FEED = [['LoteCreado', 'v1 · lote-481'], ['outbox.enviado', 'relay/CDC → broker'], ['CreditosReservados', 'v2 · saga paso 1'], ['ImagenProcesada', 'v3 · reintento 2 ok'], ['PublicacionFallida', 'CDN 503 → compensar'], ['CreditosLiberados', 'v4 · compensación']];

export default function Landing() {
  const hero = useRef(null);
  const feed = useRef(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.from(hero.current.children, { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', clearProps: 'all' });
    let i = 0;
    const add = () => {
      const [n, d] = FEED[i++ % FEED.length];
      const el = document.createElement('div');
      el.className = 'ln';
      const t = new Date(2026, 9, 15, 16, 21, i % 60).toTimeString().slice(0, 8);
      el.innerHTML = `<span>${t}</span> <b>${n}</b> <span>${d}</span>`;
      feed.current?.appendChild(el);
      while (feed.current && feed.current.children.length > 7) feed.current.firstChild.remove();
      gsap.from(el, { x: -14, opacity: 0, duration: 0.35 });
    };
    for (let k = 0; k < 6; k++) add();
    const id = setInterval(add, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="page landing">
      <section className="hero wrap">
        <div ref={hero}>
          <p className="eyebrow">Desarrollo de Software 5 · Semana 5 · Universidad Jala</p>
          <h1 className="display">Eventos que se guardan, se reproducen y se compensan, <em>en vivo</em>.</h1>
          <p className="lead">La presentación y la Arena PixPro en un solo lugar: sigue las diapositivas del profesor en tu dispositivo y responde las rondas cuando se lancen.</p>
          <div className="cta">
            <a className="btn" href="#/sala">Soy estudiante</a>
            <a className="btn ghost" href="#/diagramas">Diagramas interactivos</a>
            <a className="btn ghost" href={`${import.meta.env.BASE_URL}guia-azure.html`}>Guía: PixPro Lite en Azure</a>
            <a className="btn ghost" href="#/profesor">Soy profesor</a>
          </div>
          {MODE === 'local' && <p className="note">Modo demo local activo: sin Firebase configurado, la sala solo funciona entre pestañas de este navegador.</p>}
        </div>
        <div className="term" aria-label="Flujo de eventos de ejemplo">
          <div className="hd"><b /><b /><b />&nbsp;stream: pixpro.events</div>
          <div className="bd" ref={feed} />
        </div>
      </section>
      <section className="wrap preview">
        <p className="eyebrow">Vista previa · {SLIDES.length} diapositivas · 12 rondas</p>
        <div className="preview-frame"><SlideStage index={0} /></div>
      </section>
    </div>
  );
}
