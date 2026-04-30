/**
 * SimFlow Engine v1.0
 * Main entry point — loads .simflow files, builds the UI.
 *
 * Usage:
 *   <script type="module" src="simflow.js"></script>
 *   <sim-flow src="cpu_rr.simflow"></sim-flow>
 *
 *   Or programmatically:
 *   import SimFlow from './simflow.js';
 *   const sim = await SimFlow.load('cpu_rr.simflow');
 *   sim.mount('#container');
 */

import { tokenize }        from './engine/lexer.js';
import { parse }           from './engine/parser.js';
import { SimFlowRuntime }  from './engine/runtime.js';
import { SimFlowUI }       from './engine/ui.js';

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  .sf-root {
    font-family: var(--font-sans, system-ui, sans-serif);
    background: var(--color-background-primary, #fff);
    color: var(--color-text-primary, #1a1916);
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
    border-radius: 12px;
    overflow: hidden;
    min-width: 600px;
  }

  /* Header */
  .sf-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    background: var(--color-background-secondary, #f5f3ec);
    border-bottom: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
  }
  .sf-header-left { display: flex; align-items: center; gap: 10px; }
  .sf-logo { font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
              color: #1D9E75; font-family: var(--font-mono, monospace); font-weight: 600; }
  .sf-sim-name { font-size: 14px; font-weight: 600; }
  .sf-header-right { display: flex; align-items: center; gap: 12px; }
  .sf-tick-display { font-family: var(--font-mono, monospace); font-size: 12px;
                     color: var(--color-text-secondary, #555); }
  .sf-tick-display span { font-weight: 700; color: var(--color-text-primary, #1a1916); }
  .sf-status { font-size: 11px; padding: 2px 8px; border-radius: 4px;
               background: var(--color-background-success, #d4edda);
               color: var(--color-text-success, #0F6E56); font-weight: 500; }

  /* Main layout */
  .sf-main { display: grid; grid-template-columns: 220px 1fr; min-height: 400px; }
  .sf-left {
    background: var(--color-background-secondary, #f5f3ec);
    border-right: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
    padding: 12px; display: flex; flex-direction: column; gap: 12px;
    overflow-y: auto; max-height: 600px;
  }
  .sf-right { padding: 12px; overflow-y: auto; max-height: 600px; }

  /* Section */
  .sf-section { margin-bottom: 8px; }
  .sf-section-title {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--color-text-tertiary, #888); font-family: var(--font-mono, monospace);
    margin-bottom: 8px;
  }

  /* Params */
  .sf-param-row { margin-bottom: 10px; }
  .sf-param-label { display: block; font-size: 12px; color: var(--color-text-secondary, #555);
                    margin-bottom: 4px; }
  .sf-slider-wrap { display: flex; align-items: center; gap: 8px; }
  .sf-slider { flex: 1; cursor: pointer; accent-color: #1D9E75; }
  .sf-slider-val { font-family: var(--font-mono, monospace); font-size: 12px;
                   color: #1D9E75; min-width: 32px; text-align: right; }
  .sf-select, .sf-input {
    width: 100%; padding: 5px 8px; border-radius: 5px; font-size: 12px;
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.15));
    background: var(--color-background-primary, #fff);
    color: var(--color-text-primary, #1a1916); outline: none;
  }
  .sf-select:focus, .sf-input:focus { border-color: #1D9E75; }
  .sf-toggle { cursor: pointer; accent-color: #1D9E75; width: 16px; height: 16px; }

  /* Buttons */
  .sf-btn {
    padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 500;
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.15));
    background: var(--color-background-primary, #fff);
    color: var(--color-text-secondary, #555);
    cursor: pointer; transition: all .15s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .sf-btn:hover { background: var(--color-background-secondary, #f5f3ec); color: var(--color-text-primary, #1a1916); }
  .sf-btn-primary { background: #1D9E75; color: white; border-color: #1D9E75; }
  .sf-btn-primary:hover { background: #167d5e; }
  .sf-btn-active { background: #534AB7; color: white; border-color: #534AB7; }
  .sf-btn-reset { color: var(--color-text-danger, #A32D2D); }
  .sf-btn-event { width: 100%; margin-bottom: 6px; justify-content: center; }

  /* Playback */
  .sf-playback { display: flex; flex-direction: column; gap: 6px; margin-top: auto; padding-top: 8px;
                 border-top: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1)); }
  .sf-speed-wrap { display: flex; align-items: center; gap: 6px; }
  .sf-speed-label { font-size: 10px; color: var(--color-text-tertiary, #888); }
  .sf-speed-slider { flex: 1; accent-color: #534AB7; }

  /* Events */
  .sf-events { display: flex; flex-direction: column; }
  .sf-event-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .sf-event-input { flex: 1; }

  /* Stores */
  .sf-stores { margin-bottom: 16px; }
  .sf-store-section { margin-bottom: 16px; }
  .sf-store-title {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--color-text-tertiary, #888); font-family: var(--font-mono, monospace);
    margin-bottom: 8px;
  }
  .sf-store-inner {
    min-height: 48px;
    background: var(--color-background-secondary, #f5f3ec);
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
    border-radius: 8px; padding: 10px; overflow-x: auto;
  }
  .sf-store-empty { font-size: 12px; color: var(--color-text-tertiary, #888); text-align: center;
                    padding: 8px; }

  /* Queue */
  .sf-store-queue { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .sf-queue-arrow { color: var(--color-text-tertiary, #888); flex-shrink: 0; }

  /* Slot */
  .sf-store-slot { display: flex; align-items: center; justify-content: center; min-height: 60px; }
  .sf-slot-occupied { }
  .sf-slot-placeholder { opacity: 0.3; }

  /* List */
  .sf-store-list { display: flex; flex-direction: column; gap: 3px; }
  .sf-list-row { display: flex; align-items: center; gap: 8px; }
  .sf-list-idx { font-family: var(--font-mono, monospace); font-size: 10px;
                 color: var(--color-text-tertiary, #888); min-width: 18px; text-align: right; }

  /* Entity */
  .sf-entity { display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: default; }
  .sf-entity-svg { width: 44px; height: 32px; }
  .sf-entity-svg svg { width: 100%; height: 100%; }
  .sf-entity-large .sf-entity-svg { width: 56px; height: 40px; }
  .sf-entity-small .sf-entity-svg { width: 32px; height: 22px; }
  .sf-entity-labels { text-align: center; line-height: 1.2; }
  .sf-entity-label { font-size: 11px; font-weight: 600; color: var(--color-text-primary, #1a1916);
                     font-family: var(--font-mono, monospace); }
  .sf-entity-sublabel { font-size: 10px; color: var(--color-text-secondary, #555);
                         font-family: var(--font-mono, monospace); }
  .sf-entity-pulse .sf-entity-svg { animation: sf-pulse 1.2s ease-in-out infinite; }
  @keyframes sf-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }

  /* Array Canvas */
  .sf-array-canvas { width: 100%; border-radius: 6px; display: block; }

  /* Views */
  .sf-views { }
  .sf-view-section { margin-bottom: 16px; }
  .sf-view-inner {
    background: var(--color-background-secondary, #f5f3ec);
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
    border-radius: 8px; padding: 8px; min-height: 60px;
  }
  .sf-view-canvas { width: 100% !important; border-radius: 4px; display: block; }

  /* Stat cards */
  .sf-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sf-stat-card {
    background: var(--color-background-primary, #fff);
    border: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
    border-radius: 6px; padding: 10px; text-align: center;
  }
  .sf-stat-value { font-size: 22px; font-weight: 700; font-family: var(--font-mono, monospace); }
  .sf-stat-label { font-size: 10px; color: var(--color-text-tertiary, #888); margin-top: 3px; }

  /* Task overlay */
  .sf-task-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 50; border-radius: 12px;
  }
  .sf-task-overlay.sf-hidden { display: none; }
  .sf-task-card {
    background: var(--color-background-primary, #fff);
    border: 1px solid #1D9E75;
    border-radius: 12px; padding: 28px 32px; max-width: 440px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,.3);
  }
  .sf-task-type {
    font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: #1D9E75; font-family: var(--font-mono, monospace); margin-bottom: 10px;
  }
  .sf-task-prompt { font-size: 16px; font-weight: 600; margin-bottom: 16px; line-height: 1.4; }
  .sf-task-input-area { margin-bottom: 16px; }
  .sf-task-input { width: 100%; padding: 10px; font-size: 15px; border-radius: 6px;
                   border: 1px solid var(--color-border-tertiary, rgba(0,0,0,.15));
                   background: var(--color-background-secondary, #f5f3ec);
                   color: var(--color-text-primary, #1a1916); outline: none; }
  .sf-task-input:focus { border-color: #1D9E75; }
  .sf-task-option { display: block; padding: 8px 12px; margin-bottom: 6px; border-radius: 6px;
                    border: 1px solid var(--color-border-tertiary, rgba(0,0,0,.1));
                    cursor: pointer; font-size: 14px; }
  .sf-task-option:hover { background: var(--color-background-secondary, #f5f3ec); }
  .sf-task-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .sf-task-feedback { margin-top: 12px; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
  .sf-feedback-correct { background: #d4edda; color: #0F6E56; }
  .sf-feedback-wrong   { background: #fde8e8; color: #A32D2D; }
  .sf-task-hint-text { margin-top: 12px; padding: 8px 12px; background: #fef9e7;
                        border-radius: 6px; font-size: 13px; color: #BA7517; }

  /* Log */
  .sf-log-section { border-top: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.1));
                    padding: 8px 16px; }
  .sf-log-toggle { cursor: pointer; user-select: none; }
  .sf-log { display: none; max-height: 120px; overflow-y: auto; margin-top: 8px; }
  .sf-log-section.sf-log-open .sf-log { display: block; }
  .sf-log-entry { font-size: 11px; font-family: var(--font-mono, monospace);
                  padding: 2px 0; border-bottom: 0.5px solid var(--color-border-tertiary, rgba(0,0,0,.05)); }
  .sf-log-tick { color: var(--color-text-tertiary, #888); }
  .sf-log-type { font-weight: 600; margin-right: 6px; }
  .sf-log-param_change { color: #BA7517; }
  .sf-log-task_answer  { color: #534AB7; }
  .sf-log-sim_done     { color: #1D9E75; }

  .sf-hidden { display: none !important; }
`;

// ── SimFlow API ───────────────────────────────────────────────────────────────

const SimFlow = {

  async load(src) {
    let source;
    if (src.startsWith('http') || src.endsWith('.simflow')) {
      const resp = await fetch(src);
      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status + ' beim Laden von "' + src + '" — Datei nicht gefunden?');
      }
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        throw new Error('Server liefert HTML statt .simflow fuer "' + src + '" — Datei fehlt im Container?');
      }
      source = await resp.text();
    } else {
      source = src;
    }
    return SimFlow.parse(source);
  },

  parse(source) {
    const tokens  = tokenize(source);
    const ast     = parse(tokens);
    return {
      ast,
      mount(containerSelector, options = {}) {
        const container = typeof containerSelector === 'string'
          ? document.querySelector(containerSelector)
          : containerSelector;
        if (!container) throw new Error(`SimFlow: container not found: ${containerSelector}`);

        // Inject styles
        SimFlow._injectStyles();

        // Position container for overlay
        container.style.position = 'relative';

        const runtime = new SimFlowRuntime(ast, options);
        const ui      = new SimFlowUI(container, runtime, ast);

        return { runtime, ui };
      }
    };
  },

  _stylesInjected: false,
  _injectStyles() {
    if (this._stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this._stylesInjected = true;
  }
};

// ── Custom Element <sim-flow src="..."> ───────────────────────────────────────

class SimFlowElement extends HTMLElement {
  connectedCallback() {
    const src     = this.getAttribute('src');
    const mode    = this.getAttribute('mode') || 'demo'; // demo | task | readonly
    if (!src) return;

    this.style.display = 'block';
    this.style.position = 'relative';
    this.innerHTML = `<div style="padding:20px;text-align:center;color:#888;font-size:13px">Lade ${src}…</div>`;

    SimFlow.load(src).then(sim => {
      this.innerHTML = '';
      sim.mount(this, { mode });
    }).catch(err => {
      this.innerHTML = `<div style="padding:20px;color:#A32D2D;font-size:13px">Fehler: ${err.message}</div>`;
    });
  }
}

if (!customElements.get('sim-flow')) {
  customElements.define('sim-flow', SimFlowElement);
}

export default SimFlow;
