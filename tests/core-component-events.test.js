import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import v8 from 'node:v8';
import vm from 'node:vm';
import { Subject, config as rxConfig } from 'rxjs';
import { Core_HTMLElement } from '../lib/base/core-html-element.js';
import { readonlyObservable } from '../lib/utils/core-readonly-observable.js';
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

/**
 * Pending mutations issued through the mocked owning service.
 * @type {Array<{ draft: string, response: Subject<{ status: string, note?: string }> }>}
 */
let pendingSaves;

/** @param {{ status: string, note?: string }} outcome */
function respondToLastSave(outcome) {
    const { response } = pendingSaves[pendingSaves.length - 1];
    response.next(outcome);
    response.complete();
}

/**
 * Child following the communication contract: private Subjects, public readonly
 * Observables, no knowledge of its consumers, success only after the owning
 * service confirms the mutation.
 */
class TestNoteEditor extends Core_HTMLElement {
    #saved = new Subject();
    #saved$ = readonlyObservable(this.#saved);
    #cancelled = new Subject();
    #cancelled$ = readonlyObservable(this.#cancelled);
    /** @type {Subject<string>|null} */
    #session = null;
    #draft = '';

    /** Emits the saved note after each confirmed save, across sessions. */
    get saved$() {
        return this.#saved$;
    }

    get cancelled$() {
        return this.#cancelled$;
    }

    /** Test-only probe of the private Subject. */
    get savedObserverCount() {
        return this.#saved.observers.length;
    }

    /**
     * Starts an edit session. The returned stream emits the confirmed note, then completes;
     * it completes without a value when the session ends otherwise.
     * @param {string} draft
     */
    open(draft) {
        this.#endSession();
        this.#draft = draft;
        this.#session = new Subject();
        return readonlyObservable(this.#session);
    }

    save() {
        const session = this.#session;
        $svc('notes').save(this.#draft).subscribe({
            next: (outcome) => {
                if (outcome.status !== 'SUCCESS') {
                    return;
                }
                if (this.#session === session) {
                    this.#session = null;
                }
                session?.next(outcome.note);
                session?.complete();
                this.#saved.next(outcome.note);
            },
            error: () => {},
        });
    }

    cancel() {
        this.#endSession();
        this.#cancelled.next();
    }

    #endSession() {
        const session = this.#session;
        this.#session = null;
        session?.complete();
    }

    onConnect() {
        this.render();
    }

    ui_render() {
        this.innerHTML = '<button data-action="save">Save</button><button data-action="cancel">Cancel</button>';
    }

    ui_toFunctional() {
        this.bindDelegated('click', '[data-action="save"]', () => this.save());
        this.bindDelegated('click', '[data-action="cancel"]', () => this.cancel());
    }
}

/** Parent that owns its editor instance and explicitly re-emits saves on its own output. */
class TestNotesPage extends Core_HTMLElement {
    #editor = /** @type {TestNoteEditor} */ (document.createElement('test-note-editor'));
    #saved = new Subject();
    #saved$ = readonlyObservable(this.#saved);
    /** @type {string[]} */
    received = [];

    get editor() {
        return this.#editor;
    }

    get saved$() {
        return this.#saved$;
    }

    onConnect() {
        this.addSub(this.#editor.saved$.subscribe((note) => {
            this.received.push(note);
            this.#saved.next(`page:${note}`);
        }));
        this.render();
    }

    ui_render() {
        this.replaceChildren(this.#editor);
    }
}

/** Parent that subscribes to an externally provided child. */
class TestSavedLogger extends Core_HTMLElement {
    /** @type {TestNoteEditor|null} */
    source = null;
    /** @type {string[]} */
    received = [];

    onConnect() {
        if (this.source) {
            this.addSub(this.source.saved$.subscribe((note) => this.received.push(note)));
        }
    }
}

customElements.define('test-note-editor', TestNoteEditor);
customElements.define('test-notes-page', TestNotesPage);
customElements.define('test-saved-logger', TestSavedLogger);

/** @param {Element} el */
function click(el) {
    el.dispatchEvent(new Event('click', { bubbles: true }));
}

/** @returns {TestNotesPage} */
function mountPage() {
    const page = /** @type {TestNotesPage} */ (document.createElement('test-notes-page'));
    document.body.append(page);
    return page;
}

/**
 * @param {TestNoteEditor} editor
 * @param {string} note
 */
function saveThroughUi(editor, note) {
    editor.open(note);
    click(editor.querySelector('[data-action="save"]'));
    respondToLastSave({ status: 'SUCCESS', note });
}

beforeEach(() => {
    document.body.replaceChildren();
    pendingSaves = [];
    const core = bootCore();
    core.registerService('default', class {
        lang = { isActivated: false };
    });
    core.registerService('log', class {
        error() {}
    });
    core.registerService('notes', class {
        /** @param {string} draft */
        save(draft) {
            const response = new Subject();
            pendingSaves.push({ draft, response });
            return response;
        }
    });
});

