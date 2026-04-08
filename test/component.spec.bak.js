import { expect } from 'npm:@esm-bundle/chai';
import { AppStore } from '../demo/stores.js';
import { '../my-counter-component.js';

describe('UI Integration', () => {
  it('should update the UI when the store state changes', async () => {
    // 1. Create a fragment of the real app
    document.body.innerHTML = `
      <app-store id="test-store"></app-store>
      <my-counter-component id="test-ui"></my-counter-component>
    `;

    const store = document.getElementById('test-store');
    const ui = document.getElementById('test-ui');

    // 2. Trigger a state change
    store.increment();

    // 3. Wait for the browser to render the update
    // (Native components are fast, but sometimes need a microtask tick)
    await new Promise(r => setTimeout(r, 0));

    const shadowRoot = ui.shadowRoot || ui; 
    expect(shadowRoot.textContent).to.contain('1');
  });
});