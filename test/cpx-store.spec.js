import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";
class TestStore extends CPXStore {
    constructor() {
        super({ count: 0 });
    }
}
if (!customElements.get("test-store")) {
    customElements.define("test-store", TestStore);
}
describe("CPXStore: Infrastructure & Logic", () => {
    it("should initialize state and trigger proxy updates", () => {
        const store = document.createElement("test-store");
        document.body.appendChild(store);
        expect(store.state.count).to.equal(0);
        store.state.count = 10;
        expect(store.state.count).to.equal(10);
        store.remove();
    });
    it("should execute middleware in order", () => {
        let middlewareFired = false;
        const store = new TestStore();
        store._middleware = [(prop, val) => {
                if (prop === "count" && val === 5)
                    middlewareFired = true;
            }];
        store.connectedCallback();
        store.state.count = 5;
        expect(middlewareFired).to.be.true;
    });
    it("should handle Undo/Redo history", () => {
        const store = new TestStore();
        store.connectedCallback();
        store.state.count = 1;
        store.state.count = 2;
        expect(store.state.count).to.equal(2);
        store.undo();
        expect(store.state.count).to.equal(1);
        store.redo();
        expect(store.state.count).to.equal(2);
    });
    it("should dispatch 'change' events on mutation", () => {
        const store = new TestStore();
        store.connectedCallback();
        let eventDetail = null;
        store.addEventListener("change", (e) => {
            eventDetail = e.detail;
        });
        store.state.count = 42;
        expect(eventDetail).to.exist;
        expect(eventDetail.prop).to.equal("count");
        expect(eventDetail.value).to.equal(42);
    });
});
