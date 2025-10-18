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

      // Ensure all subscriptions are automatically disconnected when the client is garbage collected
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
      // Unsubscribe all open subscriptions
      this.#subs.every((value) => value.unsubscribe());
   }

   /**
    * FinalizationRegistry to automatically clean up subscriptions
    * when the client object is garbage collected.
    */
   static finalizationRegistry = new FinalizationRegistry(
      (resource) => resource.cleanSubs()
   );
}