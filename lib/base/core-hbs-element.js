import { Core_HTMLElement } from "./core-html-element";

/**
 * A base class for UI components rendered with a Handlebars template.
 * Extends Core_HTMLElement and provides a simple interface for rendering with HBS.
 */
export class Core_HBSElement extends Core_HTMLElement {
   #template;     // The precompiled Handlebars template function to use for rendering

   /**
    * Constructs a new HBSElement.
    * @param {function(Object): string} template - The precompiled Handlebars template function.
    */
   constructor(template) {
      super();
      this.#template = template;
   }

   /**
    * Renders the component's content using the Handlebars template.
    * Sets innerHTML to the result of the template applied to this instance.
    */
   ui_render() {
      this.innerHTML = this.#template(this);
   }

   /**
    * Sets a new Handlebars template function for this element.
    * @param {function(Object): string} template - The new precompiled Handlebars template function.
    */
   set template(template) {
      this.#template = template;
   }
}