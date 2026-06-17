# BRIEF DE REPRISE — Ultras Lutetia PWA
*Mis à jour le 17/06/2026*

---

## 🚀 Démarrage de chaque conversation

```
1. Uploader : index.html + src/app.js + validate.js
2. Dire : "Lance validate.js sur app.js avant de commencer"
3. Décrire la fonctionnalité (utiliser le template ci-dessous)
```

---

## Contexte projet

- **PWA** vanilla HTML/CSS/JS — GitHub Pages
- **Repo** : `ulcelluletifo.github.io/ultras-lutetia`
- **Backend** : Supabase PostgreSQL (projet `ypsvdicatkckrxrcyxax`, EU West Ireland)
- **Groupe** : Ultras Lutetia — supporters Paris FC

---

## Structure fichiers (état actuel)

```
index.html              ← HTML pur (896 lignes) — NE PAS TOUCHER sauf modals
src/
  app.js                ← tout le JS (2107 lignes) — fichier principal
  config.js             ← clés Supabase
  supabase-client.js    ← fonctions UL.*
  styles.css            ← design "Ultra Noir"
validate.js             ← script validation (node validate.js src/app.js)
```

---

## Architecture technique

**Design system**
- Fonts : Bebas Neue (titres), Barlow Condensed (sous-titres), Inter (corps)
- Couleurs : `--bleu #1A56DB`, `--gris #64748B`, `--surface #1E293B`
- Style : dark mode "Ultra Noir"

**Supabase tables principales**
```
membres               — id, prenom, nom, pseudo_telegram, email, statut,
                        roles_app TEXT[], section_id, charte_signee,
                        cotisation_a_jour, actif, created_at
sessions_tifo         — id, nom, date, heure, lieu, type_session, statut,
                        avec_pizza, capacite_max, lien_telegram,
                        code_validation, description
inscriptions_session  — id, session_id, membre_id, statut, pizza, pinte
matchs                — id, equipe_domicile, equipe_exterieur, date, horaire,
                        type, stade, competition, journee, statut,
                        score_domicile, score_exterieur,
                        logo_domicile, logo_exterieur
deplacements          — id, adversaire, date_match, stade, ville, point_rdv,
                        heure_depart, prix_total, places_max, statut,
                        lien_helloasso, date_limite_inscription, notes, match_id
inscriptions_deplacement — id, deplacement_id, membre_id, statut_paiement, qr_code
evenements            — id, nom, type, date, heure, lieu, description,
                        lien_helloasso
produits              — id, nom, description, categorie, prix, stock,
                        avec_tailles, niveau_acces, section_id, mode,
                        statut, photo_url
commandes             — id, membre_id, total, mode_paiement, statut
commande_items        — id, commande_id, produit_id, taille, quantite
sticks_catalogue      — id, nom, categorie, serie, prix, stock, quota_par_membre,
                        visuel_url, lien_helloasso, section_id
sticks_distribution   — id, stick_id, membre_id, quantite, mode_paiement, statut
cotisations           — id, membre_id, saison, statut, paye_at
signatures_charte     — id, membre_id, charte_id, signed_at
annonces              — id, titre, contenu, categorie, created_at
sections              — id, nom
```

---

## Système de droits (roles_app TEXT[])

```javascript
// Statut UL (affichage uniquement) : sympathisant / draft / confirme
// Rôles fonctionnels (accès outils) dans roles_app[] :
isAdmin(m)          // roles_app inclut 'admin_app'
isBureau(m)         // admin_app OU bureau_app
isCellule(m)        // n'importe quel rôle fonctionnel
hasCelluleTifo(m)   // admin_app OU bureau_app OU cellule_tifo
hasCelluleDepl(m)   // admin_app OU bureau_app OU cellule_depl
hasCelluleMatos(m)  // admin_app OU bureau_app OU cellule_matos
hasCelluleSticks(m) // admin_app OU bureau_app OU cellule_sticks
hasCelluleComite(m) // admin_app OU bureau_app OU cellule_comite
peutValiderInscriptions(m) // admin_app OU bureau_app OU cellule_comite
```

---

## Navigation (7 onglets)

```
🏠 Accueil · 📅 Calendrier · 🚌 Dépl · 🎨 Sessions · 🛍️ Boutique · 👤 Profil · ⚙️ Admin
```
L'onglet Admin (`nav6`) est masqué par défaut, visible uniquement si `isCellule(membre)`.

---

## Ce qui est fait ✅

### Auth
- Login par pseudo Telegram + mot de passe
- Inscription (statut sympathisant en attente validation)
- Email fictif `pseudo@ultralutetia.com` (Supabase Auth)
- RGPD checkbox à l'inscription

### Accueil
- Annonces (Bureau+)
- Prochaines sessions (2 max)
- Prochain déplacement
- Mes stats (présences, assiduité, déplacements, inscriptions)
- Demandes d'inscription en attente (peutValiderInscriptions)

