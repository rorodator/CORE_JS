import { Subject } from "rxjs";

/**
 * Everything that is required to handle data filtering, managing purely data loaded in the browser memory.
 * This DataSource can be sourced from a core_DataReposity or from another Core_BrowserDataSource (kind of datasource waterfall)
 */
export class Core_BrowserDataSource {

   /**
    * When data is updated, know if the update is partial or complete
    */
   static viewUpdateMode = {
      FULL: 1,
      DELTA: 2
   };

   // Name of the data source (useful for logging/debugging)
   #name;
   // Name of the primary key property for each data line
   #primaryKey;
   // Reference data map (source of truth, never filtered)
   #refDataMap;
   // Current filtered view (Map: primaryKey -> line)
   #dataMap;
   // Any specific data computed alongside the view (ex: aggregates)
   #specificData;

   // All filter definitions (Map: filterName -> filter instance)
   #filterDef;
   // Map of currently active filters (filterName -> filter instance)
   #activeFiltersMap;
   // Array of active filter instances (for quick iteration)
   #activeFilters;

   // Subject to notify listeners of data updates
   #notif_dataUpdated;

   // Parameters for the DataSource (object)
   #params;

   /**
    * Constructs a new DataSource.
    * @param {Object} refDataObject - The referential parent data map (e.g., a Core_DataRepository or another Core_BrowserDataSource).
    * @param {Object} [params=null] - Optional parameters for the DataSource.
    */
   constructor(refDataObject, params = null) {
      this.#primaryKey = refDataObject.primaryKey;
      this.#refDataMap = refDataObject.dataMap;
      this.#params = { ...this.getDefaultParams(), ...params };
      this.#name = (this.#params.sourceName) ?? 'default';
      this.#dataMap = new Map();
      this.#specificData = {};
      this.#filterDef = new Map();
      this.#activeFiltersMap = new Map();
      this.#activeFilters = [];
      this.#notif_dataUpdated = new Subject(null);
   }

   /**
    * Returns the default parameters for DataSource creation.
    * @returns {Object} The default parameters.
    */
   getDefaultParams() {
      return {
         updateViewWhenOnFilterChange: false
      };
   }

   //---------------------
   // FILTER MANAGEMENT --
   //---------------------

   /**
    * Registers a filter for this DataSource.
    * @param {string} filterName - The name of the filter.
    * @param {string} filterType - The type of the filter, must be known by the filterFactory service.
    * @param {object} filterParams - The parameters for the filter ({} if none).
    * @param {any} filterValue - The initial/default value of the filter.
    * @returns {Core_BrowserDataSource} This instance (for chaining).
    */
   addFilter(filterName, filterType, filterParams = {}) {
      if (this.#filterDef.has(filterName)) {
         $svc('log').error('Cannot add twice filter [' + filterName + '] to DataSource');
      } else {
         let filterClass = $svc('filterFactory').get(filterType);

         if (!filterClass) {
            $svc('log').fatalError('Can\'t find filterType [' + filterType + ']');
         } else {
            filterParams['columnKey'] = (filterParams['columnKey']) ?? filterName;
            let theFilter = new filterClass(filterParams);
            this.#filterDef.set(filterName, theFilter);
         }
      }
      return this;
   }

   /**
    * Updates the values of filters and manages their activation.
    * Triggers a view update if needed.
    * @param {Object} filterValues - An object mapping filter names to their values.
    */
   updateFilterValues(filterValues) {
      // First update all filter values and decide whether they are active or not
      for (const [filterName, filterValue] of Object.entries(filterValues)) {
         const targetFilter = this.#filterDef.get(filterName);

         if (targetFilter) {
            if (targetFilter.activeOrNot(filterValue)) {
               this.#activeFiltersMap.set(filterName, targetFilter);
            } else {
               this.#activeFiltersMap.delete(filterName);
            }
         } else {
            $svc('log').error(`Filter [${filterName}] does not exist in DataSource [${this.#name}]`);
         }
      }

      // Save all active filters in a dedicated array
      this.#activeFilters = Array.from(this.#activeFiltersMap.values());

      // Sometimes, this may imply an update of the view
      if (this.#params.updateViewWhenOnFilterChange && this.#refDataMap.size > 0) {
         this.refreshData();
      }
   }

   /**
    * Returns the current filter values for this DataSource.
    * @returns {Object} An object mapping filter names to their current values.
    */
   getFilterValues() {
      let filterValues = {};

      for (const [filterName, filter] of this.#activeFiltersMap) {
         filterValues[filterName] = filter.value;
      }

      return filterValues;
   }

