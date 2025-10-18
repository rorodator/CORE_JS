import { Subject } from "rxjs";

/**
 * A small interface that may be used to handle a bunch of filters.
 * Typically, it may be used to aggregate all filters to be sent to a BrowserDataSource
 * and notify clients when any filter is updated.
 */
export class Core_FilterManager {

   #filters;            // All registered filters (Map: filterName -> filter descriptor)
   #filterUpdatedNotif; // Subject to notify listeners when a filter value is updated
   #inSetFilterValues;  // To block automatic updates when filter values are forced from the outside 

   /**
    * Constructor.
    */
   constructor() {
      this.#filters = new Map();
      this.#filterUpdatedNotif = new Subject();
      this.#inSetFilterValues = false;
   }

   /**
    * Registers a new filter to the manager.
    * @param {string} filterName - The unique name of the filter.
    * @param {HTMLElement} filterElement - The DOM element (input, select, etc.) for the filter.
    * @param {function|null} getValueClbk - Optional callback to get the value from the element.
    * @param {function|null} setValueClbk - Optional callback to set the value on the element.
    */
   addFilter(filterName, filterElement, getValueClbk = null, setValueClbk = null) {
      if (this.#filters.has(filterName)) {
         $svc('log').error(`Cannot add twice the same filter [${filterName}] in Core_FilterManager`);
      } else {
         this.#filters.set(filterName, {
            element: filterElement,
            getValueClbk: getValueClbk,
            setValueClbk: setValueClbk,
            value: ''
         });

         // Listen for value changes on the filter element
         filterElement.addEventListener('change', (evt) => {
            if (this.#inSetFilterValues === false) {
               // Notify all listeners with the new filter values
               this.#filterUpdatedNotif.next(this.getAllValues());
            }
         });
      }
   }

   /**
    * Removes a filter from the manager.
    * @param {string} filterName - The name of the filter to remove.
    */
   removeFilter(filterName) {
      if (!this.#filters.has(filterName)) {
         $svc('log').error(`Cannot remove filter [${filterName}] because it does not exist in Core_FilterManager`);
         return;
      }
      this.#filters.delete(filterName);
   }

   /**
    * Updates all filter values at once.
    * @param {Object} filterValues - Object mapping filter names to their new values.
    * @param {boolean} [triggerChange=false] - Whether to notify listeners after setting values.
    */
   setFilterValues(filterValues, triggerChange = false) {
      this.#inSetFilterValues = true;

      for (const [filterName, filterDesc] of this.#filters) {
         if (filterDesc.setValueClbk) {
            filterDesc.setValueClbk(filterDesc.element, (filterValues[filterName]) ?? '');
         } else {
            filterDesc.element.value = (filterValues[filterName]) ?? '';
         }
      }

      if (triggerChange) {
         this.#filterUpdatedNotif.next(this.getAllValues());
      }

      this.#inSetFilterValues = false;
   }

   /**
    * Removes all filters from the manager.
    */
   clearFilters() {
      this.#filters.clear();
   }

   /**
    * Resets all filters to empty string and notifies listeners.
    */
   emptyFilters() {
      for (const [filterName, filterDesc] of this.#filters) {
         if (filterDesc.setValueClbk) {
            filterDesc.setValueClbk(filterDesc.element, '');
         } else {
            filterDesc.element.value = '';
         }
      }
      this.#filterUpdatedNotif.next(this.getAllValues());
   }

   /**
    * Returns the Subject to subscribe to filter updates.
    * @returns {Subject} The subject emitting filter value changes.
    */
   onFiltersUpdated() {
      return this.#filterUpdatedNotif;
   }

   /**
    * Gets all current filter name/value pairs.
    * @returns {Object} An object mapping filter names to their current values.
    */
   getAllValues() {
      let filterValues = {};

      for (const [filterName, filterDesc] of this.#filters) {
         filterValues[filterName] = (filterDesc.getValueClbk)
            ? filterDesc.getValueClbk(filterDesc.element)
            : filterDesc.element.value;
      }

      return filterValues;
   }
}