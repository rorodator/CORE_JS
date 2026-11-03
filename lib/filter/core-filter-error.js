/**
 * Typed failure for Core_FilterEngine. A bad value typed by a user is not one of these:
 * that stays on the instance as status "invalid".
 */
export class Core_FilterError extends Error {

   /**
    * @param {string} code
    * @param {string} message
    * @param {Readonly<Record<string, unknown>>} [details]
    */
   constructor(code, message, details) {
      super(message);
      this.name = 'Core_FilterError';
      this.code = code;
      if (details) {
         this.details = details;
      }
   }
}
