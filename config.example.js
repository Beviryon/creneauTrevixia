/**
 * Configuration Firebase — copiez en config.js et remplissez vos clés.
 * Firebase Console → Paramètres du projet → Vos applications → Config
 */
window.PFF_CONFIG = {
  firebase: {
    apiKey: 'VOTRE_API_KEY',
    authDomain: 'votre-projet.firebaseapp.com',
    projectId: 'votre-projet',
    storageBucket: 'votre-projet.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef',
  },

  /** E-mails autorisés pour l'admin (doivent exister dans Firebase Auth) */
  adminEmails: [
    'admin@trevixia.com',
  ],
};
