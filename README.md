# PixPro Arena · DS5 Semana 5 · Arquitectura Basada en Eventos 2

Todo lo de la sesión de 100 minutos en un repositorio:

| Parte | Dónde | Qué es |
|---|---|---|
| Presentación + Arena | `src/` (sitio en GitHub Pages) | 64 diapositivas sencillas (5 opcionales) sincronizadas con el profesor y 6 rondas con actividades tipo Mentimeter (nube de palabras, escala, pregunta abierta, 100 puntos, adivina el número, ordenar y quiz) |
| Diagramas interactivos | `#/diagramas` | Seis escenas (Event Sourcing, Outbox + CDC, SAGA, coordinación, particiones y CAP) con JointJS + anime.js |
| Guía sin código | `guia-azure.html` | PixPro Lite paso a paso en el portal de Azure (Storage, Event Grid, Service Bus, Logic Apps) |
| Laboratorio en Azure | [`azure-lab/`](azure-lab/README.md) | Event Sourcing, Outbox + CDC, SAGA orquestada y resiliencia con Azure Functions (Node.js) |

Temas: almacenar y reproducir eventos · bandeja de salida, CDC y SAGA · coordinación (orquestación y coreografía) · optimización del flujo y latencia · compensaciones entre consistencia, disponibilidad y escalabilidad.

## Rutas del sitio

- `#/` portada · `#/sala` estudiante · `#/profesor` profesor (contraseña) · `#/diapositivas` repaso libre · `#/diagramas` diagramas interactivos.

## Cómo se usa en clase

1. **Profesor:** `#/profesor` → contraseña → **Crear sala nueva**. Se proyecta el QR con el PIN.
2. **Estudiantes:** escanean el QR (o `#/sala` + PIN) y eligen apodo. Ven la misma diapositiva que el profesor.
3. En cada diapositiva de **Arena PixPro** aparece **Lanzar ronda N** → **Revelar respuesta** → **Siguiente pregunta** → al terminar la ronda, **Volver a las diapositivas** (sin ranking intermedio).
4. En la última diapositiva: **Ver ranking final** → **Mostrar podio** → botón rojo **Final** (guarda el ranking, descarga el CSV y cierra la sala).

Las salas de esta semana se marcan con `week: 5`: un PIN de la semana 4 no funciona aquí y viceversa. Las claves del navegador también son distintas, así que las dos semanas conviven en el mismo dominio.

## Puesta en marcha (una sola vez)

Usa el **mismo proyecto de Firebase** que la Semana 4; no hay que crear nada nuevo en Firebase.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables**: crea las mismas 5 variables que en `sd5_week_4` (copia los valores de allá):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_HOST_EMAIL`.
3. **Actions → Publicar en GitHub Pages → Run workflow** (o cualquier push a `main`). En 1–2 minutos queda en `https://TU-DOMINIO/sd5_week_5/`.

Sin esas variables el sitio compila igual, pero en **modo demo local** (la sala solo funciona entre pestañas del mismo navegador).

## Desarrollo local

```bash
npm install
npm run dev
```

## Cambiar respuestas o contraseña

La clave de respuestas en claro vive en `private/answers.source.json` (no se sube: está en `.gitignore`).

```bash
HOST_PASSWORD='la-contraseña' npm run encrypt
```

## Actualizar diapositivas desde el deck

```bash
npm run sync-slides -- ruta/a/la/carpeta/del/deck   # quita notas del orador y respuestas
```

## Créditos técnicos

Vite + React 18, GSAP, anime.js 4, JointJS (`@joint/core`, MPL-2.0), canvas-confetti, qrcode, Firebase (Auth + Firestore, plan Spark) y GitHub Actions → Pages.
