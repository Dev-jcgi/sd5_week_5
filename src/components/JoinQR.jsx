import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Enlace directo para que el estudiante entre con el PIN ya escrito. */
export function joinUrl(pin) {
  return `${location.origin}${location.pathname}#/sala?pin=${pin}`;
}

/** Código QR de la sala: al escanearlo, el celular abre la página de unión con el PIN listo. */
export default function JoinQR({ pin, size = 320 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(joinUrl(pin), { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0A0B10', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''));
    return () => { alive = false; };
  }, [pin, size]);
  return (
    <div className="qr" style={{ width: size, height: size }}>
      {src ? <img src={src} width={size} height={size} alt={`Código QR para entrar a la sala ${pin}`} /> : <span className="note">Generando QR…</span>}
    </div>
  );
}