afterEach(() => {
    rxConfig.onUnhandledError = null;
});

test('parent receives only the child events it explicitly subscribed to', () => {
    const page = mountPage();

    saveThroughUi(page.editor, 'first');
    click(page.editor.querySelector('[data-action="cancel"]'));

    assert.deepEqual(page.received, ['first']);
});

test('parent B does not receive events from the child owned by parent A', () => {
    const pageA = mountPage();
    const pageB = mountPage();

    saveThroughUi(pageA.editor, 'only-for-a');

    assert.deepEqual(pageA.received, ['only-for-a']);
    assert.deepEqual(pageB.received, []);
});

test('two parents subscribing to the same child each receive its events independently', () => {
    const editor = /** @type {TestNoteEditor} */ (document.createElement('test-note-editor'));
    document.body.append(editor);
    const loggerA = /** @type {TestSavedLogger} */ (document.createElement('test-saved-logger'));
    const loggerB = /** @type {TestSavedLogger} */ (document.createElement('test-saved-logger'));
    loggerA.source = editor;
    loggerB.source = editor;
    document.body.append(loggerA, loggerB);

    saveThroughUi(editor, 'shared');
    loggerB.remove();
    saveThroughUi(editor, 'after-b-left');

    assert.deepEqual(loggerA.received, ['shared', 'after-b-left']);
    assert.deepEqual(loggerB.received, ['shared']);
});

test('a new session never notifies subscribers of a previous session', () => {
    const page = mountPage();
    const oldEvents = [];
    const newEvents = [];

    page.editor.open('old').subscribe({
        next: (note) => oldEvents.push(`next:${note}`),
        complete: () => oldEvents.push('complete'),
    });
    page.editor.open('new').subscribe({
        next: (note) => newEvents.push(`next:${note}`),
        complete: () => newEvents.push('complete'),
    });
    page.editor.save();
    respondToLastSave({ status: 'SUCCESS', note: 'new' });

    assert.deepEqual(oldEvents, ['complete']);
    assert.deepEqual(newEvents, ['next:new', 'complete']);
});

test('session success is delivered before session completion', () => {
    const page = mountPage();
    const events = [];

    page.editor.open('draft').subscribe({
        next: (note) => events.push(`next:${note}`),
        complete: () => events.push('complete'),
    });
    page.editor.save();
    respondToLastSave({ status: 'SUCCESS', note: 'draft' });

    assert.deepEqual(events, ['next:draft', 'complete']);
});

test('success is emitted only after the owning service confirms the mutation', () => {
    const page = mountPage();
    const sessionEvents = [];
    page.editor.open('draft').subscribe({
        next: (note) => sessionEvents.push(`next:${note}`),
        complete: () => sessionEvents.push('complete'),
    });

    page.editor.save();
    assert.deepEqual(page.received, [], 'nothing before the service answers');

    respondToLastSave({ status: 'VALIDATION_ERROR' });
    page.editor.save();
    pendingSaves[pendingSaves.length - 1].response.error({ kind: 'transport' });
    assert.deepEqual(page.received, [], 'no success on functional or transport failure');
    assert.deepEqual(sessionEvents, [], 'session stays open for a retry');

    page.editor.save();
    respondToLastSave({ status: 'SUCCESS', note: 'draft' });
    assert.deepEqual(page.received, ['draft']);
    assert.deepEqual(sessionEvents, ['next:draft', 'complete']);
});

test('child teardown during an in-flight mutation does not lose the confirmed outcome', () => {
    const page = mountPage();
    const sessionEvents = [];
    page.editor.open('draft').subscribe({
        next: (note) => sessionEvents.push(`next:${note}`),
        complete: () => sessionEvents.push('complete'),
    });

    page.editor.save();
    page.editor.remove();
    respondToLastSave({ status: 'SUCCESS', note: 'draft' });

    assert.deepEqual(sessionEvents, ['next:draft', 'complete']);
    assert.deepEqual(page.received, ['draft']);
});

test('public outputs are readonly views', () => {
    const page = mountPage();
    const output = page.editor.saved$;

    assert.throws(() => { page.editor.saved$ = new Subject(); }, TypeError);
    assert.equal(page.editor.saved$, output);
    assert.equal(Object.isFrozen(output), true);
    assert.throws(() => { output.subscribe = () => {}; }, TypeError);
    assert.equal('next' in output, false);
    assert.equal('error' in output, false);
    assert.equal('complete' in output, false);
});

