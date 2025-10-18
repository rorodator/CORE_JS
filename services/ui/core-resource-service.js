// Core_ResourceService: Manages resource locks to prevent concurrent access issues
export class Core_ResourceService {
   #resources;

   /**
    * Constructor: Initializes the internal resource lock map.
    */
   constructor() {
      this.#resources = new Map();
   }

   /**
    * Attempts to acquire a lock for a given resource type and key.
    * If the lock does not exist, it is created and true is returned.
    * If the lock already exists, returns false.
    * @param {string} type - The resource type (e.g., 'user', 'file').
    * @param {string|number} key - The unique resource key.
    * @returns {boolean} True if the lock was acquired, false otherwise.
    */
   lock(type, key) {
      const localKey = this.makeKey(type, key);
      const lockGotten = !this.#resources.has(localKey);

      if (lockGotten) {
         this.#resources.set(localKey, 1);
      }

      return lockGotten;
   }

   /**
    * Releases a lock previously reserved for a given resource type and key.
    * @param {string} type - The resource type.
    * @param {string|number} key - The resource key.
    * @returns {boolean} True if a lock was released, false if there was no lock.
    */
   unlock(type, key) {
      const localKey = this.makeKey(type, key);
      const hadLock = this.#resources.delete(localKey);
      return hadLock;
   }

   /**
    * Creates a unique key based on the pair type/key.
    * Can be overridden in subclasses for custom key generation.
    * @param {string} type - The resource type.
    * @param {string|number} key - The resource key.
    * @returns {string} The unique key for the resource.
    */
   makeKey(type, key) {
      return `${type}@@@${key}`;
   }
}