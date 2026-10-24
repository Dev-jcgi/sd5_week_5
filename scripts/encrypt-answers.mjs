// Genera src/data/answers.enc.json a partir de private/answers.source.json.
// Uso:  HOST_PASSWORD='tu-contraseña' npm run encrypt
// La carpeta private/ está en .gitignore: nunca subas el archivo fuente al repositorio.
import fs from 'node:fs';
import { encryptJSON } from '../src/lib/crypto.js';

const pwd = process.env.HOST_PASSWORD;
if (!pwd) { console.error('Define HOST_PASSWORD con la contraseña del profesor.'); process.exit(1); }
const src = JSON.parse(fs.readFileSync('private/answers.source.json', 'utf8'));
const box = await encryptJSON(src, pwd);
fs.writeFileSync('src/data/answers.enc.json', JSON.stringify(box));
console.log(`OK: ${Object.keys(src).length} respuestas cifradas → src/data/answers.enc.json`);
