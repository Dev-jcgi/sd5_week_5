// Copia las diapositivas exportadas del deck (project/deck.json + project/slides/*.html)
// a src/slides/html, quitando lo que NO debe llegar al navegador de los estudiantes:
//  - <aside> (notas del orador)
//  - las "píldoras" de respuesta de las rondas (data-build-in con "Respuesta:")
//  - la línea "Clic para revelar la respuesta →"
// Uso: node scripts/sync-slides.mjs <carpeta-del-deck-que-contiene-project/>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Uso: node scripts/sync-slides.mjs <carpeta-del-deck>'); process.exit(1); }
const deck = JSON.parse(fs.readFileSync(path.join(src, 'project/deck.json'), 'utf8'));
const out = path.resolve('src/slides/html');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));

const clean = (html) => html
  .replace(/<aside>[\s\S]*?<\/aside>/g, '')
  .replace(/<p data-build-in="pop"[^>]*>Respuesta:[\s\S]*?<\/p>/g, '')
  .replace(/<p [^>]*>Clic para revelar la respuesta →<\/p>/g, '');

deck.order.forEach((id, i) => {
  const html = fs.readFileSync(path.join(src, 'project/slides', `${id}.html`), 'utf8');
  const name = `${String(i + 1).padStart(2, '0')}-${id}.html`;
  fs.writeFileSync(path.join(out, name), clean(html).trim() + '\n');
});
const sections = Object.values(deck.sections).map((s) => ({ title: s.description, start: s.start }));
fs.writeFileSync(path.resolve('src/slides/manifest.json'), JSON.stringify({ title: deck.title, order: deck.order, sections }, null, 2));
console.log(`OK: ${deck.order.length} diapositivas → ${out}`);
