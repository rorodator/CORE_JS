import template from './template';
import { Core_HBSElement } from '../../../../lib/base/core-hbs-element';
import { Subject } from 'rxjs';

export class Core_SUIPaginator extends Core_HBSElement {

   #nbValidEntries;
   #pageSelected;

   /**
    * Standard constructor
    */
   constructor() {
      super(template);

      this.content = [];
      this.#nbValidEntries = $svc('default').paginator.nbValidEntries;
      this.#pageSelected = new Subject();
      this.nbPages = 0;
   }

   onConnect() {
      this.render();
   }

   /**
    * Must be called by the owner of this Paginator to define how many pages to display
    */
   set nbValidEntries(nb) {
      this.#nbValidEntries = nb;
   }

   /**
    * Method called to properly compute pages to be displayed to the client based on 
    */
   computeContent() {
      // Clean previous content first
      this.content = [];

      // Index of the first page to be displayed in the requested scope
      let firstValid = this.currentPage - Math.floor(this.#nbValidEntries / 2);

      if (firstValid < 1) {
         firstValid = 1;
      }
      else if (firstValid + this.#nbValidEntries > this.nbPages) {
         firstValid = Math.max(this.nbPages - this.#nbValidEntries + 1, 1);
      }

      // First valid being properly computed, we can finalize the global scope
      let lastValid = Math.min(firstValid + this.#nbValidEntries - 1, this.nbPages);

      // If the first valid page is not the first one of the global list
      if (firstValid > 1) {
         this.content.push(1);

         // If we want to put some free space between non continuous page ranks
         if (firstValid > 2) {
            this.content.push(0);
         }
      }

      // Add all pages to be seen
      while (firstValid <= lastValid) {
         this.content.push(firstValid);
         firstValid++;
      }

      // Display the last available page, if not already lastValid
      if (lastValid < this.nbPages) {

         // Add a "free space" first if the last page in the view is not the last of the scope
         if (lastValid < this.nbPages - 1) {
            this.content.push(0);
         }
         this.content.push(this.nbPages);
      }
   }

   /**
    * For the clients interested in Paginator clicks
    * @returns 
    */
   getPageSelected() {
      return this.#pageSelected;
   }

   /**
    * For children classes to be able to say when a new page was selected by user
    * @param {int} targetPage 
    */
   pageSelected(targetPage) {
      this.#pageSelected.next(targetPage);

      // Must be displayed again
      this.render();
   }

   /**
    * When DOM is created, we need to link the paginator buttons to the expected behavior
    */
   ui_toFunctional() {
      this.querySelectorAll('a').forEach((elt, key, arr) =>
         elt.addEventListener('click', Core_SUIPaginator.processClick)
      );
   }

   /**
    * Static method used to process the click on a new page
    * @param {*} evt 
    */
   static processClick(evt) {
      evt.stopPropagation();
      evt.target.closest('.pagination').parentNode.pageSelected(parseInt(evt.target.innerHTML));
   }

   /**
    * Link this Paginator with its target DataSource
    * @param {} dataSource 
    */
   setDataSource(dataSource) {
      this.addSub(dataSource.getViewUpdated().subscribe(data => {
         if (data && data.pagination) {

            // Update paginator data
            this.nbPages = data.pagination.nbPages;
            this.currentPage = data.pagination.currentPage;
            this.pageSize = data.pagination.pageSize;

            // Compute what's required for a clean display
            this.computeContent();

            // Refresh paginator display
            this.render();
         }
      }));
   }
}

customElements.define('sui-paginator', Core_SUIPaginator);