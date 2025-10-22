import { Core_HBSElement } from '../../../lib/base/core-hbs-element.js';
import template from './template.hbs';

/**
 * Generic Autocomplete Component for Semantic UI
 * Provides autocomplete functionality with customizable data sources
 */
export class AutocompleteComponent extends Core_HBSElement {
    
    /**
     * Component configuration
     */
    #config = {
        placeholder: 'Type to search...',
        // i18n bindings (optional)
        placeholderContainer: '',
        placeholderKey: '',
        labelText: '',
        labelContainer: '',
        labelKey: '',
        minCharacters: 3,
        delay: 300,
        maxResults: 10,
        showNoResults: true,
        allowAdditions: false,
        forceSelection: false,
        clearable: false,
        loading: false,
        // No-results i18n
        noResultsText: 'No results',
        noResultsContainer: '',
        noResultsKey: ''
    };
    
    /**
     * Data source for autocomplete
     */
    #dataSource = null;
    
    /**
     * Current search results
     */
    #results = [];
    
    /**
     * Search timeout reference
     */
    #searchTimeout = null;
    
    /**
     * Latest language labels repository
     */
    #labelsRepo = null;
    
    /**
     * Pre-configuration defaults to be applied before HTML attributes
     */
    #preConfig = null;
    
    /**
     * Initialize the autocomplete component
     */
    constructor() {
        super(template);
    }
    
    /**
     * Setup component attributes from HTML
     */
    setupAttributes() {
        // Get configuration from attributes
        if (this.hasAttribute('placeholder')) {
            this.#config.placeholder = this.getAttribute('placeholder');
        }
        if (this.hasAttribute('placeholder-container')) {
            this.#config.placeholderContainer = this.getAttribute('placeholder-container');
        }
        if (this.hasAttribute('placeholder-key')) {
            this.#config.placeholderKey = this.getAttribute('placeholder-key');
        }
        if (this.hasAttribute('label')) {
            this.#config.labelText = this.getAttribute('label');
        }
        if (this.hasAttribute('label-container')) {
            this.#config.labelContainer = this.getAttribute('label-container');
        }
        if (this.hasAttribute('label-key')) {
            this.#config.labelKey = this.getAttribute('label-key');
        }
        if (this.hasAttribute('min-characters')) {
            this.#config.minCharacters = parseInt(this.getAttribute('min-characters'));
        }
        if (this.hasAttribute('delay')) {
            this.#config.delay = parseInt(this.getAttribute('delay'));
        }
        if (this.hasAttribute('max-results')) {
            this.#config.maxResults = parseInt(this.getAttribute('max-results'));
        }
        if (this.hasAttribute('allow-additions')) {
            this.#config.allowAdditions = this.getAttribute('allow-additions') === 'true';
        }
        if (this.hasAttribute('force-selection')) {
            this.#config.forceSelection = this.getAttribute('force-selection') === 'true';
        }
        if (this.hasAttribute('clearable')) {
            this.#config.clearable = this.getAttribute('clearable') === 'true';
        }
        if (this.hasAttribute('no-results')) {
            this.#config.noResultsText = this.getAttribute('no-results');
        }
        if (this.hasAttribute('no-results-container')) {
            this.#config.noResultsContainer = this.getAttribute('no-results-container');
        }
        if (this.hasAttribute('no-results-key')) {
            this.#config.noResultsKey = this.getAttribute('no-results-key');
        }
    }
    
    /**
     * Called when component is connected to DOM
     */
    onConnect() {
        // Apply pre-configuration defaults first (if any)
        if (this.#preConfig) {
            Object.assign(this.#config, this.#preConfig);
        }
        // Apply HTML attributes (override pre-config)
        this.setupAttributes();
        // Render with resolved config
        this.render();
        // Language subscription last (will re-apply labels)
        this.setupLangSubscription();
    }
    
    /**
     * Applies functional logic to the newly built UI
     */
    ui_toFunctional() {
        this.initializeAutocomplete();
        this.setupEventHandlers();
        this.applyI18nLabels();
    }
    
    /**
     * Initialize Semantic UI autocomplete
     */
    initializeAutocomplete() {
        const container = this.querySelector('.ui.search');
        if (!container) return;
        const input = this.querySelector('.ui.search input');
        // Ensure previous instances are destroyed to avoid stale API settings
        try { if (input && $(input).data('search')) { $(input).search('destroy'); } } catch (_) {}
        try { if ($(container).data('search')) { $(container).search('destroy'); } } catch (_) {}
        
        // Initialize Semantic UI search on the container (not the input)
        $(container).search({
            type: 'standard',
            minCharacters: this.#config.minCharacters,
            maxResults: this.#config.maxResults,
            showNoResults: this.#config.showNoResults,
            allowAdditions: this.#config.allowAdditions,
            forceSelection: this.#config.forceSelection,
            clearable: this.#config.clearable,
            cache: false,
            apiSettings: false,
            source: [],
            searchFields: ['title','description','name','text'],
            fields: { results: 'results', title: 'title', description: 'description', url: 'url' },
            messages: {
                noResults: this.#config.noResultsText
            },
            onSelect: (result) => {
                this.handleSelection(result);
            },
            onResults: (response) => {
                this.handleResults(response);
            },
            onResultsAdd: (html) => {
                this.handleResultsAdd(html);
            },
            onSearchQuery: (query) => {
                this.handleSearchQuery(query);
            },
            onSearchChange: (query, data) => {
                this.handleSearchChange(query, data);
            },
            onResultsOpen: () => {
                this.handleResultsOpen();
            },
            onResultsClose: () => {
                this.handleResultsClose();
            }
        });
    }

    /**
     * Public configure method to override component config at runtime
     * Applies supported settings to the underlying Semantic UI instance
     * @param {Object} options
     */
    configure(options) {
        if (!options || typeof options !== 'object') {
            return;
        }

        const overridableKeys = Object.keys(this.#config);
        let shouldUpdateSemantic = false;

        for (const [key, value] of Object.entries(options)) {
            if (overridableKeys.includes(key)) {
                this.#config[key] = value;
                if (
                    key === 'minCharacters' ||
                    key === 'maxResults' ||
                    key === 'showNoResults' ||
                    key === 'allowAdditions' ||
                    key === 'forceSelection' ||
                    key === 'clearable'
                ) {
                    shouldUpdateSemantic = true;
                }
            }
        }

        // Re-apply labels/placeholders and no-results i18n if relevant keys changed
        this.applyI18nLabels();

        // Update Semantic UI instance settings if needed
        if (shouldUpdateSemantic) {
            const container = this.querySelector('.ui.search');
            if (container) {
                $(container).search('setting', 'minCharacters', this.#config.minCharacters);
                $(container).search('setting', 'maxResults', this.#config.maxResults);
                $(container).search('setting', 'showNoResults', this.#config.showNoResults);
                $(container).search('setting', 'allowAdditions', this.#config.allowAdditions);
                $(container).search('setting', 'forceSelection', this.#config.forceSelection);
                $(container).search('setting', 'clearable', this.#config.clearable);
                $(container).search('setting', 'messages', { noResults: this.#config.noResultsText });
            }
        }
    }

    /**
     * Subscribe to language changes to update dynamic labels
     */
    setupLangSubscription() {
        this.addSub(
            $svc('lang').getData().subscribe((labels) => {
                this.#labelsRepo = labels;
                this.applyI18nLabels();
            })
        );
    }

    /**
     * Set default configuration before initialization. These values
     * are merged BEFORE HTML attributes and can be overridden by them.
     * Use configure() for runtime changes after initialization.
     * @param {Object} options
     */
    preConfigure(options) {
        if (!options || typeof options !== 'object') return;
        this.#preConfig = { ...(this.#preConfig || {}), ...options };
    }

    /**
     * Apply dynamic i18n labels (placeholder and optional label)
     */
    applyI18nLabels() {
        const repo = this.#labelsRepo;

        // Resolve placeholder
        let placeholderText = this.#config.placeholder;
        if (repo && this.#config.placeholderContainer && this.#config.placeholderKey) {
            const container = repo[this.#config.placeholderContainer] || {};
            placeholderText = container[this.#config.placeholderKey] || placeholderText;
        }

        const input = this.querySelector('.ui.search input');
        if (input && placeholderText) {
            input.setAttribute('placeholder', placeholderText);
        }

        // Resolve label text
        let labelText = this.#config.labelText;
        if (repo && this.#config.labelContainer && this.#config.labelKey) {
            const container = repo[this.#config.labelContainer] || {};
            labelText = container[this.#config.labelKey] || labelText;
        }

        // Inject or update label node if labelText exists
        const containerDiv = this.querySelector('.autocomplete-container');
        if (containerDiv) {
            let labelNode = containerDiv.querySelector('.mm-autocomplete-label');
            if (labelText) {
                if (!labelNode) {
                    labelNode = document.createElement('label');
                    labelNode.className = 'mm-autocomplete-label';
                    containerDiv.insertBefore(labelNode, containerDiv.firstChild);
                }
                labelNode.textContent = labelText;
            } else if (labelNode) {
                labelNode.remove();
            }
        }

        // Resolve no-results text and update Semantic messages live
        let noResultsText = this.#config.noResultsText;
        if (repo && this.#config.noResultsContainer && this.#config.noResultsKey) {
            const noResContainer = repo[this.#config.noResultsContainer] || {};
            noResultsText = noResContainer[this.#config.noResultsKey] || noResultsText;
            this.#config.noResultsText = noResultsText;
        }
        const searchContainer = this.querySelector('.ui.search');
        if (searchContainer) {
            $(searchContainer).search('setting', 'messages', { noResults: noResultsText });
        }
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        const input = this.querySelector('.ui.search input');
        if (!input) return;
        
        // Handle input changes with debouncing
        input.addEventListener('input', (e) => {
            this.handleInputChange(e.target.value);
        });
        
        // Handle focus events
        input.addEventListener('focus', () => {
            this.handleFocus();
        });
        
        // Handle blur events
        input.addEventListener('blur', () => {
            this.handleBlur();
        });
    }
    
    /**
     * Handle input change with debouncing
     */
    handleInputChange(value) {
        // Clear existing timeout
        if (this.#searchTimeout) {
            clearTimeout(this.#searchTimeout);
        }
        
        // Set new timeout
        this.#searchTimeout = setTimeout(() => {
            this.performSearch(value);
        }, this.#config.delay);
    }
    
    /**
     * Perform search with data source
     */
    async performSearch(query) {
        
        if (!query || query.length < this.#config.minCharacters) {
            this.clearResults();
            return;
        }
        
        this.setLoading(true);
        
        try {
            let results = [];
            
            if (this.#dataSource) {
                if (typeof this.#dataSource === 'function') {
                    const sourceResult = this.#dataSource(query);
                    
                    // Check if it's an Observable (has subscribe method)
                    if (sourceResult && typeof sourceResult.subscribe === 'function') {
                        // Handle Observable
                        sourceResult.subscribe({
                            next: (data) => {
                                
                                // Format data for Semantic UI (needs { results: [...] })
                                results = {
                                    results: data
                                };
                                this.updateResults(results);
                            },
                            error: () => {
                                this.updateResults({ results: [] });
                            }
                        });
                        return; // Exit early for Observable handling
                    } else {
                        // Handle Promise
                        results = await sourceResult;
                    }
                } else if (Array.isArray(this.#dataSource)) {
                    results = this.filterArrayData(this.#dataSource, query);
                }
            } else {
                
            }
            
            this.updateResults(results);
        } catch (error) {
            this.updateResults([]);
        } finally {
            this.setLoading(false);
        }
    }
    
    /**
     * Filter array data based on query
     */
    filterArrayData(data, query) {
        const lowerQuery = query.toLowerCase();
        return data
            .filter(item => {
                const text = this.getItemText(item).toLowerCase();
                return text.includes(lowerQuery);
            })
            .slice(0, this.#config.maxResults);
    }
    
    /**
     * Get text representation of an item
     */
    getItemText(item) {
        if (typeof item === 'string') {
            return item;
        }
        if (typeof item === 'object' && item.text) {
            return item.text;
        }
        if (typeof item === 'object' && item.title) {
            return item.title;
        }
        if (typeof item === 'object' && item.name) {
            return item.name;
        }
        return String(item);
    }
    
    /**
     * Update search results
     */
    updateResults(results) {
        // Normalize to array for internal cache
        const resultsArray = results && results.results ? results.results : results;
        this.#results = Array.isArray(resultsArray) ? resultsArray : [];
        const container = this.querySelector('.ui.search');
        if (container) {
            // Push local data and display results
            $(container).search('setting', 'source', this.#results);
            $(container).search('clear cache');
            $(container).search('show results');
        } else {
            // no-op if container missing
        }
    }
    
    /**
     * Clear search results
     */
    clearResults() {
        this.#results = [];
        const container = this.querySelector('.ui.search');
        if (container) {
            $(container).search('clear results');
        }
    }
    
    /**
     * Set loading state
     */
    setLoading(loading) {
        this.#config.loading = loading;
        const container = this.querySelector('.ui.search');
        if (container) {
            if (loading) {
                $(container).search('show loading');
            } else {
                $(container).search('hide loading');
            }
        }
    }
    
    /**
     * Handle selection event
     */
    handleSelection(result) {
        this.dispatchEvent(new CustomEvent('autocomplete-select', {
            detail: { result },
            bubbles: true
        }));
    }
    
    /**
     * Handle results event
     */
    handleResults(response) {
        this.dispatchEvent(new CustomEvent('autocomplete-results', {
            detail: { response },
            bubbles: true
        }));
    }
    
    /**
     * Handle results add event
     */
    handleResultsAdd(html) {
        this.dispatchEvent(new CustomEvent('autocomplete-results-add', {
            detail: { html },
            bubbles: true
        }));
    }
    
    /**
     * Handle search query event
     */
    handleSearchQuery(query) {
        this.dispatchEvent(new CustomEvent('autocomplete-search', {
            detail: { query },
            bubbles: true
        }));
    }
    
    /**
     * Handle search change event
     */
    handleSearchChange(query, data) {
        this.dispatchEvent(new CustomEvent('autocomplete-change', {
            detail: { query, data },
            bubbles: true
        }));
    }
    
    /**
     * Handle results open event
     */
    handleResultsOpen() {
        this.dispatchEvent(new CustomEvent('autocomplete-open', {
            bubbles: true
        }));
    }
    
    /**
     * Handle results close event
     */
    handleResultsClose() {
        this.dispatchEvent(new CustomEvent('autocomplete-close', {
            bubbles: true
        }));
    }
    
    /**
     * Handle focus event
     */
    handleFocus() {
        this.dispatchEvent(new CustomEvent('autocomplete-focus', {
            bubbles: true
        }));
    }
    
    /**
     * Handle blur event
     */
    handleBlur() {
        this.dispatchEvent(new CustomEvent('autocomplete-blur', {
            bubbles: true
        }));
    }
    
    /**
     * Get mock response for Semantic UI
     */
    getMockResponse() {
        return {
            results: this.#results.map(item => ({
                title: this.getItemText(item),
                description: this.getItemDescription(item),
                value: this.getItemValue(item)
            }))
        };
    }
    
    /**
     * Get description of an item
     */
    getItemDescription(item) {
        if (typeof item === 'object' && item.description) {
            return item.description;
        }
        return '';
    }
    
    /**
     * Get value of an item
     */
    getItemValue(item) {
        if (typeof item === 'object' && item.value) {
            return item.value;
        }
        return this.getItemText(item);
    }
    
    /**
     * Set data source for autocomplete
     */
    setDataSource(dataSource) {
        this.#dataSource = dataSource;
    }
    
    /**
     * Get current value
     */
    getValue() {
        const input = this.querySelector('.ui.search input');
        return input ? input.value : '';
    }
    
    /**
     * Set current value
     */
    setValue(value) {
        const container = this.querySelector('.ui.search');
        const input = this.querySelector('.ui.search input');
        if (input) input.value = value;
        if (container) {
            $(container).search('set value', value);
        }
    }
    
    /**
     * Clear the input
     */
    clear() {
        const container = this.querySelector('.ui.search');
        const input = this.querySelector('.ui.search input');
        if (input) input.value = '';
        if (container) {
            $(container).search('clear');
        }
    }
    
    /**
     * Focus the input
     */
    focus() {
        const input = this.querySelector('.ui.search input');
        if (input) {
            input.focus();
        }
    }
    
    /**
     * Blur the input
     */
    blur() {
        const input = this.querySelector('.ui.search input');
        if (input) {
            input.blur();
        }
    }
    
    /**
     * Enable the autocomplete
     */
    enable() {
        const input = this.querySelector('.ui.search input');
        if (input) {
            input.disabled = false;
        }
    }
    
    /**
     * Disable the autocomplete
     */
    disable() {
        const input = this.querySelector('.ui.search input');
        if (input) {
            input.disabled = true;
        }
    }
}

// Register the custom element
if (!customElements.get('ui-autocomplete')) {
    customElements.define('ui-autocomplete', AutocompleteComponent);
}
