/**
 * This class gathers a set of tools/utils to speak fluently with the browser.
 */
export class Core_BrowserService {
   constructor() {
   }

   /**
    * Determines if a given HTMLElement is scrollable on either the X or Y axis.
    * @param {HTMLElement} elt The element to check for scrollability.
    * @returns {boolean} True if the element is scrollable, false otherwise.
    */
   isElementScrollable(elt) {
      const style = window.getComputedStyle(elt);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;

      const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && elt.scrollHeight > elt.clientHeight;
      const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && elt.scrollWidth > elt.clientWidth;

      return isScrollableY || isScrollableX;
   }

   /**
    * Retrieves the value of a CSS variable from the root document.
    * @param {string} varName The name of the CSS variable (e.g., '--main-color').
    * @returns {string} The value of the CSS variable, or an empty string if not found.
    */
   getCSSVar(varName) {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
   }

   /**
    * Sets the vertical scroll position of the document.
    * @param {number} top The number of pixels to scroll vertically.
    */
   setDocumentScrollTop(top) {
      document.documentElement.scrollTop = top;
      document.body.scrollTop = top;
   }
}