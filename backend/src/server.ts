import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connectDatabase } from './database.js';

const config = readConfig(process.env);
const { client, db } = await connectDatabase(config.mongoUri);
const app = createApp(db, config.jwtSecret);
// Built assets share the API origin; Vite supplies a proxy during development.
const frontendDirectory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
app.use(express.static(frontendDirectory));
app.get('/{*path}', (_req, res) => { res.sendFile(`${frontendDirectory}/index.html`); });
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`Car Dealership running at http://127.0.0.1:${config.port}`);
});
server.on('error', async error => {
  console.error('Unable to start HTTP server:', error.message);
  await client.close();
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async () => { await client.close(); });
    server.closeIdleConnections();
  });
}
