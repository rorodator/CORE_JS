import { Subject } from 'rxjs';

/**
 * Core class to store a bunch of data locally on the browser.
 * Mainly designed to serve as a store for Core_BrowserDataSource.
 */
export class Core_DataRepository {
   // Stored data, in a map (primaryKey -> line)
   #dataMap;
   // Key to use to store the data, must be found in the data feed
   #primaryKey;
   // If data provided must be zipped when being stored (context object or null)
   #zipContext;
   // Subject to notify listeners when data is updated
   #notif_dataUpdated;

   /**
    * Basic constructor
    * @param {string} primaryKey - The property name to use as the primary key for each data line.
    */
   constructor(primaryKey) {
      this.#zipContext = null;
      this.#primaryKey = primaryKey;
      this.#dataMap = new Map();
      this.#notif_dataUpdated = new Subject();
   }

   /**
    * Adds or updates a bunch of data in the current repo.
    * Notifies listeners of added and updated lines.
    * @param {Array<Object>} data - Array of data lines to add or update.
    */
   updateDataArray(data) {
      if (!Array.isArray(data)) {
         $svc('log').error('Incorrect data type in Core_DataRepository::updateDataArray > Nothing done');
      } else {
         let addedLines = [];
         let updatedLines = [];

         data.forEach((line) => {
            const pk = this.computePrimaryKey(line);

            if (!pk) {
               $svc('log').error('Missing primary key in line, skipping:', line);
               return;
            }

            this.zipLine(line);

            if (this.#dataMap.has(pk)) {
               updatedLines.push(line);
            } else {
               addedLines.push(line);
            }

            this.#dataMap.set(pk, line);
         });

         this.#notif_dataUpdated.next({
            addedLines: addedLines,
            updatedLines: updatedLines,
            deletedLines: []
         });
      }
   }

   /**
    * Removes lines from the repo by their primary key values.
    * Notifies listeners of deleted lines.
    * @param {Array<string|number>} keys - Array of primary key values to remove.
    */
   removeDataByKeys(keys) {
      if (!Array.isArray(keys)) {
         $svc('log').error('Incorrect keys type in Core_DataRepository::removeDataByKeys > Nothing done');
         return;
      }
      let deletedLines = [];
      keys.forEach(pk => {
         if (this.#dataMap.has(pk)) {
            deletedLines.push(this.#dataMap.get(pk));
            this.#dataMap.delete(pk);
         }
      });
      if (deletedLines.length > 0) {
         this.#notif_dataUpdated.next({
            addedLines: [],
            updatedLines: [],
            deletedLines: deletedLines
         });
      }
   }

   /**
    * Removes all data from the repository and notifies listeners.
    */
   reset() {
      const deletedLines = Array.from(this.#dataMap.values());
      this.#dataMap.clear();
      if (deletedLines.length > 0) {
         this.#notif_dataUpdated.next({
            addedLines: [],
            updatedLines: [],
            deletedLines: deletedLines
         });
      }
   }

   /**
    * If data to be stored here must be "zipped" before being put into the repo.
    * @param {Object} line - The data line to zip.
    */
   zipLine(line) {
      if (this.#zipContext) {
         $svc('zip').processLine(this.#zipContext, line);
      }
   }

   /**
    * Computes the primary key for a given data line.
    * @param {Object} data - The data line.
    * @returns {string|number|null} The primary key value, or null if not found.
    */
   computePrimaryKey(data) {
      if (this.#primaryKey) {
         return data[this.#primaryKey];
      }
      return null;
   }

   /**
    * For clients to know when data are updated.
    * @returns {Subject} The subject emitting data update notifications.
    */
   onDataUpdated() {
      return this.#notif_dataUpdated;
   }

   //-------------
   // ACCESSORS --
   //-------------

   /**
    * To attach this data repo to a Zip Context for memory management.
    * @param {Object} zipContext - The zip context to use.
    */
   set zipContext(zipContext) {
      this.#zipContext = zipContext;
   }

   /**
    * If a client wants to access the complete data map.
    * @returns {Map} The internal data map.
    */
   get dataMap() {
      return this.#dataMap;
   }

   /**
    * If a client wants to access the complete data as an Array.
    * @returns {Array<Object>} The data as an array.
    */
   get data() {
      return Array.from(this.#dataMap.values());
   }

   /**
    * Returns the primary key property name.
    * @returns {string} The primary key.
    */
   get primaryKey() {
      return this.#primaryKey;
   }
}