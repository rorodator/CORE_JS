import { Core_SubscriptionManager } from '../utils/core-subscription-manager';

export class Core_HTMLElement extends HTMLElement {
   #subManager;      // Manages automatic subscription deallocation
   #reuseMode;       // Indicates if the element is detached (not deleted) from the DOM

   /**
    * Constructor
    * Initializes the subscription manager and base properties.
    */
   constructor() {
      super();

      // Manages proper subscription cleanup when this object is destroyed
      this.#subManager = new Core_SubscriptionManager(this);

      // Optional: dedicated language container for this element
      this.langContainer = null;

      // By default, the element is deleted when removed from the DOM
      this.#reuseMode = false;
   }

   /**
    * Lifecycle callback: called when the element is connected to the DOM.
    * Triggers the onConnect hook unless in reuse mode.
    */
   connectedCallback() {
      if (this.#reuseMode === false) {
         this.onConnect();
      }
   }

   /**
    * Lifecycle callback: called when the element is disconnected from the DOM.
    * Triggers the onDisconnect hook, cleans up subscriptions and UI resources unless in reuse mode.
    */
   disconnectedCallback() {
      if (this.#reuseMode === false) {
         this.onDisconnect();
         this.#subManager.cleanSubs();
         this.cleanFunctional();
      }
   }

   /**
    * Registers a new subscription to be managed and cleaned up automatically.
    * @param {*} sub The subscription to add.
    * @returns {*} The added subscription.
    */
   addSub(sub) {
      return this.#subManager.addSub(sub);
   }

   /**
    * Builds or rebuilds the component UI.
    * Cleans up previous UI logic, renders the DOM, applies language processing, and sets up UI logic.
    */
   render() {
      this.cleanFunctional();
      this.ui_render();

      // If language management is enabled, process translations
      if ($svc('default').lang.isActivated) {
         $svc('lang').process(this);
      }

      this.ui_toFunctional();
   }

   /**
    * Cleans up memory and event listeners related to the UI.
    * Should be overridden in child classes if needed.
    */
   cleanFunctional() {
      // To be implemented by child classes if needed
   }

   /**
    * Renders the DOM structure of the component.
    * Should be overridden in child classes.
    */
   ui_render() {
      this.innerHTML = '';
   }

   /**
    * Applies functional logic to the newly built UI.
    * Should be overridden in child classes.
    */
   ui_toFunctional() {
   }

   //---------------------------
   // Hooks for child classes --
   //---------------------------

   /**
    * Hook: called when the component is connected to the DOM.
    * Should be overridden in child classes.
    */
   onConnect() { }

   /**
    * Hook: called when the component is disconnected from the DOM.
    * Should be overridden in child classes.
    */
   onDisconnect() {
   }

   /**
    * Detaches the element from the DOM without deleting it.
    * Sets reuse mode and triggers the onDetach hook.
    * @param {*} childScrolls Optional scroll state of children.
    */
   detach(childScrolls) {
      this.#reuseMode = true;
      this.onDetach();
   }

   /**
    * Hook: called when the component is detached.
    * Should be overridden in child classes.
    */
   onDetach() {
   }

   /**
    * Reattaches the element to the DOM, disables reuse mode, and triggers the onReattach hook.
    * @param {*} isRoot Optional flag indicating root attachment.
    */
   attach(isRoot) {
      this.#reuseMode = false;
      this.onReattach(isRoot);
   }

   /**
    * Hook: called when the component is reattached.
    * Should be overridden in child classes.
    * @param {*} isRoot Optional flag indicating root attachment.
    */
   onReattach(isRoot) {
   }

   /**
    * Forces the destruction of the element by disabling reuse mode and calling disconnectedCallback.
    */
   forceDestroy() {
      this.#reuseMode = false;
      this.disconnectedCallback();
   }

   /**
    * Returns whether the element is currently in reuse mode.
    * @returns {boolean} True if in reuse mode, false otherwise.
    */
   get isInReuseMode() {
      return this.#reuseMode;
   }
}