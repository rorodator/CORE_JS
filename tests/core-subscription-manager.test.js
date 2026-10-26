import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import v8 from 'node:v8';
import vm from 'node:vm';
import { BehaviorSubject, Subject, of, take } from 'rxjs';
import { Core_SubscriptionManager } from '../lib/utils/core-subscription-manager.js';
import { bootCore } from './support/platform-harness.mjs';

v8.setFlagsFromString('--expose_gc');
const gc = /** @type {() => void} */ (vm.runInNewContext('gc'));

/** Lets WeakRef targets from previous jobs become collectable, then forces GC. */
async function collectGarbage() {
    for (let i = 0; i < 5; i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        gc();
    }
}

/** @type {unknown[]} */
let logged;

beforeEach(() => {
    const core = bootCore();
    logged = [];
    core.registerService('log', class {
        error(payload) {
            logged.push(payload);
        }
    });
});

test('cleanSubs unsubscribes every owned subscription', () => {
    const manager = new Core_SubscriptionManager();
    const source = new Subject();
    const received = [];

    manager.addSub(source.subscribe((v) => received.push(`a:${v}`)));
    manager.addSub(source.subscribe((v) => received.push(`b:${v}`)));
    source.next(1);
    manager.cleanSubs();
    source.next(2);

    assert.deepEqual(received, ['a:1', 'b:1']);
    assert.equal(source.observers.length, 0);
    assert.equal(manager.size, 0);
});

test('cleanSubs is idempotent and the manager stays usable afterwards', () => {
    const manager = new Core_SubscriptionManager();
    const source = new Subject();
    let unsubscribeCalls = 0;
    const sub = source.subscribe();
    sub.add(() => { unsubscribeCalls += 1; });

    manager.addSub(sub);
    manager.cleanSubs();
    manager.cleanSubs();
    assert.equal(unsubscribeCalls, 1);

    const received = [];
    manager.addSub(source.subscribe((v) => received.push(v)));
    source.next('after-reuse');
    manager.cleanSubs();
    source.next('after-second-clean');

    assert.deepEqual(received, ['after-reuse']);
    assert.equal(source.observers.length, 0);
});

test('addSub returns the same subscription', () => {
    const manager = new Core_SubscriptionManager();
    const sub = new Subject().subscribe();

    assert.equal(manager.addSub(sub), sub);
});

test('subscriptions that close on their own are released immediately', () => {
    const manager = new Core_SubscriptionManager();
    const source = new Subject();
    const completing = new Subject();

    manager.addSub(source.pipe(take(1)).subscribe());
    manager.addSub(completing.subscribe());
    const external = manager.addSub(source.subscribe());
    assert.equal(manager.size, 3);

    source.next('first');
    assert.equal(manager.size, 2, 'take(1) subscription released after its value');

    completing.complete();
    assert.equal(manager.size, 1, 'completed source released');

    external.unsubscribe();
    assert.equal(manager.size, 0, 'externally unsubscribed subscription released');
});

test('already-closed subscriptions and non-subscriptions are not tracked', () => {
    const manager = new Core_SubscriptionManager();
    const syncCompleted = of(1).subscribe();

    assert.equal(syncCompleted.closed, true);
    assert.equal(manager.addSub(syncCompleted), syncCompleted);
    assert.equal(manager.addSub(null), null);
    assert.equal(manager.addSub(undefined), undefined);
    assert.equal(manager.size, 0);
    assert.doesNotThrow(() => manager.cleanSubs());
});

test('duck-typed subscriptions without add() are still unsubscribed on cleanSubs', () => {
    const manager = new Core_SubscriptionManager();
    let calls = 0;
    manager.addSub({ unsubscribe: () => { calls += 1; } });

    manager.cleanSubs();
    manager.cleanSubs();

    assert.equal(calls, 1);
});

test('a throwing unsubscribe is logged and does not prevent other cleanups', () => {
    const manager = new Core_SubscriptionManager();
    const source = new Subject();
    const failure = new Error('teardown failed');
    manager.addSub({ unsubscribe: () => { throw failure; } });
    manager.addSub(source.subscribe());

    manager.cleanSubs();

    assert.deepEqual(logged, [failure]);
    assert.equal(source.observers.length, 0);
});

test('the manager does not retain its former owner', async () => {
    /** @type {WeakRef<object>[]} */
    const owners = [];
    (() => {
        for (let i = 0; i < 10; i += 1) {
            const owner = {};
            const manager = new Core_SubscriptionManager(owner);
            manager.addSub(new Subject().subscribe());
            manager.cleanSubs();
            owners.push(new WeakRef(owner));
        }
    })();

    await collectGarbage();

    assert.equal(owners.filter((ref) => ref.deref() !== undefined).length, 0);
});

test('cleaned subscriptions do not keep their owner reachable from a long-lived source', async () => {
    const longLived = new BehaviorSubject(0);
    /** @type {WeakRef<object>[]} */
    const owners = [];
    (() => {
        for (let i = 0; i < 10; i += 1) {
            const owner = { value: null };
            const manager = new Core_SubscriptionManager(owner);
            manager.addSub(longLived.subscribe((v) => { owner.value = v; }));
            manager.cleanSubs();
            owners.push(new WeakRef(owner));
        }
    })();

    await collectGarbage();

    assert.equal(longLived.observers.length, 0);
    assert.equal(owners.filter((ref) => ref.deref() !== undefined).length, 0);
});
