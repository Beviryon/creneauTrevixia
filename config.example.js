/**
 * Copiez ce fichier en config.js pour le développement local.
 * config.js est ignoré par Git — ne jamais le committer.
 *
 * Sur Vercel : les variables d'environnement génèrent config.js au déploiement.
 */
window.PFF_CONFIG = {
  firebase: {
    apiKey: 'VOTRE_API_KEY',
    authDomain: 'votre-projet.firebaseapp.com',
    projectId: 'votre-projet',
    storageBucket: 'votre-projet.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef',
    measurementId: 'G-XXXXXXXXXX',
  },
  adminEmails: [
    'admin@trevixia.com',
  ],
};
