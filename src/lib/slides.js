// Carga las diapositivas (HTML de 1920×1080) y separa las animaciones embebidas.
import manifest from '../slides/manifest.json';

const files = import.meta.glob('../slides/html/*.html', { query: '?raw', import: 'default', eager: true });

/** Las <x-embed> contienen documentos completos (con <style>); si se insertaran tal cual,
 *  sus estilos se filtrarían a la página. Se extraen y se cargan en un iframe aislado. */
function parse(raw) {
  const embeds = [];
  const html = raw.replace(/<x-embed([^>]*)>([\s\S]*?)<\/x-embed>/g, (_, attrs, inner) => {
    embeds.push(inner);
    return `<x-embed${attrs} data-embed="${embeds.length - 1}"></x-embed>`;
  });
  return { html, embeds };
}

export const SLIDES = Object.keys(files).sort().map((path) => {
  const id = path.split('/').pop().replace(/^\d+-/, '').replace(/\.html$/, '');
  const raw = files[path];
  const title = (raw.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/) || [, id])[1].replace(/<[^>]+>/g, '').trim();
  return { id, title, ...parse(raw) };
});

export const DECK_TITLE = manifest.title;
export const SECTIONS = manifest.sections.map((s) => ({ ...s, index: SLIDES.findIndex((x) => x.id === s.start) }));
