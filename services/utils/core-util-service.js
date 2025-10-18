export class Core_UtilService {
   constructor() {}

   /**
    * Returns the inheritance hierarchy for a given object.
    * @param {Object} obj The object to inspect.
    * @returns {string[]} Array of constructor names from the object's prototype chain.
    */
   getObjectClassHierarchy(obj) {
      const hierarchy = [];
      let proto = Object.getPrototypeOf(obj);

      while (proto && proto.constructor !== Object) {
         hierarchy.push(proto.constructor.name);
         proto = Object.getPrototypeOf(proto);
      }

      return hierarchy;
   }

   /**
    * Returns all method names available on an object, including inherited ones (except Object.prototype).
    * @param {Object} obj The object to inspect.
    * @returns {string[]} Array of method names.
    */
   getObjectAvailableMethods(obj) {
      let methods = new Set();
      let proto = obj;

      while (proto && proto !== Object.prototype) {
         Object.getOwnPropertyNames(proto).forEach(name => {
            if (typeof proto[name] === 'function') {
               methods.add(name);
            }
         });
         proto = Object.getPrototypeOf(proto);
      }

      return Array.from(methods);
   }
}