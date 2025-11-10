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

      // Propagate data-core-lang to underlying input so Core_LangService can process attributes directly
      const dataCoreLang = this.getAttribute('data-core-lang');
      if (dataCoreLang) {
         this.inputEl.setAttribute('data-core-lang', dataCoreLang);
      }

      // Mirror selected attributes from host to inner input (supports runtime i18n updates)
      const mirrorAttr = (attrName) => {
         const val = this.getAttribute(attrName);
         if (val !== null) this.inputEl.setAttribute(attrName, val);
         else this.inputEl.removeAttribute(attrName);
      };
      // Initial mirror for common attributes
      ['placeholder', 'title', 'aria-label'].forEach(mirrorAttr);
      // Observe host attribute changes and forward to input
      const observer = new MutationObserver((mutations) => {
         mutations.forEach(m => {
            if (m.type === 'attributes' && m.attributeName) {
               if (m.attributeName === 'placeholder' || m.attributeName === 'title' || m.attributeName.startsWith('aria-')) {
                  mirrorAttr(m.attributeName);
               }
            }
         });
      });
      observer.observe(this, { attributes: true, attributeFilter: ['placeholder', 'title'] });
      // Wide observe for aria-* (MutationObserver doesn't support wildcards; observe all and filter)
      observer.observe(this, { attributes: true });

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


