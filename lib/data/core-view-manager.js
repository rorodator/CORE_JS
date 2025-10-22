import { BehaviorSubject } from "rxjs";

/**
 * May be used between a DataSource and a graphical component to decide how to prepare the view from the data.
 */
export class Core_ViewManager {
   #params;                // Params set by the client
   #notif_viewUpdated;     // The BehaviorSubject to propagate calculated view
   #view;                  // The view shared with clients
   #data;                  // The whole data, used to extract the view
   #context;               // To pass any "parent" data to the listener

   #pagination_currentPage;// If pagination used, the current page to display
   #pagination_nbPages;    // If pagination used, the total number of pages
   #sortModel;             // Manage sorts, if required

   /**
    * Constructor.
    * @param {Object} params - Parameters for the view manager (pagination, etc.).
    */
   constructor(params) {
      // Init object parameters
      this.#params = { ...this.getDefaultParams(), ...params };

      // By default, no view nor data available
      this.#view = [];
      this.#data = [];

      // No pagination so far
      this.#pagination_currentPage = 1;
      this.#pagination_nbPages = 0;

      // No specific sort so far
      this.#sortModel = {
         columnName: '',
         direction: 'asc'
      };

      // By default, no context
      this.#context = null;

      // The Observable used to propage view updates
      this.#notif_viewUpdated = new BehaviorSubject(null);
   }

   /**
    * Returns the default parameters for all View Managers.
    * @returns {Object} The default parameters.
    */
   getDefaultParams() {
      return {
         pagination: {
            use: false,
            pageSize: 30
         }
      };
   }

   /**
    * Updates the data array and refreshes the view.
    * @param {Array} data - The new data array to display.
    */
   updateDataArray(data) {
      // Point to the proper data source
      this.#data = data;

      // Will be computed based on #data but #data must stay untouched
      this.#view = [...this.#data];

      // Then apply the sort and return what must be
      this.updateSortOnly();
   }

   /**
    * Updates the sort model and refreshes the view.
    * @param {Object} sortModel - The sort model (columnName, direction).
    */
   updateSortModel(sortModel) {
     
      if( sortModel) {
         this.#sortModel = sortModel;
         // If the sort model is not empty, apply the sort
         if( this.#sortModel.columnName && this.#sortModel.direction) {
            this.updateSortOnly();
         }
      }
   }
   
   /**
    * Applies the current sort model to the data and refreshes the view.
    */
   updateSortOnly() {

      // Sort the data, if required
      this.sort();

      // Manage pagination, if needed
      const pag = this.#params.pagination;

      if (pag.use) {
         // We may want to recompute the currentPage, or not
         if (this.#data.length < Math.max(0, (this.#pagination_currentPage - 1) * pag.pageSize)) {
            this.#pagination_currentPage = 1;
         }

         // Refresh current number of pages
         this.#pagination_nbPages = Math.floor((Math.max(0, this.#data.length - 1)) / pag.pageSize) + 1;

         // Refresh the view
         this.computeViewForPage();
      }

      // Notify clients about the view being updated
      this.triggerViewUpdated();
   }

   /**
    * Selects a page (if pagination is enabled) and updates the view.
    * @param {number} pageIndex - The page index to select (1-based).
    */
   selectPage(pageIndex) {
      if (!this.#params.pagination.use) {
         $svc('log').error('Cannot select page when pagination not activated in Core_ViewManager');
      }
      else {
         if (pageIndex < 1 || pageIndex > this.#pagination_nbPages) {
            $svc('log').error('Incorrect page index [' + pageIndex + '] in Core_ViewManager');
         } else {
            // Properly go to selected page
            this.#pagination_currentPage = pageIndex;

            // Refresh the view
            this.computeViewForPage();

            // Notify clients
            this.triggerViewUpdated();
         }
      }
   }

   /**
    * When a page is selected, properly compute the view
    */
   computeViewForPage() {
      const pag = this.#params.pagination;

      if (pag.use) {
         const firstItem = (this.#pagination_currentPage - 1) * pag.pageSize;
         this.#view = this.#data.slice(firstItem, firstItem + pag.pageSize);
      }
   }

   /**
    * To apply a sort to the data before computing the view
    * Should be implemented by subclasses or extended as needed
    */
   sort() { }

   /**
    * Notifies clients about a view update.
    */
   triggerViewUpdated() {
      this.#notif_viewUpdated.next({
         viewManager: this,
         nbLinesTotal: this.#data.length,
         view: this.#view,
         currentPage: this.#params.pagination.currentPage,
         context: this.#context
      });
   }

   /**
    * Returns the BehaviorSubject to subscribe to view updates.
    * @returns {BehaviorSubject} The subject emitting view update notifications.
    */
   onViewUpdated() {
      return this.#notif_viewUpdated;
   }

   //-------------
   // ACCESSORS --
   //-------------

   /**
    * Gets the current view (array of items for the current page).
    * @returns {Array} The current view.
    */
   get view() {
      return this.#view;
   }

   /**
    * Gets the full data array.
    * @returns {Array} The full data.
    */
   get data() {
      return this.#data;
   }

   /**
    * Gets the total number of rows in the data.
    * @returns {number} The total row count.
    */
   get rowCount() {
      return this.#data.length;
   }

   /**
    * Gets the number of rows in the current view.
    * @returns {number} The view row count.
    */
   get viewRowCount() {
      return this.#view.length;
   }

   /**
    * Gets the current sort model.
    * @returns {Object} The sort model.
    */
   get sortModel() {
      return this.#sortModel;
   }
   /**
    * Sets the current sort model.
    * @param {Object} sortModel - The sort model to set.
    */
   set sortModel(sortModel) {
      console.log('set sortModel', sortModel);
      this.#sortModel = sortModel;
   }

   /**
    * Gets the current context object.
    * @returns {*} The context.
    */
   get context() {
      return this.#context;
   }
   /**
    * Sets the current context object.
    * @param {*} context - The context to set.
    */
   set context(context) {
      this.#context = context;
   }
}