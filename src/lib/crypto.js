// Cifrado de la clave de respuestas con la contraseña del profesor.
// PBKDF2-SHA256 (310 000 iteraciones) + AES-GCM 256. Funciona en el navegador y en Node 20+.
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;
const b64 = (buf) => (typeof btoa === 'function' ? btoa(String.fromCharCode(...new Uint8Array(buf))) : Buffer.from(buf).toString('base64'));
const unb64 = (s) => Uint8Array.from(typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'), (c) => c.charCodeAt(0));
export const ITER = 310000;

async function deriveKey(password, salt) {
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(obj, password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

/** Devuelve el objeto descifrado o lanza si la contraseña es incorrecta. */
export async function decryptJSON(box, password) {
  const key = await deriveKey(password, unb64(box.salt));
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data));
  return JSON.parse(dec.decode(pt));
}
