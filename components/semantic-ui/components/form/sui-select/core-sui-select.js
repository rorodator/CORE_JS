import template from './template';
import suiSelectOptionList from '../../../templates/handlebars/partials/SUI/suiSelectOptionList';
import '../../../templates/handlebars/suiPartials';
import { Core_HBSElement } from '../../../lib/base/core-hbs-element';

export class Core_SUISelect extends Core_HBSElement {

   // A proxy to the input Element hosting the selected value
   #inputElement;
   #value;

   constructor() {
      super(template);

      // The target input element holding the value
      this.targetElement = null;
      this.suiDropdown = null;

      // Default Empty Option List
      this.optionList = [];
      this.#value = null;

      // Initialize local attributes, make them available in the hbs template
      this.placeHolder = this.getAttribute('placeHolder');
      this.name = this.getAttribute('name');

      this.addEventListener('change', (evt) => { this.#value = evt.target.value });
   }

   /**
    * Display the object on connect
    */
   onConnect() {
      this.render();
   }

   /**
    * Clean the specific jQuery specifics
    */
   cleanFunctional() {
      $(this.suiDropdown).dropdown('destroy');
   }

   /**
    * For the object client to set the option list doing the dropdown
    * @param {} optionList 
    */
   setOptionList(optionList) {
      this.optionList = optionList;
      this.querySelector('.core-sui-select-option-list').innerHTML = suiSelectOptionList(this);
      $svc('lang').process(this.querySelector('.core-sui-select-option-list'));
      $(this.suiDropdown).dropdown('destroy');
      $(this.suiDropdown).dropdown('set selected', this.#value);
   }

   /**
    * After ui_render is done, plug the functional behavior
    */
   ui_toFunctional() {
      // Keep a reference to a hidden input hosting the value
      this.targetElement = this.querySelector('.core-input-value');
      this.suiDropdown = this.querySelector('.ui.dropdown');

      // First display of the select, we can init its value using the default one
      $(this.suiDropdown).dropdown('set selected', this.#value = this.getAttribute('value'));
   }

   /**
    * A wrapper to bind the value of this SelectElement to the real input hosting the value
    */
   get value() {
      return (this.targetElement) ? this.targetElement.value : '';
   }

   /**
    * To force the value of the input and update the selected item
    */
   set value(value) {
      $(this.suiDropdown).dropdown('set selected', value);
   }
}

customElements.define('core-sui-select', Core_SUISelect);