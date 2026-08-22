/**
 * Minimal MouseEvent stand-in for linkedom (no native MouseEvent in Node).
 */
export class TestMouseEvent extends Event {
    /**
     * @param {string} type
     * @param {MouseEventInit & { target?: EventTarget }} [init]
     */
    constructor(type, init = {}) {
        super(type, init);
        this.button = init.button ?? 0;
        this.ctrlKey = init.ctrlKey ?? false;
        this.metaKey = init.metaKey ?? false;
        this.shiftKey = init.shiftKey ?? false;
        this.altKey = init.altKey ?? false;
        if (init.target) {
            Object.defineProperty(this, 'target', { value: init.target, configurable: true });
        }
    }
}

/**
 * Builds a click event for router manageLink() tests.
 *
 * @param {HTMLAnchorElement} anchor
 * @param {Partial<MouseEventInit>} [init]
 * @returns {TestMouseEvent}
 */
export function createAnchorClick(anchor, init = {}) {
    return new TestMouseEvent('click', { bubbles: true, cancelable: true, target: anchor, ...init });
}