   /**
    * Updates the data in the DataSource based on the provided update object.
    * Notifies listeners of added, updated, and deleted lines.
    * @param {Object} updateObject - Object containing arrays: addedLines, updatedLines, deletedLines.
    */
   updateData(updateObject) {
      let addedLines = [];
      let deletedLines = [];
      let updatedLines = [];

      // Deleted lines
      if (updateObject.deletedLines) {
         updateObject.deletedLines.forEach((line) => {
            if (this.#dataMap.has(line[this.#primaryKey])) {
               deletedLines.push(line);
               this.removeLineFromView(line);
            }
         });
      }

      // Added lines
      if (updateObject.addedLines) {
         updateObject.addedLines.forEach((line) => {
            if (this.testLine(line)) {
               addedLines.push(line);
               this.addLineToView(line);
            }
         });
      }

      // Updated lines
      if (updateObject.updatedLines) {
         updateObject.updatedLines.forEach((line) => {
            const lineInView = this.testLine(line);
            const hasInView = this.#dataMap.has(line[this.#primaryKey]);

            if (lineInView) {
               if (hasInView) {
                  updatedLines.push(line);
                  this.updateLineInView(line);
               } else {
                  addedLines.push(line);
                  this.addLineToView(line);
               }
            } else if (hasInView) {
               deletedLines.push(line);
               this.removeLineFromView(line);
            }
         });
      }

      // Notify clients
      this.triggerDataUpdated(
         Core_BrowserDataSource.viewUpdateMode.DELTA,
         addedLines,
         updatedLines,
         deletedLines
      );
   }

   /**
    * Completely recomputes the view from the reference data.
    */
   refreshData() {
      let addedLines = [];
      let updatedLines = [];

      const targetArray = Array.from(this.#refDataMap.values());

      targetArray.forEach((line) => {
         if (this.#dataMap.has(line.id)) {
            updatedLines.push(line);
         } else {
            addedLines.push(line);
         }
      });

      this.updateData({
         updatedLines: updatedLines,
         addedLines: addedLines
      });
   }

   /**
    * Called before a global refresh of data.
    * Can be overridden by subclasses for custom cleanup.
    */
   beforeRefreshData() {
      this.#dataMap.clear();
   }

   /**
    * Tests a line against all active filters.
    * @param {Object} line - The data line to test.
    * @returns {boolean} True if the line passes all filters, false otherwise.
    */
   testLine(line) {
      let addLine = true;

      this.#activeFilters.some((filter) => {
         if (!(addLine = filter.test(line))) {
            return true;
         }
         return false;
      });

      return addLine;
   }

   /**
    * Adds a line to the view using its primary key.
    * Can be overridden for custom processing.
    * @param {Object} line - The data line to add.
    */
   addLineToView(line) {
      this.#dataMap.set(line[this.#primaryKey], line);
   }

   /**
    * Updates a line in the view using its primary key.
    * Can be overridden for custom processing.
    * @param {Object} line - The data line to update.
    */
   updateLineInView(line) {
      this.#dataMap.set(line[this.#primaryKey], line);
   }

   /**
    * Removes a line from the view using its primary key.
    * Can be overridden for custom processing.
    * @param {Object} line - The data line to remove.
    */
   removeLineFromView(line) {
      this.#dataMap.delete(line[this.#primaryKey]);
   }

   /**
    * Notifies listeners that the view was updated.
    * @param {number} updateMode - The update mode (FULL or DELTA).
    * @param {Array} addedLines - Lines added to the view.
    * @param {Array} updatedLines - Lines updated in the view.
    * @param {Array} deletedLines - Lines removed from the view.
    */
   triggerDataUpdated(updateMode, addedLines = [], updatedLines = [], deletedLines = []) {
      if ((updateMode === Core_BrowserDataSource.viewUpdateMode.FULL)
         || ((addedLines.length + updatedLines.length + deletedLines.length) > 0)) {

         this.#notif_dataUpdated.next({
            specificData: this.#specificData,
            addedLines: addedLines,
            updatedLines: updatedLines,
            deletedLines: deletedLines,
            data: this.#dataMap,
            updateMode: updateMode
         });
      }
   }

   /**
    * Returns the Subject to subscribe to data updates.
    * @returns {Subject} The subject emitting data update notifications.
    */
   onDataUpdated() {
      return this.#notif_dataUpdated;
   }

   //-------------
   // ACCESSORS --
   //-------------

   /**
    * Returns the computed view as a Map.
    * @returns {Map} The data map.
    */
   get dataMap() {
      return this.#dataMap;
   }

   /**
    * Returns the computed view as an array.
    * @returns {Array} The data array.
    */
   get data() {
      return Array.from(this.#dataMap.values());
   }

   /**
    * Returns the primary key used for data lines.
    * @returns {string} The primary key.
    */
   get primaryKey() {
      return this.#primaryKey;
   }

   /**
    * Returns any specific data computed alongside the view.
    * @returns {Object} The specific data object.
    */
   get specificData() {
      return this.#specificData;
   }

   /**
    * Returns the name of the data source.
    * @returns {string} The name.
    */
   get name() {
      return this.#name;
   }

   /**
    * Returns the number of rows in the current view.
    * @returns {number} The row count.
    */
   get rowCount() {
      return this.#dataMap.size;
   }
}