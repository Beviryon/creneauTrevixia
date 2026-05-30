# Réservation PFF — Trevixia Academy

Application web de réservation de créneaux de soutenance PFF.

## Déploiement (Firebase requis)

Les créneaux doivent être stockés en **base partagée** pour que tous les candidats voient les mêmes disponibilités.

### 1. Créer un projet Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet**
2. **Build → Firestore Database** → Créer une base (mode **production**)
3. **Règles** → coller le contenu de `firebase/firestore.rules` → Publier

### 2. Créer une application Web

1. **Paramètres du projet → Vos applications → Web** (`</>`)
2. Copier l'objet `firebaseConfig`

### 3. Configurer `config.js`

```javascript
window.PFF_CONFIG = {
  firebase: {
    apiKey: 'AIza...',
    authDomain: 'mon-projet.firebaseapp.com',
    projectId: 'mon-projet',
    storageBucket: 'mon-projet.appspot.com',
    messagingSenderId: '...',
    appId: '1:...:web:...',
  },
};
```

Redéployez le site avec ce fichier.

### 4. Index Firestore (si demandé)

Si Firebase signale un index manquant pour la requête `email`, créez-le via le lien dans la console ou déployez `firebase/firestore.indexes.json`.

### 5. Vérifier

Console navigateur (F12) → `[PFF] Mode cloud Firebase actif`

## Collection Firestore

| Collection | Document ID | Champs |
|------------|-------------|--------|
| `reservations` | hash du créneau | `slot`, `fullName`, `email`, `brand`, `createdAt` |

## Fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | Réservation |
| `confirmation.html` | Confirmation |
| `admin.html` | Admin (URL directe + PIN) |
| `config.js` | Clés Firebase |
| `storage.js` | Couche données |
| `firebase/firestore.rules` | Règles de sécurité |

## Admin (Firebase Authentication)

1. Firebase Console → **Authentication** → **Sign-in method** → activer **E-mail/Mot de passe**
2. Onglet **Users** → **Add user** → créez l'e-mail et le mot de passe admin
3. Ajoutez cet e-mail dans `config.js` → `adminEmails`
4. Accès : `/admin.html` → connexion e-mail + mot de passe

## Lancement local

```bash
npx serve .
```

## Formations

[Nos formations Trevixia](https://trevi-training.vercel.app/)
