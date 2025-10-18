import { Core_SubscriptionManager } from "../utils/core-subscription-manager";
import { Subject, BehaviorSubject } from "rxjs";

/**
 * The root class to use to manipulate DataSource and serve rendering objects.
 * Depending on the back-end info, this class may implement filtering/sorts/pagination at full
 * browser level or rely on back-end methods
 */
export class Core_DataSource {

   static viewMode = {
      api: 1,
      browser: 2
   };

   static dataUpdateMode = {
      FULL: 1,
      DELTA_ADD: 2,
      DELTA_REMOVE: 3
   };

   static onContextSelectedMode = {
      DO_NOTHING: 1,
      COMPUTE_VIEW: 2,
      SORT_VIEW: 3,
      REFRESH_VIEW: 4
   };

   #primaryKey;      // The column to use to access listed object primary keys
   #params;          // All parameters for this DataSource
   #data;            // The full data to display in a Map
   #dataArray;       // The full data to display in an Array

   #contexts;        // Generally, only one context. Contains view, filter values, sort to apply, currentPage, nbPages
   #activeContext;   // The context currently usede
   #filterDef;       // The definition of filters for this DataSource ( to be applied to all Contexts )

   #viewUpdated;     // The notification object to subscribe to know that data to display changed
   #contextUpdated;  // The notification object to subscribe to know that a context was updated

   #subManager;   // To properly manage subscriptions to Observables

   /**
    * Standard constructor, doing a lot
    * @param {*} pageSize - the number of items in page in case of 'pagination', -1 is no pagination required 
    */
   constructor(primaryKey, params) {

      // Init the primary Key
      this.#primaryKey = primaryKey;

      // Init the params for this DataSource
      this.#params = { ...this.getDefaultParams(), ...params };

      // At this stage, nothing was loaded yet
      this.#data = null;
      this.#dataArray = null;

      // And no filter created
      this.#filterDef = new Map();

      // By default, there is always at least one context, called main
      this.#activeContext = null;
      this.#contexts = new Map();

      if (this.#params.createDefaultContext) {
         this.addContext('main');
      }

      // Initialize the notif used to communicate with clients. null value is there to say
      // that nothing has been done so far
      this.#viewUpdated = new BehaviorSubject(null);
      this.#contextUpdated = new Subject();

      // Object needed to properly handle subscription desturctions
      this.#subManager = new Core_SubscriptionManager(this);
   }

   /**
    * Default parameters for DataSource creation
    * @returns
    */
   getDefaultParams() {
      // Define default parameters for DataSource
      return {
         sourceName: 'Default',
         mode: null,
         updateViewWhenOnFilterChange: false,
         pageSize: null,
         createDefaultContext: true,
         refreshContextOnSelect: Core_DataSource.onContextSelectedMode.DO_NOTHING
      };
   }

   /**
    * CONTEXT MANAGEMENT
    */
   addContext(contextName, contextParams = {}) {
      // Create a new Context
      const newContext = { ...this.getDefaultContextParams(), ...contextParams };
      newContext.name = contextName;

      this.#contexts.set(contextName, newContext);

      // By default, the first context created is the active one
      if (this.#contexts.size === 1) {
         this.#activeContext = newContext;
         newContext.isActive = true;
      }
   }

   /**
    * A context may be rmoved, we delete it to spare memory
    * @param {} contextName 
    */
   removeContext(contextName) {
      this.#contexts.delete(contextName);
   }

