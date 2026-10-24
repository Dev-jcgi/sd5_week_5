import confetti from 'canvas-confetti';

const COLORS = ['#FF8A3D', '#6EA8FF', '#C6F33A', '#B78CFF'];
export function celebrate(big = false) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({ particleCount: big ? 220 : 90, spread: big ? 110 : 70, origin: { y: 0.7 }, colors: COLORS });
}
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
export const newPin = () => String(Math.floor(100000 + Math.random() * 900000));
