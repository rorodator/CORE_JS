/**
 * A generic class to manage "scopes".
 * Useful for handling multiple contexts (workspaces, profiles, etc.) in an application.
 */
export class Core_ScopeManager {
   #scopes;          // All scopes currently managed (Map: id -> scope)
   #selectedScopeId; // The id of the currently active scope
   #selectedScope;   // The currently active scope object

   /**
    * Constructs a new ScopeManager.
    */
   constructor() {
      this.#scopes = new Map();
      this.#selectedScope = null;
      this.#selectedScopeId = null;
   }

   /**
    * Adds a scope to the manager.
    * @param {*} id - The unique identifier for the scope.
    * @param {*} scope - The scope object to add.
    * @returns {boolean} True if the scope was added, false if the id already exists.
    */
   addScope(id, scope) {
      // Cannot add two scopes with same id
      if (this.#scopes.has(id)) {
         $svc('log').error('Cannot add two scopes with the same id [' + id + '] in Core_ScopeManager');
         return false;
      }

      // Register the scope
      this.#scopes.set(id, scope);
      if (this.#scopes.size === 1 || scope.isDefault) {
         this.#selectedScopeId = id;
         this.#selectedScope = scope;
      }

      // Tell the client we did accept to add the scope to the repo
      return true;
   }

   /**
    * Selects a specific scope by its id.
    * @param {*} idScope - The id of the scope to select.
    * @returns {*} The selected scope object, or null if not found.
    */
   selectScope(idScope) {
      // Id unicity is to be checked
      if (!this.#scopes.has(idScope)) {
         return null;
      }

      // Remember scope currently selected
      this.#selectedScopeId = idScope;

      // Return selected scope description
      this.#selectedScope = this.#scopes.get(idScope);
      return this.#selectedScope;
   }

   //-------------
   // ACCESSORS --
   //-------------

   /**
    * Gets the currently selected scope object.
    * @returns {*} The selected scope.
    */
   get selectedScope() {
      return this.#selectedScope;
   }

   /**
    * Gets all scopes managed by this manager.
    * @returns {Map} The map of all scopes (id -> scope).
    */
   get scopes() {
      return this.#scopes;
   }
}