   /**
    * To change the current context
    * @param {} contextName 
    */
   setActiveContext(contextName) {
      if (!this.#contexts.has(contextName)) {
         $svc('log').error('Cannot select [' + contextName + '] in Core_DataSource');
      } else {

         $svc('log').timeStamp('setActiveContext IN : ' + this.#params.sourceName + ', ' + this.#params.onContextSelectedMode);

         // Properly select the current active context
         this.#activeContext.isActive = false;
         this.#activeContext = this.#contexts.get(contextName);
         this.#activeContext.isActive = true;

         // May be compute and sort the data at once
         if (this.#params.onContextSelectedMode === Core_DataSource.onContextSelectedMode.COMPUTE_VIEW) {
            this.computeContextView(this.#activeContext);
         }
         else if (this.#params.onContextSelectedMode === Core_DataSource.onContextSelectedMode.SORT_VIEW) {
            this.sort(Array.from(this.#activeContext.view.values()));
         }

         if (this.#params.onContextSelectedMode !== Core_DataSource.onContextSelectedMode.DO_NOTHING
            && this.#params.onContextSelectedMode !== Core_DataSource.onContextSelectedMode.COMPUTE_VIEW) {
            this.triggerViewUpdatedNotif();
            this.triggerContextUpdated(this.#activeContext);
         }

         $svc('log').timeStamp('setActiveContext OUT : ' + this.#params.sourceName);
      }
   }

   /**
    * To default parameters for a new context to be added
    * @returns
    */
   getDefaultContextParams() {
      return {
         isActive: false,
         filterValues: {},
         view: new Map(),
         sort: '',
         currentPage: 0,
         nbPages: 0
      };
   }

   /**
    * FILTER MANAGEMENT
    */

   /**
    * Make a filter available for this DataSource
    * @param {string} filterName - the name of the Filter
    * @param {string} filterType - the type of the Filter, must be known by service filterFactory
    * @param {object} filterParams - the params for the Filter, {} if none 
    * @param {any} filterValue - the initial/default value of the filter
    * @returns this to allow chained calls 
    */
   addFilter(filterName, filterType, filterParams = {}) {
      // Cannot register twice the same filter
      if (this.#filterDef.has(filterName)) {
         $svc('log').error('Cannot add twice filter [' + filterName + '] to DataSource');
      }
      else {
         // The type of the filter must be known by the filter factory
         let filterClass = $svc('filterFactory').get(filterType);

         if (!filterClass) {
            $svc('log').fatalError('Can\'t find filterType [' + filterType + ']');
         }
         // At this stage is everything is fine, we can register the filter
         else {
            filterParams['columnKey'] = (filterParams['columnKey']) ?? filterName;
            let theFilter = new filterClass(filterParams);

            this.#filterDef.set(filterName, theFilter);
         }
      }
   }

   /**
    * 
    * @param {*} contextName 
    * @param {*} filterValues 
    */
   updateContextFilters(filterValues) {
      if (!this.#activeContext) {
         $svc('log').error('No active filter found in data source for filter update.');
      }
      else {
         // Overwrite current filters with new ones
         this.#activeContext.filterValues = { ...this.#activeContext, ...filterValues };

         // Sometimes, this may imply an update of the view
         if (this.#params.updateViewWhenOnFilterChange) {
            this.computeContextView(this.#activeContext);
         }
      }
   }

   /**
    * Totally recompute the view for a given Context
    */
   computeContextView(context) {

      // Rebuild the view from scratch
      context.view.clear();

      // For child classes to implement potential specific behaviors
      if (context == this.#activeContext) {
         this.beforeComputeView(context);
      }

      // Decide which filters to use, and set values to test for what lays below
      const activeFilters = this.computeActiveFiltersForContext(context);

      // First compute the full view by applying filters
      if (this.#dataArray) {
         this.#dataArray.forEach((currentLine, index, arr) => {
            if (this.testLine(currentLine, activeFilters)) {
               this.addLineToView(context, currentLine);
            }
         });
      }

      // Let's sort the data
      this.sort(Array.from(context.view.values()));

      if (context == this.#activeContext) {
         this.triggerViewUpdatedNotif();
      }

      // Some clients may be interested in this update
      this.triggerContextUpdated(
         context,
         {
            addedLines: context.view,
            deletedLines: null,
            updatedLines: null
         });
   }

   /**
    * Test a line against a set of filters
    * @param {} line 
    * @param {*} activeFilters 
    * @returns 
    */
   testLine(line, activeFilters) {

      let addLine = true;

      activeFilters.some((filter) => {
         if (!(addLine = filter.test(line))) {
            return true;
         }
         return false;
      });

      return addLine;
   }

   /**
    * If the referential set of data was changed, get it and handle
    * @param {*} data 
    * @param {*} isFull 
    */
   dataUpdated(data, mode = Core_DataSource.dataUpdateMode.FULL) {
      $svc('log').timeStamp('dataUpdated IN : ' + this.#params.sourceName);

      if (mode == Core_DataSource.dataUpdateMode.FULL) {
         this.#dataArray = data;
         this.#data = new Map(data.map(obj => [obj[this.primaryKey], obj]));

         //this.#data = data;
         this.recomputeAllContexts(data);
      }
      else if (mode == Core_DataSource.dataUpdateMode.DELTA_ADD) {
         this.computeDeltaAddForContexts(data);
         this.#dataArray = Array.from(this.#data.values());
      }
      $svc('log').timeStamp('dataUpdated OUT : ' + this.#params.sourceName);
   }

   /**
    * The data source reloaded all data we have to work here
    */
   recomputeAllContexts(data) {
      // Compute the view for all contexts
      this.#contexts.forEach((context, index, arr) => {
         // If children classes want to implement a specific behavior
         this.beforeRecomputeContext(context);

         // Compute the view for the current context
         this.computeContextView(context);
      });
   }

   /**
    * The data source was modified by "delta", each context must be updated accordingly
    * @param {} data 
    */
   computeDeltaAddForContexts(data) {
      let viewUpdated = false;
      let contextUpdated = false;
      let isActiveContext;

      // Update internal memory data
      data.forEach((line, index, arr) => {
         this.#data.set(line[this.primaryKey], line);
      });

      // First process all contexts that are not active
      this.#contexts.forEach((context, index, arr) => {
         contextUpdated = false;
         const cView = context.view;

         let addedLines = new Map();
         let deletedLines = new Map();
         let updatedLines = new Map();

         // We need the filters there
         const activeFilters = this.computeActiveFiltersForContext(context);

         // Process each line of the delta updated at a time
         data.forEach((line, index, arr) => {
            const key = line[this.primaryKey];

            const testLine = this.testLine(line, activeFilters);

            // The line must be in the selection
            if (testLine) {
               // Line already selected before, must be updated only
               if (cView.has(key)) {
                  if (this.processLineUpdated(context, line)) {
                     contextUpdated = true;
                     updatedLines.set(line[this.primaryKey], line);
                  }
               }
               // The line was not there, we add it
               else {
                  this.addLineToView(context, line);
                  addedLines.set(line[this.primaryKey], line);
                  contextUpdated = true;
               }
            }
            // The line must not be in the selection
            else {
               // The line was there, it must be removed
               if (cView.has(key)) {
                  this.removeLineFromView(context, line);
                  contextUpdated = true;
                  deletedLines.set(line[this.primaryKey], line);
               }
            }
         });

         // If the context was updated, we must tell it
         if (contextUpdated) {
            if (context == this.#activeContext) {
               viewUpdated = contextUpdated;
            }

            this.triggerContextUpdated(context, {
               addedLines: addedLines,
               deletedLines: deletedLines,
               updatedLines: updatedLines
            });
         }
      });

      // Notify clients about the view update
      if (viewUpdated) {
         this.sort(Array.from(this.#activeContext.view.values()));
         this.triggerViewUpdatedNotif();
      }

   }

   /**
    * Compute delta content for this source from a a delta object
    * @param {*} delta 
    */
   computeDeltaFromDelta(delta) {
      // First process all contexts that are not active
      this.#contexts.forEach((context, index, arr) => {

      });

      for (const [id, line] of delta.addedLines) {

      }

   }

   beforeComputeView(context) { }
   beforeRecomputeContext(context) { }

   /**
    * To prepare the list of filters to take into account when filtering the view
    */
   computeActiveFiltersForContext(context) {
      const fv = context.filterValues;
      let activeFilters = [];
      for (const [filterName, filter] of this.#filterDef) {
         if (filter.activeOrNot((fv[filterName]) ?? '')) {
            activeFilters.push(filter);
         }
      }

      return activeFilters;
   }

   /**
    * To sort the view computed through computeView
    */
   sort(view) { }

   /**
    * After the view is computed, send a structured object to clients gathering all required info
    * @param {*} view 
    */
   triggerViewUpdatedNotif() {
      let resultView = Array.from(this.#activeContext.view.values());

      // Then apply pagination, if any
      if (this.#params.pageSize > 0) {
         this.#activeContext.currentPage = 1;
         this.#activeContext.nbPages = Math.floor(this.#activeContext.view.length / this.#params.pageSize) + 1;
         resultView = resultView.slice(0, this.#params.pageSize);
      }

      this.#viewUpdated.next({
         view: resultView,
         filterValues: this.#activeContext.filterValues,
         pagination: {
            isActive: (this.#params.pageSize > 0),
            currentPage: this.#activeContext.currentPage,
            nbPages: this.#activeContext.nbPages,
            pageSize: this.#params.pageSize
         },
         extra: this.makeExtraDataForNotif()
      });
   }

   /**
    * A context was updated, a client could be interested
    * @param {} context 
    */
   triggerContextUpdated(context, deltaObject) {
      this.#contextUpdated.next({ context: context, delta: deltaObject });
   }

   /**
    * If a child class wants to put some data of its own in the notif
    * @returns null by default there, as we've already sent everything we had to
    */
   makeExtraDataForNotif() {
      return null;
   }

   /**
    * Adding a line to the view is made in this callback to let children classes do specific funny stuff if needed
    * @param {} line 
    */
   addLineToView(context, line) {
      // In this class, nothing too funky to do
      context.view.set(line[this.primaryKey], line);
   }

   /**
    * If there is something smart to be done there, it must be done in children classes
    * @param {} context 
    * @param {*} line 
    */
   processLineUpdated(context, line) {
      context.view.set(line[this.primaryKey], line);

      return true;
   }

   /**
    * If there is something to be done there, it must be done in children classes
    * @param {*} context 
    * @param {*} line 
    */
   removeLineFromView(context, line) {
      context.view.delete(line[this.primaryKey]);
   }

   /**
    * For clients of this DataSource to know when the view was updated
    * @returns 
    */
   getViewUpdated() {
      return this.#viewUpdated;
   }

   /**
    * For clients of this DataSource to know when a given context was updated
    * @returns 
    */
   getContextUpdated() {
      return this.#contextUpdated;
   }

   /**
    * This setter should only be called by children classes
    */
   set data(data) {
      this.#data = data;
   }

   /**
    * This getter should only be called by children classes
    */
   get subManager() {
      return this.#subManager;
   }

   /**
    * This getter should only be called by children classes
    */
   get primaryKey() {
      return this.#primaryKey;
   }

   /**
    * Provide an access to the current active context
    */
   get activeContext() {
      return this.#activeContext;
   }
}