### Sessions Tifo ✅ COMPLET
- Création session (hasCelluleTifo)
- Modification session (hasCelluleTifo)
- Inscription avec modale de confirmation
- Bouton Telegram après inscription
- Ouverture session → code 4 chiffres affiché sur la card (hasCelluleTifo)
- Modal présence enrichie :
  - Code 4 chiffres
  - Choix pizza : Margherita / Regina / 4 Fromages / Bellissima / Je ne mange pas
  - Choix pinte : Blonde / Brune / Sans pinte
- Vue commandes pizza groupée + copier-coller (hasCelluleTifo)
- Liste inscrits visible par tous
- Séparation Sessions à venir / Historique

### Déplacements ⚠️ PARTIEL
- Cards déplacements avec statut
- Modal détail
- Inscription bus (bouton présent)
- ❌ Validation paiement admin à finaliser
- ❌ Liste bus à tester

### Calendrier ✅
- 34 matchs Ligue 1 2026-2027 insérés
- Logos clubs dans Supabase Storage
- Filtres : Tous / Domicile / Extérieur / Événements
- Saisie score (Bureau+)
- Événements : réunion / BBQ / fête / autre
- Modifier/supprimer événement (Bureau+)

### Administration ✅
- Page Admin catégorisée avec droits fins
- Membres : gérer, demandes, cartage
- Calendrier : matchs, événements, annonces
- Déplacements, Sessions, Matos, Sticks, Stats

### Membres ✅
- Modifier : prénom, nom, telegram, email, statut UL, section
- Rôles fonctionnels avec toggles visuels (roles_app[])
- Section par défaut : Ultra Lutetia
- Bloquer/débloquer

### Cartage ✅
- Vue consolidée cotisation + charte
- Filtres : Tous / Cartés / Incomplets
- Validation cash et HelloAsso

### Boutique Matos ⚠️ PARTIEL
- Catalogue produits avec photos
- Commander (stock / précommande)
- Tailles (S/M/L/XL/XXL)
- ❌ À tester en prod

### Boutique Sticks ⚠️ PARTIEL
- Catalogue sticks
- Distribution admin
- ❌ À tester en prod

### Cotisations ⚠️ PARTIEL
- Statut cotisation membre
- Validation cash/HelloAsso admin
- ❌ Config montant/lien à tester

### Profil ✅
- Infos membre
- Changer mot de passe
- Stats perso

### Charte ✅
- Lecture complète requise avant signature
- Signature en BDD

---

## Ce qui reste à faire ❌

### Priorité 1 — Déplacements
- Finaliser validation paiement cash/HA côté admin
- Tester liste bus Telegram

### Priorité 2 — Module Profil
- Voir ses inscriptions sessions
- Voir ses inscriptions déplacements

### Priorité 3 — Boutique
- Tester matos + sticks + cotisations en prod
- QR code billet déplacement

### Priorité 4 — Sessions
- Notation membres après session (étoiles 1-3)
- Statut présence côté admin en temps réel

---

## Pizzas & Pintes (Sessions)

```javascript
const PIZZAS = [
  { id: 'margherita', label: 'Margherita',                         emoji: '🍕' },
  { id: 'regina',     label: 'Regina (Jambon Champignon)',          emoji: '🍕' },
  { id: '4fromages',  label: '4 Fromages',                         emoji: '🍕' },
  { id: 'bellissima', label: 'Bellissima (Viande, Chorizo, Poivrons)', emoji: '🍕' },
  { id: 'aucune',     label: 'Je ne mange pas',                    emoji: '🚫' },
];
const PINTES = [
  { id: 'blonde', label: 'Blonde', emoji: '🍺' },
  { id: 'brune',  label: 'Brune',  emoji: '🍺' },
  { id: 'sans',   label: 'Sans pinte', emoji: '❌' },
];
```

---

## Workflow de dev (à suivre impérativement)

```bash
# 1. Début de conversation
#    Uploader index.html + src/app.js + validate.js
#    "Lance validate.js sur app.js avant de commencer"

# 2. Après livraison des fichiers
node validate.js src/app.js   # doit afficher ✅ PROPRE

# 3. Déployer
cp app.js src/app.js
git add src/app.js index.html
git commit -m "module: description courte de ce qui change"
git push

# 4. Tester en prod, puis démarrer la prochaine conversation
```

---

## Template demande de fonctionnalité

```markdown
## Fonctionnalité à coder
**Module :** [Sessions / Déplacements / Matos / ...]
**Fichier concerné :** src/app.js (+ index.html si nouveau modal)

**Ce qui existe déjà :**
- [lister]

**Ce qui manque :**
- [lister précisément]

**Droits :**
- Action X : [quel rôle]
- Action Y : [quel rôle]

**Tables Supabase concernées :**
- [table(nom_colonne, ...)]

**Comportement attendu :**
1. [étape 1]
2. [étape 2]
```
