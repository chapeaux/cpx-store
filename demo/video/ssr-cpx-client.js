// Hydration: pick up the server's serialized state and wire up real
// interactivity. Unlike the React side, this ships no framework runtime —
// just this file, importing the same library the server used.
import { CPXStore } from '../../cpx-store.js';

class AppStore extends CPXStore {
  constructor() {
    super(window.__STATE__);
  }
}
customElements.define('app-store', AppStore);

await customElements.whenDefined('app-store');
const store = document.querySelector('#store');

store.addEventListener('change', () => {
  document.querySelector('#count').textContent = store.state.count;
});

document.querySelector('#inc').onclick = () => store.state.count++;
