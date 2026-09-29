import { register } from 'node:module';
import { parseHTML } from 'linkedom';

register('./support/test-loader.mjs', import.meta.url);

const { document, customElements, HTMLElement, window: linkedWindow } = parseHTML(
    '<!DOCTYPE html><html><head></head><body></body></html>'
);

globalThis.document = document;
globalThis.customElements = customElements;
globalThis.HTMLElement = HTMLElement;
globalThis.Element = document.defaultView.Element;
globalThis.window = linkedWindow;
globalThis.CustomEvent = linkedWindow.CustomEvent;
globalThis.Event = linkedWindow.Event;

let locationHref = 'http://localhost/';

function resolveLocationHref(value) {
    const raw = String(value);
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw;
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `http://localhost${path}`;
}

const locationObject = {
    get href() {
        return locationHref;
    },
    set href(value) {
        locationHref = resolveLocationHref(value);
    },
    get pathname() {
        return new URL(locationHref).pathname;
    },
    get search() {
        return new URL(locationHref).search;
    },
};

const locationDescriptor = {
    configurable: true,
    get() {
        return locationObject;
    },
    set(value) {
        locationObject.href = value;
    },
};

Object.defineProperty(globalThis, 'location', locationDescriptor);
Object.defineProperty(linkedWindow, 'location', locationDescriptor);

/** @type {Array<{ state: *, title: string, url: string }>} */
globalThis.__historyCalls = [];

globalThis.history = {
    pushState(state, title, url) {
        globalThis.__historyCalls.push({ state, title, url });
        locationHref = resolveLocationHref(url);
    },
};
