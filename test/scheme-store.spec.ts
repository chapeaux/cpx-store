import { CPXSchemeStore } from "../src/stores/cpx-scheme-store.ts";
import { expect } from "@esm-bundle/chai";

describe("SchemeStore", () => {
  it("should set scheme correctly", () => {
    // Create and attach to DOM so connectedCallback fires
    const store = new CPXSchemeStore();
    document.body.appendChild(store);

    store.setScheme('light');
    expect(store.state.scheme).to.equal('light');

    // Cleanup
    document.body.removeChild(store);
  });
});