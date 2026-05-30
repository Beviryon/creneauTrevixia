# Réservation PFF — Trevixia Academy

Application web de réservation de créneaux de soutenance PFF.

## Secrets — important

**Ne committez jamais `config.js`** (clés Firebase). Ce fichier est dans `.gitignore`.

| Environnement | Configuration |
|---------------|---------------|
| **Local** | `copy config.example.js config.js` puis remplissez |
| **Vercel** | Variables d'environnement (voir ci-dessous) |

## Déploiement Vercel

### Variables d'environnement

Dans Vercel → **Settings → Environment Variables**, ajoutez :

| Variable | Exemple |
|----------|---------|
| `FIREBASE_API_KEY` | `AIzaSy...` |
| `FIREBASE_AUTH_DOMAIN` | `creneau-trevixia.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `creneau-trevixia` |
| `FIREBASE_STORAGE_BUCKET` | `creneau-trevixia.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | `99772802044` |
| `FIREBASE_APP_ID` | `1:99772802044:web:...` |
| `FIREBASE_MEASUREMENT_ID` | `G-...` (optionnel) |
| `ADMIN_EMAILS` | `trevixiacontact@gmail.com` |

Au déploiement, `npm run build` génère `config.js` automatiquement.

### Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → votre projet
2. **Firestore** → créer la base + publier `firebase/firestore.rules`
3. **Authentication** → activer E-mail/Mot de passe → créer l'utilisateur admin

## Développement local

```bash
copy config.example.js config.js
# Éditez config.js avec vos clés
npx serve .
```

## Vérification

Console (F12) → `[PFF] Mode cloud Firebase actif`

## Admin

URL : `/admin.html` — connexion avec le compte Firebase listé dans `ADMIN_EMAILS`

## Formations

[Nos formations Trevixia](https://trevi-training.vercel.app/)

## Clé exposée sur GitHub ?

1. Supprimez `config.js` du dépôt (déjà ignoré)
2. **Restreignez la clé** : [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → votre clé → **Application restrictions** → HTTP referrers (votre domaine Vercel + localhost)
3. Optionnel : régénérez la clé Web dans Firebase → Project Settings → votre app Web
