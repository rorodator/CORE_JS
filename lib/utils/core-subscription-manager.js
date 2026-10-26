/**
 * Tracks RxJS subscriptions owned by one lifecycle owner (e.g. a {@link Core_HTMLElement})
 * and releases them on explicit teardown via {@link cleanSubs}.
 *
 * Teardown is deterministic only: there is no garbage-collection fallback. A subscription
 * callback that references its owner keeps that owner reachable from the source, so a
 * FinalizationRegistry could never fire while the subscription is still open.
 *
 * Subscriptions that close on their own (complete, error, or external unsubscribe) are
 * released immediately, so the manager never retains finished subscriptions.
 */
export class Core_SubscriptionManager {
   /** @type {Set<{ unsubscribe: Function }>} */
   #subs = new Set();

   /**
    * @param {*} [_owner] Kept for signature compatibility; the manager holds no reference to it.
    */
   constructor(_owner) {
   }

   /**
    * Registers a subscription owned by the manager's owner.
    * Already-closed subscriptions and values without `unsubscribe()` are returned untracked.
    *
    * @template T
    * @param {T} sub The subscription to own.
    * @returns {T} The same subscription.
    */
   addSub(sub) {
      if (!sub || typeof sub.unsubscribe !== 'function' || sub.closed === true) {
         return sub;
      }

      this.#subs.add(sub);
      if (typeof sub.add === 'function') {
         sub.add(() => this.#subs.delete(sub));
      }
      return sub;
   }

   /**
    * Unsubscribes every owned subscription. Idempotent; the manager stays usable afterwards
    * (an element that reconnects registers new subscriptions in `onConnect()`).
    */
   cleanSubs() {
      const subs = [...this.#subs];
      this.#subs.clear();

      subs.forEach((sub) => {
         try {
            sub.unsubscribe();
         } catch (e) {
            try { $svc('log').error(e); } catch (_) {}
         }
      });
   }

   /**
    * Number of currently open owned subscriptions.
    * @returns {number}
    */
   get size() {
      return this.#subs.size;
   }
}
