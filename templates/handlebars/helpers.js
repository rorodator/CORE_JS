import Handlebars from "handlebars/runtime";

/**
 * Appelle la méthode processClick sur l'élément cible.
 * Usage : {{buttonClick targetElement}}
 */
Handlebars.registerHelper('buttonClick', function (targetElement) {
   return targetElement.processClick();
});

/**
 * Met en majuscules une chaîne de caractères.
 * Usage : {{upperCase text}}
 */
Handlebars.registerHelper('upperCase', function (text) {
   return text.toUpperCase();
});

/**
 * Retourne value si non null, sinon fallback.
 * Usage : {{coalesce value fallback}}
 */
Handlebars.registerHelper('coalesce', function (value, fallback) {
   return (value !== null) ? value : fallback;
});

/**
 * Teste si un objet possède une propriété donnée.
 * Bloc if/else.
 * Usage : {{#hasProperty obj "prop"}}...{{else}}...{{/hasProperty}}
 */
Handlebars.registerHelper('hasProperty', function (obj, prop, options) {
   if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      return options.fn(this);
   } else {
      return options.inverse(this);
   }
});

/**
 * Teste si un élément DOM possède un attribut donné.
 * Bloc if/else.
 * Usage : {{#hasAttribute element "attr"}}...{{else}}...{{/hasAttribute}}
 */
Handlebars.registerHelper('hasAttribute', function (element, attrName, options) {
   if (element.hasAttribute(attrName)) {
      return options.fn(this);
   } else {
      return options.inverse(this);
   }
});

/**
 * Récupère la valeur d'un attribut sur un élément DOM.
 * Usage : {{getAttribute element "attr"}}
 */
Handlebars.registerHelper('getAttribute', function (element, attrName) {
   return element.getAttribute(attrName);
});

/**
 * Compare deux valeurs avec un opérateur donné.
 * Bloc if/else.
 * Usage : {{#compare v1 '==' v2}}...{{else}}...{{/compare}}
 */
Handlebars.registerHelper('compare', function (v1, operator, v2, options) {
   switch (operator) {
      case '==':
         return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
         return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
         return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
         return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
         return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
         return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
         return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
         return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      default:
         return options.inverse(this);
   }
});

/**
 * Génère un attribut data-core-lang pour l'internationalisation.
 * Usage : {{lang context "labelName" "containerName"}}
 */
Handlebars.registerHelper('lang', function (context, labelName, containerName, options) {
   // Compute the container name where to get the lang info
   let targetContainer = (typeof containerName === 'object') ? context.langContainer : containerName;

   return new Handlebars.SafeString("data-core-lang='{\"name\":\"" + labelName + "\",\"container\":\"" + targetContainer + "\"}'");
});

/**
 * Génère un attribut data-core-lang pour une propriété spécifique (i18n).
 * Usage : {{langAttribute context "labelName" "attributeName" "containerName"}}
 */
Handlebars.registerHelper('langAttribute', function (context, labelName, attributeName, containerName, options) {
   // Compute the container name where to get the lang info
   let targetContainer = (typeof containerName === 'object') ? context.langContainer : containerName;

   return new Handlebars.SafeString("data-core-lang='{\"name\":\"" + labelName + "\",\"attribute\":\"" + attributeName + "\",\"container\":\"" + targetContainer + "\"}'");
});

/**
 * Formate un nom en chaîne avec un nombre de décimales donné.
 * Usage : {{toFixed number decimals}}
 */
Handlebars.registerHelper('toFixed', function (number, decimals) {
   if (typeof number !== 'number') return '';
   return number.toFixed(decimals || 2);
});

/**
 * Retourne le nombre de propriétés d'un objet.
 * Usage : {{countObjectProperties obj}}
 */
Handlebars.registerHelper('countObjectProperties', function (obj) {
   return Object.keys(obj).length;
});

/**
 * Récupère dynamiquement la valeur d'une propriété d'un objet.
 * Usage : {{getProperty obj "propertyName"}}
 */
Handlebars.registerHelper('getProperty', function (obj, propertyName) {
   return obj[propertyName];
});