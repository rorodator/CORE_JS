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

const locationDescriptor = {
    configurable: true,
    get() {
        const href = locationHref;
        const pathname = href.startsWith('http') ? new URL(href).pathname : href;
        return { href, pathname };
    },
    set(value) {
        locationHref = String(value);
    },
};

Object.defineProperty(globalThis, 'location', locationDescriptor);
Object.defineProperty(linkedWindow, 'location', locationDescriptor);

/** @type {Array<{ state: *, title: string, url: string }>} */
globalThis.__historyCalls = [];

globalThis.history = {
    pushState(state, title, url) {
        globalThis.__historyCalls.push({ state, title, url });
    },
};
