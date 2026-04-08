/**
 * ACTION BUTTON (Write-Only; Fire-and-forget)
 */
class ActionButton extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<button>${this.getAttribute('label')}</button>`;
    this.onclick = () => {
      this.dispatchEvent(new CustomEvent(`${this.getAttribute('store') || 'app'}:action`, {
        detail: { type: this.getAttribute('action-type'), payload: this.getAttribute('value') },
        bubbles: true, composed: true
      }));
    };
  }
}
customElements.define('action-button', ActionButton);

/**
 * LAZY DISPLAY (Selective Hydration)
 */
class LazyDisplay extends HTMLElement {
  connectedCallback() {
    this.innerHTML = "<em>(Scrolling into view...)</em>";
    const obs = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting) {
        await customElements.whenDefined('app-store');
        const store = document.querySelector('app-store');
        const update = () => this.innerHTML = `<strong>Store is live: ${store.state.count}</strong>`;
        store.addEventListener('change', update);
        update();
        obs.disconnect();
      }
    });
    obs.observe(this);
  }
}
customElements.define('lazy-display', LazyDisplay);