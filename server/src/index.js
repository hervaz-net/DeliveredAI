import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { ensureAdmin } from './bootstrap.js';

const db = openDb(config.dbPath);
ensureAdmin(db, config.adminUsername, config.adminPassword);
createApp(db).listen(config.port, () => {
  console.log(`DeliveredAI API listening on http://localhost:${config.port}`);
});
