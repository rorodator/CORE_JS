import { Observable } from 'rxjs';

/**
 * Returns a frozen, subscribe-only view of `source` for public component outputs.
 *
 * Prefer this over `subject.asObservable()`: RxJS sets `source` on the returned Observable,
 * which lets any consumer reach the private Subject and call `next()` / `complete()` on it.
 * Here the Subject is only captured in a closure.
 *
 * @template T
 * @param {import('rxjs').Observable<T>} source Usually a private Subject owned by the producer.
 * @returns {import('rxjs').Observable<T>}
 */
export function readonlyObservable(source) {
   return Object.freeze(new Observable((subscriber) => source.subscribe(subscriber)));
}
