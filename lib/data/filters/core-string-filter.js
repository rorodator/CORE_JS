export class Core_StringFilter {
   #value;              // The value to use to apply the filter
   #filterValue;        // The value really found in the filter
   #params;             // This input parameters

   static comparisonLevels = {
      EQUALS: 1,
      LIKE: 2,
      WILDCARDS: 3,
      WILDCARDS_EXACT: 4
   };

   static defaultParams = {
      comparisonLevel: Core_StringFilter.comparisonLevels.EQUALS,
      testCase: false,
      trimValue: true,
      isMultiple: false
   };

   constructor(params) {
      // Store params for later use
      this.#params = { ...Core_StringFilter.defaultParams, ...params };
      // Backward compatibility: accept 'caseSensitive' alias
      if (Object.prototype.hasOwnProperty.call(params || {}, 'caseSensitive')) {
         this.#params.testCase = !!params.caseSensitive;
      }

      this.#value = null;
      this.#filterValue = null;
   }

   /**
    * 
    * @param {string} targetValue - the Value for the filter
    * @returns true if the filter is active (targetValue non empty), false otherwise
    */
   activeOrNot(targetValue) {

      this.#filterValue = (targetValue) ?? '';

      // If required by the parameters, let's trim the value
      if (this.#params.trimValue) {
         targetValue = targetValue.trim();
      }

      if (targetValue) {

         // Update the value, taking into account the testCase parameter
         if (this.#params.testCase === false) {
            targetValue = targetValue.toLowerCase();
         }
         if (this.#params.comparisonLevel === Core_StringFilter.comparisonLevels.WILDCARDS) {
            const regExpPattern = targetValue.replace(/\*/g, '.*');
            this.regExp = new RegExp(regExpPattern, (this.#params.testCase === false) ? 'i' : '');
         } else if (this.#params.comparisonLevel === Core_StringFilter.comparisonLevels.WILDCARDS_EXACT) {
            const regExpPattern = targetValue.replace(/\*/g, '.*');
            this.regExp = new RegExp('^' + regExpPattern + '$', (this.#params.testCase === false) ? 'i' : '');
         }
      }
      // Tell the parent object about this being active or not
      return ((this.#value = targetValue) !== '');
   }

   /**
    * Method to test
    * @param {} targetValue 
    * @param {*} currentValue 
    * @returns 
    */
   test(line) {
      let testValue = line[this.#params.columnKey];
      testValue = (testValue ?? '').toString();

      // Depending on the comparison level, we don't do the same test
      switch (this.#params.comparisonLevel) {
         case Core_StringFilter.comparisonLevels.LIKE:
            if (this.#params.testCase === false) {
               testValue = testValue.toLowerCase();
            }
            return testValue.includes(this.#value);
            break;
         case Core_StringFilter.comparisonLevels.EQUALS:
            return testValue.compareTo(this.#value);
         case Core_StringFilter.comparisonLevels.WILDCARDS:
         case Core_StringFilter.comparisonLevels.WILDCARDS_EXACT:
            return this.regExp.test(testValue);
      }

      // Logically, we should never reach that point
      $svc('log').fatalError('Could not apply string filter test due to improper comparisonLevel');
   }

   //-------------
   // ACCESSORS --
   //-------------
   get value() {
      return this.#filterValue;
   }
}