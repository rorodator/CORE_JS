# CORE_JS

Bibliothèque JavaScript générique et réutilisable pour les projets web.

## Description

CORE_JS fournit toutes les ressources génériques et réutilisables pour la partie JavaScript des applications web. Elle garantit que la fonction `$svc()` est disponible et que le singleton Core est instancié. Tous les services sont donc disponibles partout via `$svc()`.

## Fonctionnalités principales

- **Services Core** : Système de services centralisé avec `$svc()`
- **Composants HTML** : Base pour les composants personnalisés avec `Core_HTMLElement`
- **Gestion des souscriptions** : Système automatique de nettoyage des souscriptions
- **Routing** : Système de routage pour les SPA
- **Gestion des données** : Repositories, sources de données, filtres
- **Interface utilisateur** : Composants Semantic UI, notifications
- **Utilitaires** : Services de langue, compression, utilitaires généraux

## Installation

Cette bibliothèque est incluse dans les projets via des liens symboliques.

## Utilisation

```javascript
// Accès aux services
const logService = $svc('log');
const langService = $svc('lang');

// Création d'un composant personnalisé
export class MonComposant extends Core_HTMLElement {
    onConnect() {
        // Logique d'initialisation
    }
}
```

## Structure

- `lib/` : Classes de base et utilitaires
- `services/` : Services métier et techniques
- `components/` : Composants UI réutilisables
- `templates/` : Templates Handlebars
- `styles/` : Styles CSS

## Développement

Cette bibliothèque suit les règles de développement du projet MyManager :
- Commentaires en anglais avec style JSDoc
- Noms de variables, classes, fonctions en anglais
- Utilisation obligatoire de `$svc('log')` au lieu de `console.log`
