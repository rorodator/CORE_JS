export class Core_IntFilter {
   static defaultParams = {
      dontTestZero: true,
      isMultiple: false
   };

   #value;           // Current value of the Filter
   #filterValue;     // Value that was given as an input

   // Parameters to customize this Filter
   #params;

   constructor(params) {
      this.#value = null;
      this.#filterValue = null;

      // Store params for later use
      this.#params = { ...Core_IntFilter.defaultParams, ...params };
   }

   /**
    * 
    * @param {string} targetValue - the Value for the filter
    * @returns true if the filter is active (targetValue non empty), false otherwise
    */
   activeOrNot(targetValue) {
      let isActive = false;

      this.#value = targetValue;
      this.#filterValue = targetValue;

      // We expect an array that must be at least one element long
      if (this.#params.isMultiple) {
         if (targetValue) {
            isActive = (this.#value.length > 0);
         } else {
            isActive = false;
         }
      }
      // No array expected, we check that the value is non empty
      else {
         isActive = ((this.#value !== '')
            && ((this.#params.dontTestZero === true) || (this.#value != 0)));
      }

      return isActive;
   }

   /**
    * Method to test that this Filter's value is the one currently present in the line
    * If the filter value is 0 and #params.dontTestZero is true, we never ever enter
    * this method because the filter already told its parent manager that no test is to be
    * performed there.
    * @param {} targetValue 
    * @param {*} currentValue 
    * @returns 
    */
   test(line) {
      let keepLine = false;

      // If we epected an array, at least one value of the array must match current line value
      if (this.#params.isMultiple) {
         let i = 0;
         while ((i < this.#value.length)
            && (!keepLine)) {
            keepLine = (line[this.#params.columnKey] == this.#value[i]);
            i++;
         }
      }
      // No array, just match the single value
      else {
         keepLine = (this.#value == line[this.#params.columnKey]);
      }

      return keepLine;
   }

   /**
    * Return current Filter v
    */
   get value() {
      return this.#filterValue;
   }
}