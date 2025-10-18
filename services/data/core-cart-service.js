import { Observable, BehaviorSubject } from "rxjs";

export class Core_CartService {
   #contentUpdated;     // Notifies clients when the cart content is updated
   #items;              // All the items in the cart

   /**
    * Constructs the cart service, initializes the cart content,
    * and loads the current cart from the backend.
    */
   constructor() {
      // Initialize core objects
      this.#contentUpdated = new BehaviorSubject([]);
      this.#items = new Map();

      // Get the current cart content from the backend
      $svc('ajax').getJSON(
         $svc('default').cart.loadItemsAPI, {}
      ).subscribe({
         next: (data) => {
            if (data) {
               const entries = Object.entries(data.items);
               this.#items = new Map(entries);

               // Load the internal map
               this.#contentUpdated.next(this.#items);
            }
         },
         error: (err) => {
            // Handle or log the error as needed
            console.error("Failed to load cart items:", err);
         }
      });
   }

   /**
    * Adds an item to the cart and returns an Observable indicating success or failure.
    * Notifies all subscribers with the updated cart content.
    * @param {*} item The item to add to the cart.
    * @returns {Observable<boolean>} Emits true if added, false otherwise.
    */
   addItem(item) {
      return new Observable((observer) => {
         $svc('ajax').put(
            $svc('default').cart.addItemAPI,
            { item: item }
         ).subscribe({
            next: (data) => {
               if (data.result === 'SUCCESS') {
                  // Update the list of items part of the cart
                  const entries = Object.entries(data.items);
                  this.#items = new Map(entries);

                  // Notify all clients interested in this Cart content
                  this.#contentUpdated.next(this.#items);

                  // Notify the client which initially asked for the addItem
                  observer.next(true);
               }
               else {
                  // Tell the caller item could not be added
                  observer.next(false);
               }
               observer.complete();
            },
            error: (err) => {
               // Notify the observer of the error
               observer.error(err);
            }
         });
      });
   }

   /**
    * Removes an item from the cart and returns an Observable indicating success or failure.
    * Notifies all subscribers with the updated cart content.
    * @param {*} item The item to remove from the cart.
    * @returns {Observable<boolean>} Emits true if removed, false otherwise.
    */
   removeItem(item) {
      return new Observable((observer) => {
         $svc('ajax').put(
            $svc('default').cart.removeItemAPI,
            { item: item }
         ).subscribe({
            next: (data) => {
               if (data.result === 'SUCCESS') {
                  // Update the list of items part of the cart
                  const entries = Object.entries(data.items);
                  this.#items = new Map(entries);

                  // Notify all clients interested in this Cart content
                  this.#contentUpdated.next(this.#items);

                  // Notify the client which initially asked for the removeItem
                  observer.next(true);
               }
               else {
                  // Tell the caller item could not be removed
                  observer.next(false);
               }
               observer.complete();
            },
            error: (err) => {
               // Notify the observer of the error
               observer.error(err);
            }
         });
      });
   }

   /**
    * Checks if a given item is present in the cart.
    * @param {*} item The item to check.
    * @returns {boolean} True if the item is in the cart, false otherwise.
    */
   hasItem(item) {
      if (item['core_keyForCart']) {
         return this.#items.has(item.core_keyForCart);
      }
      return false;
   }

   /**
    * Returns an observable that emits the cart content whenever it is updated.
    * @returns {BehaviorSubject<Map>} Observable emitting the cart content.
    */
   getContentUpdated() {
      return this.#contentUpdated;
   }
}