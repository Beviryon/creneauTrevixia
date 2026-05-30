/**
 * Génère config.js depuis les variables d'environnement (Vercel / CI).
 * En local : copiez config.example.js → config.js
 */
const fs = require('fs');
const path = require('path');

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('Variables manquantes :', missing.join(', '));
  process.exit(1);
}

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

if (adminEmails.length === 0) {
  console.error('Variable ADMIN_EMAILS requise (e-mails séparés par des virgules).');
  process.exit(1);
}

const measurementId = process.env.FIREBASE_MEASUREMENT_ID;

const config = {
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  },
  adminEmails,
};

if (measurementId) {
  config.firebase.measurementId = measurementId;
}

const output = `/** Généré automatiquement — ne pas committer */\nwindow.PFF_CONFIG = ${JSON.stringify(config, null, 2)};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'config.js'), output, 'utf8');
console.log('config.js généré avec succès.');
