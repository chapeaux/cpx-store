import { CPXStore } from '../../cpx-store.js';
import { historyPlugin } from '../../plugins/history.js';

class AppStore extends CPXStore {
  constructor() {
    super(
      { count: 0, theme: 'light', alertMessage: '' },
      historyPlugin({
        strategies: { alertMessage: 'none' }, // server-derived; undoing it isn't meaningful
      }),
    );
  }
}
customElements.define('app-store', AppStore);
