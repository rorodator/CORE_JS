/**
 * Tracks RxJS subscriptions for a client object and cleans them up on explicit
 * lifecycle teardown (e.g. {@link Core_HTMLElement} disconnectedCallback).
 * FinalizationRegistry is a safety net only — callers must invoke cleanSubs().
 */
export class Core_SubscriptionManager {
   // All open subscriptions are stored here
   #subs;

   // The object using this Manager must be known
   #client;

   /**
    * Constructor
    * @param {*} client The object that owns this subscription manager.
    */
   constructor(client) {
      this.#client = client;
      this.#subs = [];

      Core_SubscriptionManager.finalizationRegistry.register(client, this);
   }

   /**
    * Registers a subscription to be managed and cleaned up automatically.
    * @param {*} sub The subscription to add.
    * @returns {*} The added subscription.
    */
   addSub(sub) {
      this.#subs.push(sub);
      return sub;
   }

   /**
    * Unsubscribes from all managed subscriptions.
    * Should be called when the client is destroyed or disconnected.
    */
   cleanSubs() {
      this.#subs.forEach((sub) => {
         try {
            if (sub && typeof sub.unsubscribe === 'function') {
               sub.unsubscribe();
            }
         } catch (e) {
            try { $svc('log').error(e); } catch (_) {}
         }
      });

      this.#subs = [];
      Core_SubscriptionManager.finalizationRegistry.unregister(this.#client);
   }

   /**
    * Safety net when explicit cleanSubs() was never called before GC.
    * Do not rely on this for deterministic teardown.
    */
   static finalizationRegistry = new FinalizationRegistry(
      (resource) => resource.cleanSubs()
   );
}