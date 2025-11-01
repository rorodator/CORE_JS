import { AutocompleteComponent } from './autocomplete-component.js';

/**
 * AutocompleteChipsComponent
 * Multi-select autocomplete with removable chips. Extends the base AutocompleteComponent.
 *
 * Configuration (via JS):
 *  - setItemLabelGetter(fn: (item) => string)
 *  - setItemValueGetter(fn: (item) => string|number)
 *  - configure({ clearOnSelect?: boolean, maxChips?: number, unique?: boolean })
 *
 * Attributes (optional):
 *  - item-label-key: when provided, label = item[item-label-key]
 *  - item-value-key: when provided, value = item[item-value-key]
 *  - clear-on-select: 'true'|'false' (default true)
 *  - max-chips: number (optional)
 *  - unique: 'true'|'false' (default true)
 *
 * Events:
 *  - chips-change: { values: any[], items: Array<{ label, value, raw }> }
 *  - chips-add: { item }
 *  - chips-remove: { value }
 */
export class AutocompleteChipsComponent extends AutocompleteComponent {
    /** @type {(item:any) => string} */
    #getLabel = (item) => {
        if (this.#itemLabelKey && item && typeof item === 'object' && this.#itemLabelKey in item) {
            return String(item[this.#itemLabelKey] ?? '');
        }
        if (item && typeof item === 'object' && item.title) return String(item.title);
        return String(item);
    };

    /** @type {(item:any) => any} */
    #getValue = (item) => {
        if (this.#itemValueKey && item && typeof item === 'object' && this.#itemValueKey in item) {
            return item[this.#itemValueKey];
        }
        if (item && typeof item === 'object' && 'value' in item) return item.value;
        return item;
    };

    #itemLabelKey = '';
    #itemValueKey = '';

    #clearOnSelect = true;
    #maxChips = null; // number | null
    #unique = true;
    #chipsPosition = 'above'; // 'above' | 'below'

    /** @type {Array<{ label: string, value: any, raw: any }>} */
    #selected = [];
    /** @type {Set<any>} */
    #selectedValues = new Set();
    /** @type {HTMLElement|null} */
    #chipsContainer = null;

    constructor() {
        super();
    }

    onConnect() {
        // Read attribute-based config before parent setup
        this.#readAttributes();
        super.onConnect();
    }

    ui_toFunctional() {
        super.ui_toFunctional();

        // Ensure chips container exists (inserted before search box)
        const root = this.querySelector('.autocomplete-container');
        if (root) {
            this.#chipsContainer = document.createElement('div');
            this.#chipsContainer.className = 'ui labels mm-chips-container';
            this.#chipsContainer.classList.add(this.#chipsPosition);
            if (this.#chipsPosition === 'below') {
                root.parentNode.insertBefore(this.#chipsContainer, root.nextSibling);
            } else {
                root.parentNode.insertBefore(this.#chipsContainer, root);
            }
        }

        // Handle selection: add chip and optionally clear input
        this.addEventListener('autocomplete-select', (e) => {
            const raw = e.detail && e.detail.result ? e.detail.result : e.detail;
            this.#handleSelect(raw);
        });
    }

    /**
     * Override to filter out already selected items from results.
     */
    updateResults(results) {
        const arr = results && results.results ? results.results : results;
        const source = Array.isArray(arr) ? arr : [];
        const filtered = source.filter((it) => !this.#selectedValues.has(this.#getValue(it)));
        return super.updateResults({ results: filtered });
    }

    /**
     * Add an item to selection and render chip.
     */
    #handleSelect(rawItem) {
        const value = this.#getValue(rawItem);
        const label = this.#getLabel(rawItem);
        if (this.#unique && this.#selectedValues.has(value)) {
            this.#clearInput();
            return;
        }
        if (this.#maxChips !== null && this.#selected.length >= this.#maxChips) {
            this.#clearInput();
            return;
        }
        this.#selectedValues.add(value);
        this.#selected.push({ label, value, raw: rawItem });
        this.#renderChip(label, value);
        this.dispatchEvent(new CustomEvent('chips-add', { detail: { item: { label, value, raw: rawItem } }, bubbles: true }));
        this.dispatchEvent(new CustomEvent('chips-change', { detail: { values: this.getSelectedValues(), items: this.getSelectedItems() }, bubbles: true }));
        if (this.#clearOnSelect) this.#clearInput();
    }

    #renderChip(label, value) {
        if (!this.#chipsContainer) return;
        const chip = document.createElement('a');
        chip.className = 'ui label mm-chip';
        chip.dataset.value = String(value);
        chip.textContent = label;
        const icon = document.createElement('i');
        icon.className = 'delete icon';
        chip.appendChild(icon);
        chip.addEventListener('click', () => {
            this.remove(value);
        });
        this.#chipsContainer.appendChild(chip);
    }

    #clearInput() {
        // Robust clear for Semantic UI search
        setTimeout(() => {
            try {
                const container = this.querySelector('.ui.search');
                const input = this.querySelector('.ui.search input');
                if (input) input.value = '';
                if (container) {
                    $(container).search('set value', '');
                    $(container).search('clear results');
                    $(container).search('hide results');
                    $(container).search('clear cache');
                }
                this.focus && this.focus();
            } catch (_) {}
        }, 0);
    }

    /** Public API **/
    setItemLabelGetter(fn) { if (typeof fn === 'function') this.#getLabel = fn; }
    setItemValueGetter(fn) { if (typeof fn === 'function') this.#getValue = fn; }

    setSelected(valuesOrItems) {
        this.clearSelection();
        if (!Array.isArray(valuesOrItems)) return;
        for (const v of valuesOrItems) {
            const value = (typeof v === 'object' && v !== null) ? this.#getValue(v) : v;
            const label = (typeof v === 'object' && v !== null) ? this.#getLabel(v) : String(v);
            if (this.#unique && this.#selectedValues.has(value)) continue;
            this.#selectedValues.add(value);
            this.#selected.push({ label, value, raw: v });
            this.#renderChip(label, value);
        }
        this.dispatchEvent(new CustomEvent('chips-change', { detail: { values: this.getSelectedValues(), items: this.getSelectedItems() }, bubbles: true }));
    }

    getSelectedValues() { return this.#selected.map(x => x.value); }
    getSelectedItems() { return this.#selected.slice(); }

    add(itemOrValue) {
        this.#handleSelect(itemOrValue);
    }

    remove(value) {
        const idx = this.#selected.findIndex(x => x.value === value);
        if (idx >= 0) {
            this.#selected.splice(idx, 1);
            this.#selectedValues.delete(value);
            const chip = this.#chipsContainer && this.#chipsContainer.querySelector(`.mm-chip[data-value="${String(value)}"]`);
            if (chip) chip.remove();
            this.dispatchEvent(new CustomEvent('chips-remove', { detail: { value }, bubbles: true }));
            this.dispatchEvent(new CustomEvent('chips-change', { detail: { values: this.getSelectedValues(), items: this.getSelectedItems() }, bubbles: true }));
        }
    }

    clearSelection() {
        this.#selected = [];
        this.#selectedValues.clear();
        if (this.#chipsContainer) this.#chipsContainer.innerHTML = '';
        this.dispatchEvent(new CustomEvent('chips-change', { detail: { values: [], items: [] }, bubbles: true }));
    }

    #readAttributes() {
        if (this.hasAttribute('item-label-key')) this.#itemLabelKey = this.getAttribute('item-label-key') || '';
        if (this.hasAttribute('item-value-key')) this.#itemValueKey = this.getAttribute('item-value-key') || '';
        if (this.hasAttribute('clear-on-select')) this.#clearOnSelect = (this.getAttribute('clear-on-select') === 'true');
        if (this.hasAttribute('max-chips')) {
            const v = parseInt(this.getAttribute('max-chips'));
            if (!Number.isNaN(v)) this.#maxChips = v;
        }
        if (this.hasAttribute('unique')) this.#unique = (this.getAttribute('unique') !== 'false');
        if (this.hasAttribute('chips-position')) {
            const pos = (this.getAttribute('chips-position') || '').toLowerCase();
            if (pos === 'below' || pos === 'above') this.#chipsPosition = pos;
        }
    }

    /**
     * Update chips container position at runtime.
     */
    setChipsPosition(position) {
        const pos = String(position || '').toLowerCase();
        if (pos !== 'above' && pos !== 'below') return;
        this.#chipsPosition = pos;
        const root = this.querySelector('.autocomplete-container');
        if (root && this.#chipsContainer && this.#chipsContainer.parentNode) {
            this.#chipsContainer.parentNode.removeChild(this.#chipsContainer);
            this.#chipsContainer.classList.remove('above', 'below');
            this.#chipsContainer.classList.add(pos);
            if (pos === 'below') root.parentNode.insertBefore(this.#chipsContainer, root.nextSibling);
            else root.parentNode.insertBefore(this.#chipsContainer, root);
        }
    }
}

if (!customElements.get('ui-autocomplete-chips')) {
    customElements.define('ui-autocomplete-chips', AutocompleteChipsComponent);
}


