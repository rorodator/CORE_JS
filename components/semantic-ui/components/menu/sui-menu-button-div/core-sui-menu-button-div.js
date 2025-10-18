import template from './template';
import '../../../../styles/CSS/semantic-stackable-menu.css';
import '../../../../styles/CSS/globals.css';
import { Core_HBSElement } from '../../../../lib/base/core-hbs-element';

/**
 * Component to display the button to open/close a stackable Menu when in mobile resolution
 */
export class Core_SUIMenuButtonDiv extends Core_HBSElement {
   constructor() {
      super(template);

      // Get the id of the target menu
      this.idTarget = this.getAttribute('data-menu');

      // Target menu to be added as a Stackable menu to be managed
      $svc('semantic').addStackableMenu(this.idTarget);
   }

   /**
    * 
    */
   onConnect() {
      this.render();
   }

   /**
    * Plug the functional behavior to the component once the DOM is created
    */
   ui_toFunctional() {
      this.querySelector('button').addEventListener('click', this.handleButtonClicked.bind(this));
   }

   /**
    * Component destroyed, we clean the stackable menus
    */
   onDisconnect() {
      $svc('semantic').removeStackableMenu(this.idTarget);
   }

   /**
    * Local callback to show/hide the menu managed by the button
    */
   handleButtonClicked() {
      $(this.idTarget).toggle();
   }
}

customElements.define('core-sui-menu-button-div', Core_SUIMenuButtonDiv);