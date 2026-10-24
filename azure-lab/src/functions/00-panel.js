// Panel web para proyectar las demos en clase: http://localhost:7071/api/panel
const { app } = require('@azure/functions');
const fs = require('node:fs');
const path = require('node:path');
const { leerBitacora, hay } = require('../lib/clientes');

const PANEL = path.join(__dirname, '..', '..', 'public', 'panel.html');

app.http('panel', {
  methods: ['GET'], authLevel: 'anonymous', route: 'panel',
  handler: async () => ({ headers: { 'content-type': 'text/html; charset=utf-8' }, body: fs.readFileSync(PANEL, 'utf8') }),
});

app.http('bitacora', {
  methods: ['GET'], authLevel: 'anonymous', route: 'bitacora',
  handler: async () => ({ jsonBody: { lineas: await leerBitacora(60), azure: { cosmos: hay.cosmos(), serviceBus: hay.serviceBus() } } }),
});
