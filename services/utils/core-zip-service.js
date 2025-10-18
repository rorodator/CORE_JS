/**
 * Service to avoid redundancy in labels stored in RAM. 
 * Handles multiple contexts and data types for efficient label <-> id mapping.
 */
export class Core_ZipService {
   #contexts; // Stores all possible contexts

   /**
    * Constructs the zip service and initializes the context map.
    */
   constructor() {
      this.#contexts = new Map();
   }

   /**
    * Initializes a new context with given parameters.
    * @param {string} contextName The name of the context.
    * @param {Array} contextParams The configuration parameters for the context.
    * @returns {Object} The created context object.
    */
   initContext(contextName, contextParams) {
      if (this.#contexts.has(contextName)) {
         $svc('log').error('Cannot create twice the same context [' + contextName + '] in core-zip-service');
      } else {
         this.#contexts.set(contextName, {
            params: contextParams,
            dataTypes: new Map()
         });
      }
      return this.#contexts.get(contextName);
   }

   /**
    * Resets (removes) a context and all its data.
    * @param {string} contextName The name of the context to reset.
    * @returns {boolean} True if the context was removed, false otherwise.
    */
   resetContext(contextName) {
      return this.#contexts.delete(contextName);
   }

   /**
    * Patches a whole line based on the context parameters, replacing labels with ids.
    * @param {Object} context The context object.
    * @param {Object} line The data line to process.
    */
   processLine(context, line) {
      context.params.forEach((def) => {
         if (def.dataTypeKey) {
            line[def.dataTypeKey] = this.createIdForLabel(context, def.column, line, def.column, def.dataTypeKey);
         } else {
            line[def.column] = this.createIdForLabel(context, def.column, line, def.column);
         }
      });
   }

   /**
    * In a given context, get the id matching a given string. Creates a new one if not registered yet.
    * @param {Object} currentContext The context object.
    * @param {string} dataType The data type key.
    * @param {Object} data The data object containing the label.
    * @param {string} labelKey The key in the data object for the label.
    * @param {string|null} idKey Optional key for a custom id in the data object.
    * @returns {number|string} The id for the label.
    */
   createIdForLabel(currentContext, dataType, data, labelKey, idKey = null) {
      // Ensure the dataType exists in the context
      if (!currentContext.dataTypes.has(dataType)) {
         currentContext.dataTypes.set(dataType, {
            idToLabel: new Map(),
            labelToId: new Map()
         });
      }

      // Get current data type from the context
      const currentDataType = currentContext.dataTypes.get(dataType);

      // If label never met yet, put it into the proper maps
      if (!currentDataType.labelToId.has(data[labelKey])) {
         const nextId = (idKey) ? data[idKey] : (currentDataType.labelToId.size + 1);
         currentDataType.labelToId.set(data[labelKey], nextId);
         currentDataType.idToLabel.set(nextId, data[labelKey]);
      }

      return currentDataType.labelToId.get(data[labelKey]);
   }

   /**
    * Returns the id-to-label Map for a given context and dataType.
    * @param {Object} context The context object.
    * @param {string} dataType The data type key.
    * @returns {Map|null} The id-to-label map, or null if not found.
    */
   getLabelMapForDataType(context, dataType) {
      return context?.dataTypes?.get(dataType)?.idToLabel || null;
   }

   /**
    * Gets an id from a label in the proper context/dataType.
    * @param {Object} context The context object.
    * @param {string} dataType The data type key.
    * @param {string} label The label to look up.
    * @returns {number|string|null} The id, or null if not found.
    */
   getIdFromLabel(context, dataType, label) {
      return context?.dataTypes?.get(dataType)?.labelToId?.get(label) ?? null;
   }

   /**
    * Gets a label from an id in the proper context/dataType.
    * @param {Object} context The context object.
    * @param {string} dataType The data type key.
    * @param {number|string} id The id to look up.
    * @returns {string|null} The label, or null if not found.
    */
   getLabelFromId(context, dataType, id) {
      return context?.dataTypes?.get(dataType)?.idToLabel?.get(parseInt(id)) ?? null;
   }
}
