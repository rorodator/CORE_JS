import { Core_HTMLElement } from "../../lib/base/core-html-element.js";

export class Core_RouterService {
   static router = null;    // The one instance for the one Router that can be instantiated
   static instance = null;  // Quick access to the local instance of the service  

   constructor() {
      // This is required to access the object in some static methods later on
      Core_RouterService.instance = this;
   }

   /**
    * Registers or unregisters the main router instance.
    * Throws an Error if trying to register more than one router.
    * @param {Core_HTMLElement|null} router The router instance to register, or null to unregister.
    * @throws {Error} If trying to register two different routers.
    */
   set router(router) {
      const registeredRouter = Core_RouterService.router;

      // A router was registered but needs to be unregistered
      if (registeredRouter !== null) {
         if (router === null) {
            // Remove the previously registered instance
            Core_RouterService.router = null;

            // Stop intercepting clicks on links to restore the browser freedom
            document.removeEventListener('click', Core_RouterService.manageLink);

            // Stop intercepting Prev/Next actions on the browser
            window.removeEventListener('popstate', Core_RouterService.forceRoute);
         } else {
            throw new Error('Trying to register two different routers in Core_RouterService');
         }
      }
      // No router registered so far, the proposed router is valid, let's associate it
      else if (router !== null) {

         // Set this valid instance
         Core_RouterService.router = router;

         // Intercept all clicks on links to route locally (delegated via closest('a') in manageLink)
         document.addEventListener('click', Core_RouterService.manageLink);

         // Manage Prev/Next actions on the browser
         window.addEventListener('popstate', Core_RouterService.forceRoute);
      }
   }

   /**
    * A static method to manage the router navigation history. Static because possibly called by another static method
    * @param {string} url The URL to push to the browser history.
    * @throws {Error} If no router object is available.
    */
   static pushState(url) {
      if (Core_RouterService.router !== null) {

         if (url === '') {
            url = $svc('default').router.emptyURL;
         }

         // Use relative URL directly to avoid rootPath issues
         // This is more portable and works regardless of the deployment environment
         const relativeUrl = url.startsWith('/') ? url : '/' + url;
         
         // Manage the browser history with relative URL
         history.pushState(null, '', relativeUrl);

         // Then do the routing
         Core_RouterService.router.route();
      }
      else {
         throw new Error('Calling Core_RouterService::pushState whilst no router object available');
      }
   }

   /**
    * Provide the Site with a method to move to a new URL without clicking on a link.
    * A kind of wrapper around window.location
    * @param {string} url The URL to navigate to.
    */
   goTo(url) {
      // If a valid router object was registered
      if (Core_RouterService.router !== null) {

         if (url === '') {
            url = $svc('default').router.emptyURL;
         }

         // If no Router active, then simply change the browser location for the user to surf
         Core_RouterService.pushState(url);
      }
      // No router available, just move to the desired url 
      else {
         window.location = url;
      }
   }

   /**
    * Manage clicks on a link when a Router is active.
    * Bypasses modifier clicks, external/special URLs, and links marked with data-core-ignore-router.
    * @param {Event} event The click event.
    */
   static manageLink(event) {
      const anchor = event.target.closest('a');

      if (!anchor || !anchor.hasAttribute('href')) {
         return;
      }

      const href = anchor.getAttribute('href');
      if (!href) {
         return;
      }

      if (Core_RouterService.#shouldBypassRouter(event, anchor, href)) {
         return;
      }

      event.preventDefault();
      Core_RouterService.pushState(href);
   }

   /**
    * @param {Event} event
    * @param {HTMLAnchorElement} anchor
    * @param {string} href
    * @returns {boolean}
    */
   static #shouldBypassRouter(event, anchor, href) {
      if (event.defaultPrevented) {
         return true;
      }

      if (event.button !== 0) {
         return true;
      }

      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
         return true;
      }

      if (anchor.hasAttribute('data-core-ignore-router')) {
         return true;
      }

      if (anchor.hasAttribute('download')) {
         return true;
      }

      const target = (anchor.getAttribute('target') || '').toLowerCase();
      if (target === '_blank' || target === '_new') {
         return true;
      }

      return Core_RouterService.#isExternalOrSpecialHref(href);
   }

   /**
    * @param {string} href
    * @returns {boolean}
    */
   static #isExternalOrSpecialHref(href) {
      const trimmed = href.trim();
      if (!trimmed) {
         return true;
      }

      if (trimmed.startsWith('#')) {
         return true;
      }

      const lower = trimmed.toLowerCase();
      const specialProtocols = [
         'mailto:', 'tel:', 'sms:', 'fax:', 'javascript:', 'data:', 'blob:', 'file:', 'ftp:'
      ];

      for (const protocol of specialProtocols) {
         if (lower.startsWith(protocol)) {
            return true;
         }
      }

      if (lower.startsWith('//')) {
         return true;
      }

      return lower.startsWith('http://') || lower.startsWith('https://');
   }

   /**
    * Method called to tell the active Router, if any, to react when browser Prev/Next action is played.
    * @throws {Error} If no router object is available.
    */
   static forceRoute() {
      if (Core_RouterService.router !== null) {
         Core_RouterService.router.route();
      } else {
         throw new Error('Calling Core_RouterService::forceRoute whilst no router object available');
      }
   }
}