# CORE_JS

Bibliothèque JavaScript générique et réutilisable pour les applications web basées sur CORE.

## Description

CORE_JS fournit les primitives browser partagées : registre `$svc()`, classes de base pour custom elements, routing SPA, transport HTTP générique, i18n hooks, et utilitaires DOM. Les applications consommatrices (MyJourney, etc.) enregistrent leurs services métier dans une sous-classe de `Core`.

## Services plateforme (kernel)

Enregistrés par `Core.registerAllServices()` — les apps opt-in via `registerService()` dans leur bootstrap :

| Service | Rôle |
|---------|------|
| `log` | Journalisation centralisée |
| `ajax` | Transport HTTP générique (`Core_AjaxService`) |
| `router` | Navigation SPA et interception de liens |
| `resource` | Verrous de ressources partagées (ex. API lang) |
| `config` | Base URL, routes relatives, environnement |
| `default` | Constantes plateforme par défaut |
| `lang` | Labels i18n via API |
| `browser` | Utilitaires scroll/CSS document (utilisé par le router) |
| `dom` | Helpers DOM (`createElement`, `mountTrustedHtml`, …) |

Services applicatifs (ex. `AppAjaxService.callAPI`, `user`, `journeys`) vivent dans le repo consommateur — voir `ai-instructions/services.md`.

## Utilisation

```javascript
// Accès aux services après bootstrap
const logService = $svc('log');
const langService = $svc('lang');
const dom = $svc('dom');

// DOM helpers (also importable as ES module)
import { createElement, mountTrustedHtml, hasBoolAttr } from 'CORE_JS/lib/utils/dom.js';

dom.createElement('button', { text: 'Save', attrs: { type: 'button' } });
// mountTrustedHtml / options.trustedHtml: author-controlled markup only — never user input
```

## Structure

- `lib/` — Classes de base (`Core_HTMLElement`, `Core_HBSElement`), router, utilitaires (`dom.js`, subscription manager)
- `services/` — Services plateforme (`log`, `ajax`, `router`, `lang`, `dom`, …)
- `templates/` — Helpers Handlebars partagés
- `styles/` — CSS utilitaires génériques (`globals.css`)

## Développement

- Commentaires en anglais (JSDoc)
- Identifiants en anglais
- `$svc('log')` obligatoire — pas de `console.log`

Voir `ai-instructions/` et `.cursor/rules/` pour les conventions détaillées.
