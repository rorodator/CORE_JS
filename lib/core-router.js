import { Core_HTMLElement } from 'CORE/lib/core-html-element';

/**
 * Contains everything that's required to manage a local Router
 */
export class Core_Router extends HTMLElement {
   #lastMatch;                // To remember completely last match, we never know...
   #lastEndPosition;          // To remember, in the URL, the position of the first character thas was not matched in the URL
   #currentRoute;             // Remember the route currently displayed
   #currentChild;             // Object currently used to display current route
   #defaultRouteIndex;        // If a default route is defined, when no URL is matched
   #isMain;                   // There can be only one !é
   #childRouters;             // All Sub Routers declared to this Routers
   #parentRouter;             // If this is a subRouter, we will remember the parent Router

   // All possible options to manage a route that's kept in the cache
   static keepRouteOptions = {
      DONT_KEEP: 0,
      KEEP_NONE: 1,
      KEEP_SCROLLS: 2
   };

   /**
    * Standard constructor
    */
   constructor() {
      // Always call parent constructor in an HTMLElement
      super();

      // No route registered at this stage
      this.routes = [];

      // By default, no route selected
      this.#currentRoute = null;
      this.#currentChild = null;
      this.#lastMatch = null;
      this.#defaultRouteIndex = -1;
      this.#childRouters = new Map();
      this.#parentRouter = null;

      // By default, this is no main Router
      this.#isMain = false;

      // For a quick recognizion, whatever the HTML final class
      this.setAttribute('data-core-isRouter', 'yes');
   }

   /**
 * Register a new route !
 * @param {Local URL to go to} url 
 * @param {the tag of the custom Object to use to render the chosen route} tag 
 */
   addRoute(routeParams) {

      // To add the new route, make sure it is properly setuo
      if ((routeParams['route'])
         && (routeParams['class'])) {

         // If this route is supposed to be the default one
         if (routeParams['isDefault'] === true) {
            this.#defaultRouteIndex = this.routes.length;
         }

         this.routes.push({ ...this.getBasicRouteParams(), ...routeParams });
      }
      // Incorrect description
      else {
         $svc('log').error('Cannot create a Route without a complete description');
      }
   }

   /**
    * Register several routes at once
    * @param {} routes 
    */
   addRoutes(routes) {
      routes.forEach((route, index, arr) => {
         this.addRoute(route);
      });
   }

   /**
    * To set the default params for a new route to be added
    */
   getBasicRouteParams() {
      return {
         keepRouteOption: Core_Router.keepRouteOptions.DONT_KEEP,
         memory: {
            URL: null,
            object: null,
            parentScroll: null,
            childrenAttributes: null
         }
      };
   }

