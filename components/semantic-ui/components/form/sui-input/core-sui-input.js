import template from './template';
import { Core_HBSElement } from '../../../../../lib/base/core-hbs-element';

export class Core_SUIInput extends Core_HBSElement {
   constructor() {
      super(template);
      this.placeholder = this.getAttribute('placeholder') || '';
      this.name = this.getAttribute('name') || '';
      this.inputId = this.getAttribute('input-id') || '';
      this.clearable = this.hasAttribute('clearable') && this.getAttribute('clearable') !== 'false';
   }

   onConnect() {
      this.render();
   }

   ui_toFunctional() {
      this.inputEl = this.querySelector('input.core-sui-input');
      this.clearIcon = this.querySelector('.core-sui-input-clear');
      if (this.inputId) this.inputEl.id = this.inputId;
      if (this.name) this.inputEl.name = this.name;
      if (this.placeholder) this.inputEl.setAttribute('placeholder', this.placeholder);

      if (!this.clearable) {
         if (this.clearIcon) this.clearIcon.style.display = 'none';
         return;
      }
      // Toggle visibility based on content
      const toggle = () => {
         if (!this.clearIcon) return;
         this.clearIcon.style.visibility = (this.inputEl.value && this.inputEl.value.length > 0) ? 'visible' : 'hidden';
      };
      this.inputEl.addEventListener('input', toggle);
      this.inputEl.addEventListener('change', toggle);
      toggle();
      // Clear behavior
      if (this.clearIcon) {
         this.clearIcon.addEventListener('click', () => {
            this.inputEl.value = '';
            this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            this.inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            toggle();
         });
      }
      // i18n tooltip for clear
      try {
         const t = $svc('lang').getLabel('user_list.clear_field') || 'Clear';
         if (this.clearIcon) this.clearIcon.setAttribute('title', t);
      } catch (_) {}
   }

   get value() {
      return this.inputEl ? this.inputEl.value : '';
   }

   set value(val) {
      if (!this.inputEl) return;
      this.inputEl.value = val || '';
      this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      this.inputEl.dispatchEvent(new Event('change', { bubbles: true }));
   }
}

customElements.define('core-sui-input', Core_SUIInput);


