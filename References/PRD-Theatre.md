# Document de Spécifications Produits (PRD) — Outil de Pratique Théâtrale (Rehearsal Assistant)

**Version :** 1.1  
**Date :** 18 août 2026 (mise à jour le 20 août 2026)  
**Statut :** Validé / En Développement — voir [§7 État d'Avancement](#7-état-davancement-implémentation-actuelle) pour le suivi de l'implémentation.  
**Nom de code projet :** EncorePlay

---

## 1. Vision & Objectifs du Produit

### 1.1 Vision
Concevoir une application web responsive, moderne et intuitive permettant aux comédiens de travailler et répéter leurs textes de théâtre de manière autonome, interactive et fluide. L'outil agit comme un partenaire de jeu virtuel dynamique capable d'importer des répliques, de lire les rôles adéquats et de s'adapter au rythme d'apprentissage du comédien.

### 1.2 Objectifs Clés
* **Polyvalence d'Importation :** Prendre en charge nativement les scripts au format standardisé **Fountain**, ainsi que les formats **JSON** personnalisés et le texte brut / Markdown.
* **Apprentissage Progressif :** Offrir des modes d'entraînement configurables (écoute passive, masquage progressif du texte, répétition active avec reconnaissance vocale / détection de silence).
* **Synthèse Vocale (TTS) Distribuée :** Associer des voix et des timbres distincts à chaque personnage du script pour une immersion maximale.
* **Confidentialité & Travail Hors Ligne :** Favoriser le traitement local dans le navigateur pour garantir la réactivité et la confidentialité des œuvres.

---

## 2. Personas & Cas d'Usage

### 2.1 Personas
1. **Comédien Individuel :** Veut apprendre son rôle de manière autonome sans avoir besoin d'une tierce personne pour lui « donner la réplique ».
2. **Metteur en Scène / Auteur :** Souhaite tester la fluidité des dialogues d'une pièce en attribuant des voix différentes aux personnages pour une première écoute.
3. **Troupe Amateure / Étudiants :** Souhaitent annoter le script, marquer les didascalies et travailler spécifiquement certaines scènes ou actes.

### 2.2 Cas d'Usage Principaux
* **UC-01 : Importation de Pièce :** Charger un fichier `.fountain`, `.json` ou copier-coller du texte brut.
* **UC-02 : Configuration de la Session :** Sélectionner le rôle joué par l'utilisateur et assigner des voix TTS aux rôles virtuels.
* **UC-03 : Mode Répétition (Partner Mode) :** Le système lit la réplique du rôle adverse, puis attend que l'utilisateur dise sa réplique avant de poursuivre.
* **UC-04 : Mode Masquage (Memory / Prompt Mode) :** Masquer partiellement ou totalement le texte du rôle de l'utilisateur avec option d'affichage des premiers mots ("prompter").

---

## 3. Fonctionnalités Détaillées

### 3.1 Gestion des Scripts & Parsing
* **Parseur Fountain Natif :** Détection automatique des éléments de scénario / théâtre :
  * Titres, Actes, Scènes (`# ACTE I`, `## SCÈNE 1`).
  * Personnages (`CHARACTER` en majuscules).
  * Didascalies / Parenthèses (`(hésitant)`).
  * Dialogues.
* **Éditeur / Visualiseur Intégré :** Visualisation propre du texte formaté façon pièce de théâtre, avec coloration syntaxique des rôles.

### 3.2 Configuration de Session & Personnages
* **Assignation des Rôles :** L'utilisateur choisit son rôle principal (ex. *CYRANO*).
* **Attribution des Voix TTS :** 
  * Choix des voix disponibles via l'API Web Speech TTS du navigateur ou services cloud (Web Speech API / ElevenLabs API / Google Cloud TTS).
  * Configuration de la hauteur (*pitch*), de la vitesse (*rate*) et du volume par personnage.
* **Gestion des Didascalies :**
  * Option pour lire ou ignorer les didascalies lors de la lecture.
  * Utilisation d'une voix neutre/narrateur pour les didascalies contextuelles.

### 3.3 Modes de Pratique & Entraînement

| Mode | Description | Comportement Système |
| :--- | :--- | :--- |
| **Lecture Continue (Italie)** | Débit rapide, sans interprétation, pour caler le texte. | Le TTS enchaine toutes les répliques sans interruption. |
| **Donner la Réplique (Partner)** | Le partenaire virtuel joue son rôle et attend le comédien. | Le TTS lit le rôle adverse. À la fin de la réplique, attente active (détection vocale STT ou appui barre d'espace / bouton) pour passer à la suite. |
| **Masquage / Trou de Mémoire** | Aide à la mémorisation du texte utilisateur. | Le texte de l'utilisateur est masqué (flouté, remplacé par des tirets, ou seuls les premiers mots affichés). Un clic ou survol permet de révéler le texte ("souffleur"). |
| **Boucle de Scène** | Répétition ciblée. | Possibilité de boucler sur un ensemble de répliques spécifique. |

### 3.4 Interface Utilisateur (UI/UX)
* **Design Responsive :** Optimisé pour tablettes et smartphones (pour répétition sur scène ou en déplacement).
* **Contrôles de Lecture Flottants :** Boutons Lecture, Pause, Suivant, Précédent, Recommencer la réplique, Souffleur.
* **Indicateurs Visuels :** Mise en évidence dynamique (highlighting) de la réplique en cours de lecture.

---

## 4. Architecture Technique & Data Formats

### 4.1 Modèle de Données Interne (JSON Structure)

Pour manipuler la pièce au sein de l'application (état React/Vue/Web Component), le script converti est stocké selon le schéma JSON suivant :

```json
{
  "title": "Cyrano de Bergerac",
  "author": "Edmond Rostand",
  "version": "1.0",
  "characters": [
    {
      "id": "char_cyrano",
      "name": "CYRANO",
      "voice": {
        "lang": "fr-FR",
        "name": "Thomas",
        "pitch": 1.0,
        "rate": 1.1
      }
    },
    {
      "id": "char_christian",
      "name": "CHRISTIAN",
      "voice": {
        "lang": "fr-FR",
        "name": "Bernard",
        "pitch": 0.95,
        "rate": 1.0
      }
    }
  ],
  "acts": [
    {
      "act_number": 1,
      "title": "Acte I - Une représentation à l'Hôtel de Bourgogne",
      "scenes": [
        {
          "scene_number": 1,
          "title": "Scène 1",
          "elements": [
            {
              "type": "stage_direction",
              "content": "La salle de l'Hôtel de Bourgogne, en 1640. Une sorte de jeu de paume aménagé et décoré pour des représentations."
            },
            {
              "type": "dialogue",
              "character_id": "char_christian",
              "parenthetical": "apercevant Roxane",
              "lines": [
                "C'est elle !",
                "N'est-ce pas qu'elle est ravissante ?"
              ]
            },
            {
              "type": "dialogue",
              "character_id": "char_cyrano",
              "parenthetical": "avec gravité",
              "lines": [
                "Un poète est un oiseau qui vole sans se préoccuper des limites."
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

> **Écart avec l'implémentation actuelle (voir §7.1) :** le backend implémenté utilise
> un `id` entier séquentiel (`1`, `2`, `3`…) plutôt qu'une chaîne `"char_xxx"`, et un
> `Character` plat (`lang`, `line_count`, `role`) plutôt que l'objet `voice` imbriqué
> (pitch/rate/name) montré ci-dessus — l'attribution de voix TTS n'est pas encore
> implémentée, ce schéma reste donc l'objectif cible pour cette fonctionnalité.

---

## 5. Exigences Non-Fonctionnelles

* **Performance :** Latence < 200ms entre la fin d'une réplique TTS et l'écoute STT.
* **Compatibilité Navigateurs :** Chrome, Safari, Firefox, Edge (support complet des API SpeechSynthesis et SpeechRecognition).
* **Accessibilité :** Support des raccourcis clavier (Barre d'espace = Continuer/Valider réplique, Flèche droite = Réplique suivante, Touche S = Souffleur).
* **Mode Offline :** PWA (Progressive Web App) pour une utilisation sans connexion internet au théâtre.

---

## 6. Feuille de Route (Roadmap)

1. **Phase 1 (MVP) :**
   * ✅ Importation / Parsing Fountain — ⬜ JSON (non commencé).
   * ⬜ Player TTS simple avec attribution des voix Web Speech API (non commencé).
   * ⬜ Mode "Italie" (non commencé) — ⚠️ Mode "Partner" (avancement manuel via barre d'outils flottante ; détection vocale voir Phase 2).
2. **Phase 2 :**
   * ✅ Intégration STT (détection de la parole du comédien via Web Speech API, avec avancement automatique optionnel — voir §7.3).
   * ⬜ Mode Masquage progressif et Souffleur (non commencé).
   * ⬜ Export / Sauvegarde des pièces et configurations de voix (non commencé).
3. **Phase 3 :**
   * ⬜ Voix IA haute fidélité (ElevenLabs / Azure Speech) — non commencé.
   * ⬜ Enregistrement audio des répliques de l'utilisateur pour auto-évaluation — non commencé.

---

## 7. État d'Avancement (Implémentation Actuelle)

*Dernière mise à jour : 20 août 2026 — voir [README.md](../README.md) à la racine du
dépôt pour le détail technique complet (architecture, endpoints API, librairies).*

### 7.1 Backend
* ✅ Parseur Fountain complet (délègue à la librairie `screenplain`) : actes, scènes,
  sluglines, dialogues, dual dialogue, transitions, texte centré, sauts de page,
  notes/boneyard.
* ✅ API FastAPI (`POST /api/plays/import/fountain` et `/api/plays/import/fountain/file`)
  retournant le modèle `Play` en JSON.
* ✅ Classification automatique des personnages (`main` / `supporting` / `minor`) selon
  leur part du volume total de dialogue de la pièce.
* ⚠️ **Modèle de données modifié par rapport à la spécification initiale (§4.1)** :
  `Character.id` est un entier séquentiel plutôt qu'une chaîne, et l'objet `voice`
  imbriqué a été remplacé par des champs plats `lang` / `line_count` / `role` —
  l'attribution de voix TTS (§3.2) n'est pas encore implémentée.

### 7.2 Frontend
*(la spécification initiale envisageait React/Vue/Web Component ; l'implémentation
actuelle est en HTML/CSS/JS natif, servie statiquement par FastAPI.)*
* ✅ Import de fichier `.fountain` (upload) avec panneau latéral rétractable et
  redimensionnable.
* ✅ Tableau de bord **Statistiques** : actes, scènes, personnages par rôle, didascalies,
  répliques/lignes de dialogue, décompte de scènes intérieur/extérieur/mixte/inconnu.
* ✅ Tableau **Personnages** (nom, rôle, nombre de lignes, langue) avec filtres par rôle.
* ✅ Tableau **Lieux** (extrait des sluglines `INT.`/`EXT.`) avec compte de scènes par lieu
  — fonctionnalité non prévue dans la spécification initiale.
* ✅ Visualiseur de script formaté (actes, scènes, didascalies, répliques) avec export
  JSON brut consultable.
* ✅ **UC-02 partiellement implémenté** : sélecteur « Mon rôle » dans l'en-tête pour
  choisir le personnage à jouer (l'attribution de voix TTS reste à faire).

### 7.3 Aide à la Répétition (va au-delà du plan initial de Phase 1/2)
* ✅ Mise en évidence des répliques du personnage choisi (surlignage jaune), numérotées
  séquentiellement (1, 2, 3…) **uniquement pour ce personnage** — pas de numérotation
  globale du script.
* ✅ Barre d'outils flottante de navigation (précédent/suivant) entre ses répliques,
  avec défilement et mise en surbrillance automatiques.
* ✅ **Détection vocale (STT)** via l'API Web Speech native du navigateur
  (`SpeechRecognition`), sans bibliothèque externe ni serveur (respecte l'objectif de
  confidentialité/traitement local du §1.2) :
  * Bouton microphone avec retour visuel en temps réel (anneau réactif au volume via
    Web Audio API `AnalyserNode`).
  * Fenêtre flottante déplaçable et redimensionnable affichant la transcription en
    direct (accumulée tant qu'on reste sur la même réplique) et un pourcentage de
    précision (recouvrement de mots normalisé).
  * Correspondance basée uniquement sur les résultats **finalisés** (après une pause),
    pour éviter un avancement prématuré avant la fin de la réplique.
  * Case à cocher « Avancer automatiquement » (décochée par défaut) et bouton
    « Effacer » pour réinitialiser l'affichage sans arrêter l'écoute.
  * Sélecteur de langue de reconnaissance indépendant de la langue du navigateur
    (menu Configuration).
* ⚠️ **Limite navigateur connue** : `SpeechRecognition` est fiable sur Chrome/Edge
  uniquement ; Firefox ne le supporte pas et Safari a un support partiel — ceci
  contredit l'exigence de compatibilité 4-navigateurs du §5 pour cette fonctionnalité
  spécifique.

### 7.4 Non Commencé
* Synthèse vocale (TTS) et attribution de voix par personnage (§3.2).
* Mode « Italienne » (lecture continue automatique), Mode Masquage/Souffleur (§3.3).
* Export/sauvegarde des pièces et configurations.
* Mode Offline / PWA (§5).
* Import JSON personnalisé et texte brut/Markdown (seul Fountain est supporté
  actuellement — UC-01 partiel).

---

## Annexe : Le Format Fountain (Spécification & Exemple)

### A.1 Qu'est-ce que le format Fountain ?
**Fountain** est une syntaxe texte brut balisée (Markdown-like) conçue pour l'écriture et l'échange de scénarios et pièces de théâtre. Il permet d'écrire sans contrainte de formatage lourd, tout en étant facilement analysable par un ordinateur.

### A.2 Règles de Base de la Syntaxe Fountain
* **Titres de Scène :** Commencent par `INT.`, `EXT.`, `ACTE`, `SCÈNE` ou un point `.`.
* **Personnages :** Écrits entièrement en MAJUSCULES, précédés d'une ligne vide.
* **Didascalies / Parenthèses :** Placées entre parenthèses `(...)` juste sous le nom du personnage ou dans le dialogue.
* **Dialogues :** Le texte situé immédiatement sous le nom d'un personnage (ou sous une parenthèse).
* **Section / Structure :** Utilise des dièses `#` pour les actes et `##` pour les scènes.

### A.3 Exemple de Fichier Script Fountain (`cyrano.fountain`)

```fountain
Title: Cyrano de Bergerac
Credit: adapté d'Edmond Rostand
Author: Équipe de Développement
Draft date: 2026-08-18

# ACTE I

## SCÈNE 1

.SALLE DE L'HÔTEL DE BOURGOGNE - NUIT

La salle est sombre, le public murmure avant le début du spectacle.

CHRISTIAN
(apercevant Roxane au loin)
C'est elle ! N'est-ce pas qu'elle est ravissante ?

LE BRET
Elle est charmante, certes. Mais prends garde, Christian.

CHRISTIAN
Je ne sais pas lui parler. Je n'ai pas d'esprit.

# ACTE II

## SCÈNE 2

CYRANO
(pensif, faisant les cent pas)
Un poète est un oiseau qui vole sans se préoccuper des limites.

ROXANE
(souriant)
Et si cet oiseau perdait ses ailes ?

CYRANO
(avec bravoure)
Il chanterait encore en tombant !
```