   /**
    * The method used to do the routing itself, based on the object "config" 
    * @param {*} url - never required for main Router, but pretty much needed for sub routers 
    */
   route(paramURL = null) {

      console.log('in route : ' + paramURL);

      // Use the URL passed as parameter, or window.location by default
      const url = paramURL ?? window.location.href;

      let matches = [];
      let routeFound = false;

      // Then try to resolve the path using all registered entries
      this.routes.every((routeDesc, index, array) => {
         let regExp = new RegExp(routeDesc.route, 'i');

         // We found the proper candidate
         if (matches = regExp.exec(url)) {

            // We have to do something only if the match changed
            if (matches[0] != this.#lastMatch) {
               this.#lastMatch = matches[0];
               this.#lastEndPosition = matches.index;

               // Created element not interested in the matched URL but in its parameters
               matches.shift();

               // Let's move the route we've found
               this.processRouteFound(this.#lastMatch, routeDesc, matches);
               routeFound = true;

               // Stop the loop
               return false;
            }
         }

         return true;
      });

      // No route found matching the URL, but a default route can be proposed
      if ((!routeFound)
         && (this.#defaultRouteIndex >= 0)) {
         this.processRouteFound(url, this.routes[this.#defaultRouteIndex]);
      }
   }

   /**
    * When a valid route is found for display, this method does the job.
    * Handles component reuse, cache, scroll restoration, and DOM updates.
    * @param {*} url The URL that matched.
    * @param {*} routeDesc The route descriptor.
    * @param {*} params Optional parameters extracted from the URL.
    */
   processRouteFound(url, routeDesc, params = null) {

      console.log('dans processRouteFound ' + url + ', ' + routeDesc.route);

      // Remove previously attached child, if any
      if (this.#currentRoute !== null) {

         let kro = this.#currentRoute.keepRouteOption;

         // If we have to keep currently displayed object in cache
         if (kro !== Core_Router.keepRouteOptions.DONT_KEEP) {

            // Object used to display current route must be kept
            this.#currentRoute.memory.object = this.#currentChild;

            // If some attributes must be kept to be restore when used again
            if (kro != Core_Router.keepRouteOptions.KEEP_NONE) {

               // If we must keep scrolls, we also keep the parent scroll status
               if (kro | Core_Router.keepRouteOptions.KEEP_SCROLLS) {
                  this.saveParentScroll();
               }

               // Here we store children attributes to save
               this.#currentRoute.memory.childrenAttributes = new Map();
               this.detachChild(this.#currentChild);
            }
            // No need to keep anything in this situation
            else {
               this.#currentRoute.memory.parentScroll = null;
               this.#currentRoute.memory.childrenAttributes = null;
            }
         }
         else {
            this.#currentRoute.memory.object = null;
            this.#currentRoute.memory.parentScroll = null;
            this.#currentRoute.memory.childrenAttributes = null;
         }

         // Finally remove the object from the display
         this.removeChild(this.#currentChild);
         this.#currentChild = null;
      }

      // Now move to the new page
      this.#currentRoute = routeDesc;

      // Now decide which component to use to render the new route
      // Instantiate a new component or re-use from cache
      let componentReused = false;

      // If we have an object to possibly use for reuse
      if (routeDesc.memory.object !== null) {
         // Here we reuse because URLs match
         if (routeDesc.memory.URL === url) {

            this.#currentChild = routeDesc.memory.object;
            componentReused = true;
         }
         // We can't reuse because the URL changed
         else {
            // To clean everything we have to in the cache
            for (const [node, data] of routeDesc.memory.childrenAttributes?.entries() || []) {
               if (node instanceof Core_HTMLElement) {
                  node.forceDestroy();
               }
            }

            // We will create a new component for display
            this.#currentChild = new routeDesc.class(params);
         }
      }
      // We need a new component because there was nothing in cache
      else {
         // Create it from config
         this.#currentChild = new routeDesc.class(params);
      }

      // Display the new page
      this.appendChild(this.#currentChild);

      // If needed, remove the reusability function
      if (componentReused) {

         // Awaken children elements
         this.attachChild(this.#currentChild);

         // We may have to restore parent attributes
         if (routeDesc.memory.parentScroll !== null) {
            routeDesc.memory.parentScroll.element.scrollTop = routeDesc.memory.parentScroll.scrollTop;
            routeDesc.memory.parentScroll.element.scrollLeft = routeDesc.memory.parentScroll.scrollLeft;
         }
      }

      // Set memory info for next location change
      routeDesc.memory.URL = url;
      routeDesc.memory.object = null;
      routeDesc.memory.parentScroll = null;
      routeDesc.memory.childrenAttributes = null;
      
      // Emit routeChanged event for components that need to react to route changes
      const routeChangedEvent = new CustomEvent('routeChanged', {
         detail: {
            route: routeDesc.route,
            url: url,
            params: params
         }
      });
      document.dispatchEvent(routeChangedEvent);
   }

   /**
    * When we remember the scrolls for next use, we remember also the router's parent node.
    * Finds the closest scrollable parent and saves its scroll position.
    */
   saveParentScroll() {

      // Find the router parent and the scroll
      let parent = this.parentElement;
      let found = false;

      while ((parent)
         && (!found)) {

         if ($svc('browser').isElementScrollable(parent)) {
            this.#currentRoute.memory.parentScroll = {
               element: parent,
               scrollTop: parent.scrollTop,
               scrollLeft: parent.scrollLeft
            };
            found = true;
         }

         parent = parent.parentElement;
      }

      // No scrollable parent found, let's look at the highest level
      if (!found) {
         const scrollableElement = (document.documentElement.scrollHeight > document.documentElement.clientHeight)
            ? document.documentElement
            : document.body;

         this.#currentRoute.memory.parentScroll = {
            element: scrollableElement,
            scrollTop: scrollableElement.scrollTop,
            scrollLeft: scrollableElement.scrollLeft
         };
      }
   }

   /**
    * This method is used to both warn children about detachment to come soon,
    * but also to save specific attributes when required
    */
   detachChild(elt) {

      // We only care about HTMLElement or inherited classes
      if (elt instanceof HTMLElement) {
         // First manage our custom Elements
         if (elt instanceof Core_HTMLElement) {
            elt.detach();
         }
         else if (this.#currentRoute.keepRouteOption !== Core_Router.keepRouteOptions.DONT_KEEP) {
            this.saveChildAttributes(elt);
         }

         // Then proceed for all children
         elt.childNodes.forEach((child, key, parent) => {
            this.detachChild(child);
         });
      }
   }

   /**
    * Method called to save whatever requested attributes based on config.
    * Can be enriched/overloaded in children classes
    */
   saveChildAttributes(elt) {
      if ((this.#currentRoute.keepRouteOption | Core_Router.keepRouteOptions.KEEP_SCROLLS)
         && ($svc('browser').isElementScrollable(elt))) {
         if (!this.#currentRoute.memory.childrenAttributes.has(elt)) {
            this.#currentRoute.memory.childrenAttributes.set(elt, {});
         }

         this.#currentRoute.memory.childrenAttributes.get(elt).scroll = {
            scrollTop: elt.scrollTop,
            scrollLeft: elt.scrollLeft
         }
      }
   }

   /**
    * This method is used to both warn children about re-attachment
    * but also to save specific attributes when required
    */
   attachChild(elt, isRoot = true) {

      // We only care about HTMLElement or inherited classes
      if (elt instanceof HTMLElement) {
         // First manage our custom Elements
         if (elt instanceof Core_HTMLElement) {
            elt.attach(isRoot);
         }
         else if (this.#currentRoute.keepRouteOption !== Core_Router.keepRouteOptions.DONT_KEEP) {
            this.restoreChildAttributes(elt);
         }

         // Then proceed for all children
         elt.childNodes.forEach((child, key, parent) => {
            this.attachChild(child, false);
         });
      }
   }

   /**
    * Method called to save whatever requested attributes based on config.
    * Can be enriched/overloaded in children classes
   */
   restoreChildAttributes(elt) {
      // If data was saved for this element, we get them
      let eltData = this.#currentRoute.memory.childrenAttributes.get(elt);

      // Manage scroll data restore
      if ((eltData)
         && (this.#currentRoute.keepRouteOption | Core_Router.keepRouteOptions.KEEP_SCROLLS)) {
         elt.scrollTop = eltData.scroll.scrollTop;
         elt.scrollLeft = eltData.scroll.scrollLeft;
      }
   }



   /**
    * When the Router is added to the page, some hooks must be placed on the page so that it's enabled seemlessly
    */
   connectedCallback() {
      // Register this instance to the Router service
      // Note that this assignation lauches a lot of mappings behind the scene in Core_Router
      if (this.#isMain) {
         $svc('router').router = this;
      } else {
         this.registerToParentRouter();
      }

      // Doing the job
      this.route();
   }

   /**
    * For this object to declare to its parent router
    */
   registerToParentRouter() {
      this.#parentRouter = this.closest('[data-core-isRouter="yes"]');

      if (this.#parentRouter) {
         this.#parentRouter.registerChildRouter(this);
      }
   }

   /**
    * For a child Router to register to this "parent" Router
    * @param {*} childRouter 
    */
   registerChildRouter(childRouter) {
      this.#childRouters.set(childRouter, 1);
   }

   /**
    * If the Router is pushed out of the page, the hooks used for it to work can be released
    */
   disconnectedCallback() {
      // Warn the routing service that the instance is deleted
      // Once again, a lot is done behind the scene in Core_Router
      if (this.#isMain) {
         $svc('router').router = null;
      } else if (this.#parentRouter) {
         this.#parentRouter.unregisterFromParentRouter();
      }
   }

   /**
    * For this to unregister from parent router
    */
   unregisterFromParentRouter() {
      if (this.#parentRouter) {
         this.#parentRouter.unregisterChildRouter(this);
      }
   }

   /**
    * For a child Router to unregister from this "parent" Router
    * @param {} childRouter 
    */
   unregisterChildRouter(childRouter) {
      this.#childRouters.delete(childRouter);
   }

   /**
    * If a Router claims it's the main one, then it must register to the Routing service
    */
   set isMain(isMain) {
      this.#isMain = isMain;

      if (this.#isMain) {
         Core_Router.router = this;
      }
   }
}

customElements.define('core-router', Core_Router);