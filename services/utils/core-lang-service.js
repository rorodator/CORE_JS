import { BehaviorSubject } from 'rxjs';

export class Core_LangService {
   #currentLang;        // Currently used language
   #data;               // All language mappings, organized by containers
   #notif;              // BehaviorSubject to notify clients of language data changes
   #defaultContainer;   // Default container for language labels

   /**
    * Constructs the language service.
    * @param {string} [defaultLang='fr'] The default language to use.
    */
   constructor(defaultLang = 'fr') {
      this.#data = null;
      this.#currentLang = defaultLang;
      this.#notif = new BehaviorSubject(this.#data);
      this.#defaultContainer = $svc('default').lang.globalContainer;
   }

   /**
    * Returns the BehaviorSubject for language data.
    * Triggers a load if language data is not yet available.
    * @returns {BehaviorSubject<Object>} Observable emitting language data.
    */
   getData() {
      let targetAPI = $svc('default').lang.api;

      // Prevent multiple simultaneous loads
      if ((this.#data === null)
         && ($svc('resource').lock("api", targetAPI))) {

         // Fetch language data from the source
         $svc('ajax').getJSON(
            targetAPI,
            { lang: this.#currentLang }
         ).subscribe({
            next: (response) => {
               if (response && response.status === 'SUCCESS') {
                  this.#data = response.data.labels;

                  $svc('resource').unlock("api", targetAPI);

                  this.processLangSelected();
                  this.#notif.next(this.#data);
               } else if (response && response.status === 'LANG_ERROR') {
                  $svc('resource').unlock("api", targetAPI);
                  this.#notif.next(null);
               } else {
                  $svc('resource').unlock("api", targetAPI);
                  this.#notif.next(null);
               }
            },
            error: () => {
               $svc('resource').unlock("api", targetAPI);
               this.#notif.next(null);
            }
         });
      }

      return this.#notif;
   }

   /**
    * Called when a new language is selected, to update all registered objects.
    * Triggers a DOM update for all elements using language labels.
    */
   processLangSelected() {
      if (this.#data) {
         this.process();
      }
   }

   /**
    * Processes language updates for all elements (or a given subtree) with data-core-lang.
    * @param {HTMLElement|null} obj The root element to process (defaults to document.body).
    */
   process(obj = null) {
      if (!this.#data) {
         return;
      }

      if (obj === null) {
         obj = document.body;
      }

      obj.querySelectorAll('[data-core-lang]').forEach((elt) => {
         this.#parseLangEntries(elt).forEach((info) => {
            this.processOneElement(elt, info);
         });
      });
   }

   /**
    * Parses and validates data-core-lang attribute entries.
    * @param {HTMLElement} elt
    * @returns {Object[]}
    */
   #parseLangEntries(elt) {
      const raw = elt.getAttribute('data-core-lang');
      if (!raw) {
         return [];
      }

      let parsed;
      try {
         parsed = JSON.parse(raw);
      } catch (e) {
         try {
            $svc('log').error('Invalid data-core-lang JSON', { element: elt, error: e });
         } catch (_) {}
         return [];
      }

      const entries = Array.isArray(parsed) ? parsed : [parsed];
      return entries.filter((info) => this.#isValidLangEntry(info, elt));
   }

   /**
    * @param {unknown} info
    * @param {HTMLElement} elt
    * @returns {boolean}
    */
   #isValidLangEntry(info, elt) {
      if (!info || typeof info !== 'object') {
         try {
            $svc('log').error('Invalid data-core-lang entry (expected object)', { element: elt, info });
         } catch (_) {}
         return false;
      }

      if (!info.container || !info.name) {
         try {
            $svc('log').error('Invalid data-core-lang entry (missing container or name)', { element: elt, info });
         } catch (_) {}
         return false;
      }

      return true;
   }

   /**
    * Resolves the DOM node that should receive a label update.
    * When {@link info.child} is set, the selector is scoped to {@link host} only.
    *
    * @param {HTMLElement} host Element that carries data-core-lang.
    * @param {Object} info Parsed lang entry.
    * @returns {HTMLElement|null}
    */
   #resolveTarget(host, info) {
      if (!info.child) {
         return host;
      }

      if (typeof info.child !== 'string' || !info.child.trim()) {
         try {
            $svc('log').error('Invalid data-core-lang child selector', { element: host, info });
         } catch (_) {}
         return null;
      }

      const match = host.querySelector(info.child.trim());
      if (!match) {
         try {
            $svc('log').error('data-core-lang child not found', {
               element: host,
               selector: info.child,
               info,
            });
         } catch (_) {}
         return null;
      }

      return /** @type {HTMLElement} */ (match);
   }

   /**
    * Updates a single element with the appropriate language label.
    * @param {HTMLElement} elt Host element that carries data-core-lang.
    * @param {Object} info The language info (container, name, child, attribute, rich).
    */
   processOneElement(elt, info) {
      const target = this.#resolveTarget(elt, info);
      if (!target) {
         return;
      }

      let theValue = undefined;

      if ((this.#data[info.container])
         && (this.#data[info.container][info.name])) {
         theValue = this.#data[info.container][info.name];
      }
      else if ((this.#data[this.#defaultContainer])
         && (this.#data[this.#defaultContainer][info.name])) {
         theValue = this.#data[this.#defaultContainer][info.name];
      }

      if (!theValue) {
         theValue = 'Label not found';
         $svc('log').error('Lang label [' + info.name + '] not found in [' + info.container + ']');
      }

      if (info.attribute) {
         target.setAttribute(info.attribute, theValue);
      } else if (info.rich === true) {
         // Opt-in only: author-controlled markup in translation files — never user input.
         target.innerHTML = theValue;
      } else {
         target.textContent = theValue;
      }
   }

   /**
    * Changes the current language and reloads language data if needed.
    * @param {string} lang The new language to use.
    */
   set lang(lang) {
      // Nothing to do if same lang is selected
      if (this.#currentLang !== lang) {
         // Make sure we know which lang was chosen
         this.#currentLang = lang;

         // Required for full reload to be done
         this.#data = null;

         // Ask for the reload
         this.getData();
      }
   }

   /**
    * Gets the current language.
    * @returns {string} The current language code.
    */
   get lang() {
      return this.#currentLang;
   }

   /**
    * Gets a specific label by key (ponctual usage only).
    * For components that need many labels, prefer direct access to the language repository.
    * 
    * Usage patterns:
    * - ✅ Use for notifications: $svc('lang').getLabel('notifications.team_created')
    * - ✅ Use for isolated error messages: $svc('lang').getLabel('errors.team_name_exists')
    * - ❌ Avoid for multiple labels: prefer direct access to this.#data
    * 
    * @param {string} key - The label key (e.g., 'notifications.team_created')
    * @param {Object} params - Optional parameters for interpolation
    * @returns {string} The label value or the key if not found
    */
   getLabel(key, params = {}) {
      if (!this.#data) {
         return key; // Return key if data not loaded yet
      }

      const parts = key.split('.');
      let value = this.#data;
      
      for (const part of parts) {
         if (value && typeof value === 'object' && part in value) {
            value = value[part];
         } else {
            return key; // Return key if not found
         }
      }

      // Handle interpolation if params provided
      if (typeof value === 'string' && Object.keys(params).length > 0) {
         for (const [paramKey, paramValue] of Object.entries(params)) {
            value = value.replace(new RegExp(`{${paramKey}}`, 'g'), paramValue);
         }
      }

      return value;
   }
}