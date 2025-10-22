import { Core_HTMLElement } from "../../lib/base/core-html-element";

export class Core_RouterService {
   static router = null;    // The one instance for the one Router that can be instantiated
   static instance = null;  // Quick access to the local instance of the service  
   #rootPath;               // A constant used only to build the relative path 

   constructor() {
      // This is required to access the object in some static methods later on
      Core_RouterService.instance = this;

      // Init from repo
      this.#rootPath = $svc('default').router.rootPath;
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
            $(document).off('click', 'a', Core_RouterService.manageLink);

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

         // Intercept all clicks on links to route locally
         $(document).on('click', 'a', Core_RouterService.manageLink);

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
    * Ignores links with 'core-ignore' in the href.
    * @param {Event} event The click event.
    */
   static manageLink(event) {
      const target = event.target.closest('a');


      if (target && target.hasAttribute('href')) {

         let href = target.getAttribute('href');

         // href must be set on the a element
         if (href) {

            // http will always allow the link to work
            if (href.substring(0, 4).toLowerCase() === 'http') {
               window.location = href;
            }
            // Local link
            else {
               // Avoid the click to be handled by the browser default behavior
               event.preventDefault();

               // core-ignore is THE url to use for this Router not to handle the click
               if (!href.includes('core-ignore')) {
                  // Then process the page change
                  Core_RouterService.pushState(href);
               }
            }
         }
      }
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

   /**
    * Returns the absolute path for a given relative path, ensuring no duplicate slashes.
    * @param {string} relativePath The relative path to append.
    * @returns {string} The absolute path.
    */
   getAbsolutePath(relativePath) {
      // Remove trailing slash from rootPath if present
      let root = this.#rootPath.endsWith('/') ? this.#rootPath.slice(0, -1) : this.#rootPath;
      // Remove leading slash from relativePath if present
      let rel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      return `${root}/${rel}`;
   }
}