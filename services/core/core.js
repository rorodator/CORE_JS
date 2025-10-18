import { Core_AjaxService } from "../api/core-ajax-service";
import { Core_ResourceService } from "../ui/core-resource-service";
import { Core_SemanticService } from "../ui/core-semantic-service";
import { Core_LogService } from "./core-log-service";
import { Core_DefaultService } from "./core-default-service";
import { Core_FilterFactoryService } from "../data/core-filter-factory-service";
import { Core_UtilService } from "../utils/core-util-service";
import { Core_LangService } from "../utils/core-lang-service";
import { Core_CartService } from "../data/core-cart-service";
import { Core_RouterService } from "./core-router-service";
import { Core_BrowserService } from "../ui/core-browser-service";
import { Core_ZipService } from "../utils/core-zip-service";

export class Core {
   /**
    * Holds the singleton instance of Core.
    * All services exposed by this object are available everywhere in the code.
    * @type {Core|null}
    */
   static #instance = null;

   #services;

   /**
    * Constructs the Core object and registers all available services.
    * Ensures singleton pattern.
    */
   constructor() {
      if (Core.#instance) {
         return Core.#instance;
      }
      // Initialize the services map and register all services
      this.#services = new Map();
      this.registerAllServices();

      // Bootstrap the page when loaded
      window.addEventListener('load', (event) => { this.bootstrap(); });

      Core.#instance = this;
   }

   /**
    * Registers all services provided by this central object.
    * If this method is overridden in child classes, the parent method should be called.
    */
   registerAllServices() {
      this.registerService('log', Core_LogService);
      this.registerService('ajax', Core_AjaxService);
      this.registerService('router', Core_RouterService);
      this.registerService('resource', Core_ResourceService);
      this.registerService('semantic', Core_SemanticService);
      this.registerService('default', Core_DefaultService);
      this.registerService('filterFactory', Core_FilterFactoryService);
      this.registerService('util', Core_UtilService);
      this.registerService('cart', Core_CartService);
      this.registerService('browser', Core_BrowserService);
      this.registerService('zip', Core_ZipService);
      this.registerService('lang', Core_LangService);
   }

   /**
    * Registers a specific service or overwrites an existing one.
    * @param {string} svcName The name of the service.
    * @param {Function} svcClass The class of the service.
    */
   registerService(svcName, svcClass) {
      this.#services.set(svcName, { class: svcClass, instance: null });
   }

   /**
    * Retrieves a service instance by its name.
    * Instantiates the service if it hasn't been created yet.
    * @param {string} svcName The name of the service.
    * @returns {*} The service instance.
    * @throws {Error} If the service is not found.
    */
   getService(svcName) {
      let svc = null;
      let svcData = this.#services.get(svcName);

      if (svcData) {
         if (svcData.instance === null) {
            svcData.instance = new svcData.class();
         }
         svc = svcData.instance;
      } else {
         throw new Error("Core service not found : [" + svcName + "]");
      }

      return svc;
   }

   /**
    * Method called when the page is displayed.
    * Should be overridden by child classes to perform bootstrap logic.
    */
   bootstrap() {
      // To be implemented by child classes if needed
   }
}

// To quick access a registered service without having to know about the Core class
window.$svc = function (svcName) {
   return $core?.getService(svcName);
}