test('the private Subject cannot be reached through the public output', () => {
    const subject = new Subject();
    const exposed = readonlyObservable(subject);
    const received = [];
    exposed.subscribe((v) => received.push(v));

    assert.equal(exposed.source, undefined);
    assert.equal(Object.values(exposed).includes(subject), false);

    const leaky = subject.asObservable();
    assert.equal(leaky.source, subject, 'asObservable() exposes the Subject through source');

    subject.next('owner-only');
    assert.deepEqual(received, ['owner-only']);
});

test('readonlyObservable forwards completion and errors from its source', () => {
    const completing = new Subject();
    const failing = new Subject();
    const events = [];

    readonlyObservable(completing).subscribe({ complete: () => events.push('complete') });
    readonlyObservable(failing).subscribe({ error: (e) => events.push(`error:${e}`) });
    completing.complete();
    failing.error('boom');

    assert.deepEqual(events, ['complete', 'error:boom']);
});

test('child reports outcomes without dispatching business events', () => {
    const page = mountPage();
    const dispatched = [];
    for (const target of [page.editor, page, document]) {
        const original = target.dispatchEvent.bind(target);
        target.dispatchEvent = (event) => {
            dispatched.push(event.type);
            return original(event);
        };
    }

    saveThroughUi(page.editor, 'quiet');

    assert.deepEqual(page.received, ['quiet']);
    assert.deepEqual(dispatched, []);
});

test('parent may explicitly re-emit a child event on its own output', () => {
    const page = mountPage();
    const forwarded = [];
    page.saved$.subscribe((note) => forwarded.push(note));

    saveThroughUi(page.editor, 'note');

    assert.deepEqual(forwarded, ['page:note']);
});

test('disconnect cleans the subscriptions owned by the parent', () => {
    const page = mountPage();
    const editor = page.editor;
    assert.equal(editor.savedObserverCount, 1);

    page.remove();
    editor.open('after-disconnect');
    editor.save();
    respondToLastSave({ status: 'SUCCESS', note: 'after-disconnect' });

    assert.equal(editor.savedObserverCount, 0);
    assert.deepEqual(page.received, []);
});

test('reconnect re-subscribes exactly once', () => {
    const page = mountPage();

    page.remove();
    document.body.append(page);
    saveThroughUi(page.editor, 'after-reconnect');

    assert.equal(page.editor.savedObserverCount, 1);
    assert.deepEqual(page.received, ['after-reconnect']);
});

test('detach/attach keeps owned subscriptions without duplicating them', () => {
    const page = mountPage();

    page.detach();
    page.remove();
    assert.equal(page.editor.savedObserverCount, 1, 'reuse mode keeps subscriptions');
    document.body.append(page);
    page.attach(true);
    saveThroughUi(page.editor, 'after-attach');

    assert.equal(page.editor.savedObserverCount, 1);
    assert.deepEqual(page.received, ['after-attach']);

    page.remove();
    assert.equal(page.editor.savedObserverCount, 0);
});

test('forceDestroy on a detached element releases its subscriptions', () => {
    const page = mountPage();

    page.detach();
    page.remove();
    page.forceDestroy();

    assert.equal(page.editor.savedObserverCount, 0);
});

test('repeated teardown is idempotent and the element remains reusable', () => {
    const page = mountPage();

    page.remove();
    assert.doesNotThrow(() => {
        page.forceDestroy();
        page.forceDestroy();
    });
    assert.equal(page.editor.savedObserverCount, 0);

    document.body.append(page);
    saveThroughUi(page.editor, 'remounted');
    assert.equal(page.editor.savedObserverCount, 1);
    assert.deepEqual(page.received, ['remounted']);
});

test('a throwing subscriber does not stop other subscribers or the child stream', async () => {
    const reported = [];
    rxConfig.onUnhandledError = (error) => reported.push(error.message);
    const page = mountPage();
    const healthy = [];
    page.editor.saved$.subscribe(() => { throw new Error('consumer bug'); });
    page.editor.saved$.subscribe((note) => healthy.push(note));

    saveThroughUi(page.editor, 'one');
    saveThroughUi(page.editor, 'two');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(reported, ['consumer bug', 'consumer bug']);
    assert.deepEqual(healthy, ['one', 'two']);
    assert.deepEqual(page.received, ['one', 'two']);
});

test('disconnected parents are not retained by a long-lived child', async () => {
    const editor = /** @type {TestNoteEditor} */ (document.createElement('test-note-editor'));
    document.body.append(editor);
    /** @type {WeakRef<TestSavedLogger>[]} */
    const parents = [];
    (() => {
        for (let i = 0; i < 10; i += 1) {
            const logger = /** @type {TestSavedLogger} */ (document.createElement('test-saved-logger'));
            logger.source = editor;
            document.body.append(logger);
            logger.remove();
            logger.source = null;
            parents.push(new WeakRef(logger));
        }
    })();

    await collectGarbage();

    assert.equal(editor.savedObserverCount, 0);
    assert.equal(parents.filter((ref) => ref.deref() !== undefined).length, 0);
});
