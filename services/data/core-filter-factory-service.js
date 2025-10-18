import { Core_IntFilter } from "../../lib/data/filters/core-int-filter";   
import { Core_StringFilter } from "../../lib/data/filters/core-string-filter";

export class Core_FilterFactoryService {
   #factory;   // Map of filter type names to their constructors

   /**
    * Constructs the filter factory and registers default filters.
    */
   constructor() {
      // Initialize the factory map
      this.#factory = new Map();

      // Register default filters
      this.registerFilter('string', Core_StringFilter);
      this.registerFilter('int', Core_IntFilter);
   }

   /**
    * Registers a new type of filter that can be instantiated dynamically.
    * @param {string} filterType - The type/name of the filter.
    * @param {Function} filterConstructor - The class/constructor for the filter.
    */
   registerFilter(filterType, filterConstructor) {
      this.#factory.set(filterType, filterConstructor);
   }

   /**
    * Gets the constructor of a filter based on its type.
    * @param {string} filterType - The type of the filter.
    * @returns {Function|null} The constructor of the filter, or null if not found.
    */
   get(filterType) {
      return this.#factory.get(filterType) || null;
   }

   /**
    * Creates an instance of a filter based on its type and constructor arguments.
    * @param {string} filterType - The type of the filter.
    * @param  {...any} args - Arguments to pass to the filter constructor.
    * @returns {object|null} The filter instance, or null if not found.
    */
   create(filterType, ...args) {
      const FilterConstructor = this.get(filterType);
      return FilterConstructor ? new FilterConstructor(...args) : null;
   }
}