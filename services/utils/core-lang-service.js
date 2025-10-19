import { BehaviorSubject } from 'rxjs';

export class Core_LangService {
   #currentLang;        // Currently used language
   #data;               // All language mappings, organized by containers
   #notif;              // BehaviorSubject to notify clients of language data changes
   #firstUpdate;        // Tracks if this is the first language update
   #defaultContainer;   // Default container for language labels

   /**
    * Constructs the language service.
    * @param {string} [defaultLang='fr'] The default language to use.
    */
   constructor(defaultLang = 'fr') {
      this.#data = null;
      this.#firstUpdate = true;
      this.#currentLang = defaultLang;
      this.#notif = new BehaviorSubject(this.#data);
      this.#firstUpdate = true;
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
         ).subscribe(
            (response) => {
               // getJSON now returns the API response directly
               // Check the functional status in response.status
               if (response && response.status === 'SUCCESS') {
                  this.#data = response.data.labels;

                  $svc('resource').unlock("api", targetAPI);

                  // Update all registered objects with the new language
                  this.processLangSelected();

                  // Notify all interested clients of the update
                  this.#notif.next(this.#data);
               } else if (response && response.status === 'LANG_ERROR') {
                  // Handle language loading error
                  $svc('resource').unlock("api", targetAPI);
                  
                  // Notify clients of the error
                  this.#notif.next(null);
               } else {
                  // Handle HTTP errors or unexpected response format
                  $svc('resource').unlock("api", targetAPI);
                  this.#notif.next(null);
               }
            }
         );
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
         this.#firstUpdate = false;
      }
   }

   /**
    * Processes language updates for all elements (or a given subtree) with data-core-lang.
    * @param {HTMLElement|null} obj The root element to process (defaults to document.body).
    */
   process(obj = null) {
      if (this.#data) {
         if (obj === null) {
            obj = document.body;
         }

         let targetElements = obj.querySelectorAll('[data-core-lang]');

         // For all elements asking for a lang processing
         targetElements.forEach((elt) => {
            let info = JSON.parse(elt.getAttribute('data-core-lang'));

            if (Array.isArray(info)) {
               info.forEach((val) => {
                  this.processOneElement(elt, val);
               });
            }
            else {
               this.processOneElement(elt, info);
            }
         });
      }
   }

   /**
    * Updates a single element with the appropriate language label.
    * @param {HTMLElement} elt The element to update.
    * @param {Object} info The language info (container, name, attribute).
    */
   processOneElement(elt, info) {
      let theValue = undefined;

      if ((this.#data[info.container])
         && (this.#data[info.container][info.name])) {
         theValue = this.#data[info.container][info.name];
      }
      else {
         if ((this.#data[this.#defaultContainer])
            && (this.#data[this.#defaultContainer][info.name])) {
            theValue = this.#data[this.#defaultContainer][info.name];
         }
      }

      if (!theValue) {
         theValue = '<b>Label not found</b>';
         $svc('log').error('Lang label [' + info.name + '] not found in [' + info.container + ']');
      }
      else {
         // Update an attribute if required, or innerHTML otherwise 
         if (info.attribute) {
            elt.setAttribute(info.attribute, theValue);
         } else {
            elt.innerHTML = theValue;
         }
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