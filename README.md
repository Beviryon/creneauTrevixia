# Réservation PFF — Trevixia Academy

Application web de réservation de créneaux de soutenance PFF (Projet de Fin de Formation).

## Fonctionnalités

- Réservation de créneaux par les étudiants
- Confirmation avec conseils de préparation
- Annulation et changement de créneau
- Page admin protégée par code d'accès

## Fichiers

| Fichier | Description |
|---------|-------------|
| `index.html` | Page de réservation |
| `confirmation.html` | Confirmation + conseils |
| `admin.html` | Administration (URL directe) |
| `storage.js` | Couche localStorage |
| `style.css` | Styles |

## Lancement local

Ouvrir `index.html` avec Live Server ou un serveur local :

```bash
npx serve .
```

## Admin

Accès : `/admin.html` (URL directe, non linkée publiquement)

Modifier le code dans `storage.js` → constante `ADMIN_PIN`.

## Stockage V1

Données en `localStorage` (local au navigateur). Prévu pour migration API ultérieure.

## Formations Trevixia

[Nos formations](https://trevi-training.vercel.app/)
