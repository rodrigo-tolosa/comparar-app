# compar.ar — Modo 2 (Next.js)

Motor de análisis de rangos de plena competencia para precios de transferencia.
Reconstrucción del Modo 2 sobre un stack profesional, separando **motor de cálculo** (TypeScript puro, testeado) de la **interfaz** (React).

## Stack elegido
- **Next.js 14 + TypeScript** — framework de aplicaciones (no dashboard): componentes, estado, y ruta natural a backend/API cuando llegue el embedding.
- **Tailwind CSS** con un design system propio (tokens de color, tipografía editorial Fraunces + Inter, cifras tabulares, dark mode) para una estética de herramienta, lejos del look "template".
- **Recharts** — gráficos de datos reales (no canvas artesanal).
- **SheetJS (xlsx)** — lectura del Excel 100% en el navegador.
- **Vitest** — tests del motor de cálculo.

> Por qué no Observable: Observable Framework es excelente para *publicar dashboards de datos*, pero compar.ar es una **aplicación** (uploads, formularios, estado, generación de archivos). Next encaja mejor y comparte camino con la futura migración del Modo 1 con embeddings.

## Arquitectura
```
lib/engine.ts        Motor de cálculo puro y tipado (rango, ajuste de patrimoniales,
                     base imponible, indicador de la tested). Sin dependencias.
lib/engine.test.ts   Suite de tests (Vitest). Verifica contra valores conocidos.
lib/parse.ts         Lectura del Excel (SheetJS) -> Dataset tipado.
lib/format.ts        Formato es-AR (%, números).
app/                 Pantalla y layout (App Router).
components/          UI y gráficos (Recharts).
```

## Correr en local
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # corre los tests del motor (vitest)
npm run build      # build + export estático a ./out
```

## Deploy
- **Recomendado — Vercel** (hogar natural de Next, gratis): importás el repo en vercel.com y deploya solo en cada push. Sirve en la raíz, sin configuración extra.
- **GitHub Pages** (para mantener tu flujo actual): como es `output: 'export'`, `npm run build` genera `./out`. Para un repo de proyecto (`usuario.github.io/compar.ar/`) hay que agregar `basePath: '/compar.ar'` en `next.config.mjs` y publicar el contenido de `./out`.

## Estado (fases)
- [x] **Fase 1 — cimientos**: stack, design system, motor de cálculo tipado + tests, y pantalla de rango (upload → cuartiles → gráfico → tabla de comparables).
- [x] **Fase 2** — panel unificado de la empresa analizada + ajuste de patrimoniales (motor ya portado en `engine.ts`).
- [x] **Fase 3** — anulación de años atípicos + gráfico de barras exportable (PNG) + Excel formateado.
- [x] **Fase 4** — generación de los cinco anexos Word (docx).
- [ ] **Fase 5** — pulido de diseño, accesibilidad y deploy productivo.
