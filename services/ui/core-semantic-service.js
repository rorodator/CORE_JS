/**
 * Service utilitaire pour améliorer ou corriger certains comportements de Semantic UI côté client.
 * Gère notamment l'affichage adaptatif des menus "stackable" selon la taille de la fenêtre.
 * Singleton : une seule instance pour toute l'application.
 */
export class Core_SemanticService {
   // Singleton instance
   static #instance;

   // All registered stackable Semantic UI menus (Map: idMenu -> 1)
   #stackableMenus;

   /**
    * Constructor of the singleton instance for the class.
    * Throws if called twice.
    */
   constructor() {
      if (Core_SemanticService.#instance != null) {
         throw new Error("Cannot instantiate twice SemanticService ");
      }
      this.#stackableMenus = new Map();
      Core_SemanticService.#instance = this;
   }

   /**
    * Registers a new stackable menu to be managed.
    * @param {string|HTMLElement|jQuery} idMenu - The menu identifier or selector.
    */
   addStackableMenu(idMenu) {
      // Don't register the same Menu twice
      if (!this.#stackableMenus.has(idMenu)) {
         this.#stackableMenus.set(idMenu, 1);

         // If first menu registered, listen to window resize
         if (this.#stackableMenus.size === 1) {
            window.addEventListener('resize', Core_SemanticService.manageStackableMenus);
         }
      }
   }

   /**
    * Unregisters a stackable menu.
    * @param {string|HTMLElement|jQuery} idMenu - The menu identifier or selector.
    */
   removeStackableMenu(idMenu) {
      if (this.#stackableMenus.has(idMenu)) {
         this.#stackableMenus.delete(idMenu);

         // If no more menus, remove the resize listener
         if (this.#stackableMenus.size === 0) {
            window.removeEventListener('resize', Core_SemanticService.manageStackableMenus);
         }
      }
   }

   /**
    * Updates the display property of all registered stackable menus.
    * @param {string} targetDisplay - The CSS display value to apply (e.g., '', 'none').
    */
   updateStackableMenusDisplay(targetDisplay) {
      this.#stackableMenus.forEach((value, key) => {
         $(key).css('display', targetDisplay);
      });
   }

   /**
    * Static callback for window resize events to update stackable menus.
    */
   static manageStackableMenus() {
      let targetDisplay = (window.innerWidth > 768) ? '' : 'none';
      Core_SemanticService.#instance.updateStackableMenusDisplay(targetDisplay);
   }
}