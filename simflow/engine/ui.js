/**
 * SimFlow UI
 * Builds and manages the full simulation UI:
 *   - Parameter controls panel (sliders, selects, toggles, inputs)
 *   - Playback controls (tick, step x5, auto-play, reset)
 *   - Store visual panels
 *   - View panels (gantt, bar, line, stat_card)
 *   - Task overlay
 */

import { StoreRenderer, GanttRenderer, BarRenderer, LineRenderer, StatCardRenderer } from './renderer.js';
import { ScoringEngine } from './scoring.js';
import { AUTO_COLORS } from './assets.js';

export class SimFlowUI {
  constructor(container, runtime, ast) {
    this.container    = container;
    this.runtime      = runtime;
    this.ast          = ast;
    this.scoring      = new ScoringEngine(ast);
    this._storeRenderers  = {};
    this._viewRenderers   = {};
    this._autoPlayTimer   = null;
    this._autoSpeed       = 800; // ms per tick
    this._pendingTask     = null;
    this._taskHistory     = []; // for teacher view

    this._build();
    this._bindRuntime();
    this._initialRender();

    // Log start
    this.scoring.logSimStart(runtime.params);
  }

  // ── Build Layout ──────────────────────────────────────────────────────────

  _build() {
    this.container.innerHTML = '';
    this.container.className = 'sf-root';

    // Header
    const header = this._el('div', 'sf-header');
    header.innerHTML = `
      <div class="sf-header-left">
        <div class="sf-logo">▸ SimFlow</div>
        <div class="sf-sim-name">${this.ast.name}</div>
      </div>
      <div class="sf-header-right">
        <div class="sf-tick-display">Tick <span id="sf-tick">0</span></div>
        <div class="sf-status" id="sf-status">bereit</div>
      </div>
    `;
    this.container.appendChild(header);

    // Main layout: [params | stores+views]
    const main = this._el('div', 'sf-main');
    this.container.appendChild(main);

    // Left: params + controls
    const left = this._el('div', 'sf-left');
    main.appendChild(left);

    // Params section
    const paramsSection = this._el('div', 'sf-section');
    paramsSection.innerHTML = '<div class="sf-section-title">Parameter</div>';
    this._paramsContainer = this._el('div', 'sf-params');
    paramsSection.appendChild(this._paramsContainer);
    left.appendChild(paramsSection);

    // Events (buttons)
    if (this.ast.events.length > 0) {
      const evSection = this._el('div', 'sf-section');
      evSection.innerHTML = '<div class="sf-section-title">Aktionen</div>';
      this._eventsContainer = this._el('div', 'sf-events');
      evSection.appendChild(this._eventsContainer);
      left.appendChild(evSection);
    }

    // Playback controls
    const playback = this._el('div', 'sf-playback');
    playback.innerHTML = `
      <button class="sf-btn sf-btn-primary" id="sf-btn-step">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 3l8 5-8 5z" fill="currentColor"/></svg>
        Tick
      </button>
      <button class="sf-btn" id="sf-btn-step5">×5</button>
      <button class="sf-btn" id="sf-btn-auto">
        <svg viewBox="0 0 16 16" width="12" height="12" id="sf-play-icon"><path d="M4 3l8 5-8 5z" fill="currentColor"/></svg>
        Auto
      </button>
      <div class="sf-speed-wrap">
        <span class="sf-speed-label">Geschw.</span>
        <input type="range" min="100" max="2000" value="800" step="100" id="sf-speed" class="sf-speed-slider">
      </div>
      <button class="sf-btn sf-btn-reset" id="sf-btn-reset">↺ Reset</button>
    `;
    left.appendChild(playback);

    // Right: stores + views
    const right = this._el('div', 'sf-right');
    main.appendChild(right);

    this._storesContainer = this._el('div', 'sf-stores');
    right.appendChild(this._storesContainer);

    this._viewsContainer = this._el('div', 'sf-views');
    right.appendChild(this._viewsContainer);

    // Task overlay
    this._taskOverlay = this._el('div', 'sf-task-overlay sf-hidden');
    this.container.appendChild(this._taskOverlay);

    // Event log (collapsible)
    const logSection = this._el('div', 'sf-section sf-log-section');
    logSection.innerHTML = '<div class="sf-section-title sf-log-toggle" onclick="this.parentElement.classList.toggle(\'sf-log-open\')">Event-Log ▾</div>';
    this._logContainer = this._el('div', 'sf-log');
    logSection.appendChild(this._logContainer);
    this.container.appendChild(logSection);

    this._buildParams();
    this._buildEvents();
    this._buildStores();
    this._buildViews();
    this._bindControls();
  }

  // ── Params ────────────────────────────────────────────────────────────────

  _buildParams() {
    const allParams = [
      ...this.ast.params,
      ...this.ast.groups.flatMap(g => g.params)
    ];

    allParams.forEach(p => {
      const wrap = this._el('div', 'sf-param-row');
      const label = this._el('label', 'sf-param-label');
      label.textContent = p.mods?.label || p.name;
      wrap.appendChild(label);

      let control;
      const def = p.ptype;

      if (def.base === 'Bool') {
        control = document.createElement('input');
        control.type = 'checkbox';
        control.className = 'sf-toggle';
        control.checked = this.runtime.params[p.name] ?? false;
        control.addEventListener('change', () => {
          this.runtime.setParam(p.name, control.checked);
          this.scoring.logParamChange(p.name, !control.checked, control.checked);
        });

      } else if (def.base === 'Choice') {
        control = document.createElement('select');
        control.className = 'sf-select';
        const labels = p.mods?.labels || def.opts;
        def.opts.forEach((opt, i) => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = Array.isArray(labels) ? (labels[i] || opt) : opt;
          if (opt === this.runtime.params[p.name]) o.selected = true;
          control.appendChild(o);
        });
        control.addEventListener('change', () => {
          const old = this.runtime.params[p.name];
          this.runtime.setParam(p.name, control.value);
          this.scoring.logParamChange(p.name, old, control.value);
        });

      } else if (def.base === 'String' || (def.base === 'Int' && !def.min && !def.max)) {
        const widget = p.mods?.widget || (def.base === 'String' ? 'input' : 'number');
        control = document.createElement('input');
        control.type = widget === 'number' ? 'number' : 'text';
        control.className = 'sf-input';
        control.value = this.runtime.params[p.name] ?? '';
        if (p.mods?.placeholder) control.placeholder = p.mods.placeholder;
        control.addEventListener('change', () => {
          const val = control.type === 'number' ? Number(control.value) : control.value;
          const old = this.runtime.params[p.name];
          this.runtime.setParam(p.name, val);
          this.scoring.logParamChange(p.name, old, val);
        });

      } else {
        // Slider (Int or Float with range)
        const sliderWrap = this._el('div', 'sf-slider-wrap');
        control = document.createElement('input');
        control.type = 'range';
        control.className = 'sf-slider';
        control.min   = def.min ?? 0;
        control.max   = def.max ?? 100;
        control.value = this.runtime.params[p.name] ?? def.min ?? 0;
        control.step  = p.mods?.step || (def.base === 'Float' ? 0.01 : 1);

        const valDisplay = this._el('span', 'sf-slider-val');
        const fmt = p.mods?.format;
        const formatVal = (v) => fmt ? Number(v).toFixed(fmt.replace(/[^0-9]/g, '') || 0)
                                     : (def.base === 'Float' ? Number(v).toFixed(2) : v);
        valDisplay.textContent = formatVal(control.value);

        control.addEventListener('input', () => {
          valDisplay.textContent = formatVal(control.value);
        });
        control.addEventListener('change', () => {
          const val = def.base === 'Float' ? parseFloat(control.value) : parseInt(control.value);
          const old = this.runtime.params[p.name];
          this.runtime.setParam(p.name, val);
          this.scoring.logParamChange(p.name, old, val);
        });

        sliderWrap.appendChild(control);
        sliderWrap.appendChild(valDisplay);
        wrap.appendChild(label);
        wrap.appendChild(sliderWrap);
        this._paramsContainer.appendChild(wrap);

        // enabled_when
        if (p.mods?.enabled_when) {
          wrap.dataset.enabledWhen = p.mods.enabled_when;
        }
        return;
      }

      wrap.appendChild(label);
      wrap.appendChild(control);
      if (p.mods?.enabled_when) wrap.dataset.enabledWhen = p.mods.enabled_when;
      this._paramsContainer.appendChild(wrap);
    });
  }

  _updateParamVisibility() {
    this._paramsContainer.querySelectorAll('[data-enabled-when]').forEach(wrap => {
      const expr  = wrap.dataset.enabledWhen;
      const parts = expr.match(/(\w+)\s*==\s*['"]?(\w+)['"]?/);
      if (parts) {
        const [_, param, val] = parts;
        const visible = String(this.runtime.params[param]) === val;
        wrap.style.display = visible ? '' : 'none';
      }
    });
  }

  // ── Events (Buttons) ──────────────────────────────────────────────────────

  _buildEvents() {
    if (!this._eventsContainer) return;
    this.ast.events.forEach(ev => {
      // Find params that have 'from' references
      const paramsFromUI = ev.params.filter(p => p.from);

      if (paramsFromUI.length === 0) {
        const btn = this._el('button', 'sf-btn sf-btn-event');
        btn.textContent = ev.name.replace(/_/g, ' ');
        btn.addEventListener('click', () => {
          this.runtime.triggerEvent(ev.name, {});
          this._render();
        });
        this._eventsContainer.appendChild(btn);
      } else {
        // Event needs input from a param field
        const row = this._el('div', 'sf-event-row');
        paramsFromUI.forEach(p => {
          const paramDef = this.ast.params.find(pp => pp.name === p.from);
          if (paramDef) {
            const inp = document.createElement('input');
            inp.type = paramDef.ptype.base === 'Int' ? 'number' : 'text';
            inp.className = 'sf-input sf-event-input';
            inp.placeholder = p.from;
            inp.id = `sf-event-param-${ev.name}-${p.from}`;
            row.appendChild(inp);
          }
        });
        const btn = this._el('button', 'sf-btn sf-btn-event');
        btn.textContent = ev.name.replace(/_/g, ' ');
        btn.addEventListener('click', () => {
          const args = {};
          paramsFromUI.forEach(p => {
            const inp = document.getElementById(`sf-event-param-${ev.name}-${p.from}`);
            if (inp) args[p.name] = inp.type === 'number' ? Number(inp.value) : inp.value;
          });
          this.runtime.triggerEvent(ev.name, args);
          this._render();
        });
        row.appendChild(btn);
        this._eventsContainer.appendChild(row);
      }
    });
  }

  // ── Stores ────────────────────────────────────────────────────────────────

  _buildStores() {
    this._storesContainer.innerHTML = '';
    for (const [name, store] of Object.entries(this.runtime.stores)) {
      const decl      = this.ast.stores.find(s => s.name === name);
      const entityDef = this.ast.entities.find(e => e.name === decl?.entityType);

      const section = this._el('div', 'sf-store-section');
      const title   = this._el('div', 'sf-store-title');
      title.textContent = `${name} : ${decl?.storeType || '?'}`;
      section.appendChild(title);

      const inner = this._el('div', 'sf-store-inner');
      section.appendChild(inner);
      this._storesContainer.appendChild(section);

      this._storeRenderers[name] = new StoreRenderer(inner, store, decl || { storeType: 'List', name }, entityDef);
    }
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  _buildViews() {
    this._viewsContainer.innerHTML = '';

    // Always add Gantt if there's a Slot store
    const hasSlot = Object.entries(this.runtime.stores).some(([_, s]) => s.constructor.name === 'SlotStore');

    if (hasSlot) {
      const section = this._buildViewSection('Ablauf (Gantt)');
      const renderer = new GanttRenderer(section, this.runtime, null);
      this._viewRenderers['__gantt'] = renderer;
    }

    // Declared views
    this.ast.views.forEach(view => {
      const title = view.name.replace(/_/g, ' ');
      const section = this._buildViewSection(title);

      const vtype = view.props.type?.value ?? view.props.type;
      if (vtype === 'bar') {
        this._viewRenderers[view.name] = new BarRenderer(section, view);
      } else if (vtype === 'line') {
        this._viewRenderers[view.name] = new LineRenderer(section, view);
      } else if (vtype === 'stat_card') {
        this._viewRenderers[view.name] = new StatCardRenderer(section);
      } else if (vtype === 'gantt') {
        this._viewRenderers[view.name] = new GanttRenderer(section, this.runtime, view);
      }
    });

    // Auto stat card for list stores at end
    const listStores = Object.entries(this.runtime.stores)
      .filter(([_, s]) => s.constructor.name === 'ListStore');

    if (listStores.length > 0) {
      const section = this._buildViewSection('Kennzahlen');
      this._viewRenderers['__stats'] = new StatCardRenderer(section);
    }
  }

  _buildViewSection(title) {
    const section = this._el('div', 'sf-view-section');
    const t = this._el('div', 'sf-store-title');
    t.textContent = title;
    section.appendChild(t);
    const inner = this._el('div', 'sf-view-inner');
    section.appendChild(inner);
    this._viewsContainer.appendChild(section);
    return inner;
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  _bindControls() {
    document.getElementById('sf-btn-step')?.addEventListener('click', () => {
      this._stopAuto();
      this.runtime.step();
      this._render();
    });

    document.getElementById('sf-btn-step5')?.addEventListener('click', () => {
      this._stopAuto();
      for (let i = 0; i < 5; i++) { if (!this.runtime.step()) break; }
      this._render();
    });

    document.getElementById('sf-btn-auto')?.addEventListener('click', () => {
      if (this._autoPlayTimer) { this._stopAuto(); }
      else {
        this._startAuto();
      }
    });

    document.getElementById('sf-speed')?.addEventListener('input', (e) => {
      this._autoSpeed = parseInt(e.target.value);
      if (this._autoPlayTimer) { this._stopAuto(); this._startAuto(); }
    });

    document.getElementById('sf-btn-reset')?.addEventListener('click', () => {
      this._stopAuto();
      this.runtime.reset();
      this.scoring.logReset();
      this._taskOverlay.classList.add('sf-hidden');
      this._pendingTask = null;
      this._render();
      this._updateStatus('bereit');
    });
  }

  _startAuto() {
    const btn  = document.getElementById('sf-btn-auto');
    const icon = document.getElementById('sf-play-icon');
    if (btn) btn.classList.add('sf-btn-active');
    if (icon) icon.innerHTML = `<rect x="3" y="3" width="4" height="10" fill="currentColor"/><rect x="9" y="3" width="4" height="10" fill="currentColor"/>`;

    this._autoPlayTimer = setInterval(() => {
      if (!this.runtime.step()) { this._stopAuto(); }
      this._render();
    }, this._autoSpeed);
  }

  _stopAuto() {
    clearInterval(this._autoPlayTimer);
    this._autoPlayTimer = null;
    const btn  = document.getElementById('sf-btn-auto');
    const icon = document.getElementById('sf-play-icon');
    if (btn) btn.classList.remove('sf-btn-active');
    if (icon) icon.innerHTML = `<path d="M4 3l8 5-8 5z" fill="currentColor"/>`;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _bindRuntime() {
    this.runtime.on('tick', ({ tick }) => {
      const el = document.getElementById('sf-tick');
      if (el) el.textContent = tick;
      this._updateParamVisibility();
    });

    this.runtime.on('done', () => {
      this._stopAuto();
      this._updateStatus('fertig ✓');
      this.scoring.logSimDone(this.runtime.tick, this.runtime.params);
      this._addLogEntry('sim_done', `Simulation abgeschlossen. Ticks: ${this.runtime.tick}`);
    });

    this.runtime.on('reset', () => {
      const el = document.getElementById('sf-tick');
      if (el) el.textContent = '0';
      this._updateStatus('bereit');
      this._buildViews(); // re-init view renderers
    });

    this.runtime.on('param_change', ({ name, from, to }) => {
      this._addLogEntry('param_change', `${name}: ${from} → ${to}`);
    });

    this.runtime.on('task', ({ task }) => {
      this._showTask(task);
    });
  }

  _initialRender() {
    this._render();
  }

  _render() {
    // Re-render stores
    for (const [name, renderer] of Object.entries(this._storeRenderers)) {
      renderer.store = this.runtime.stores[name]; // update reference
      renderer.render();
    }

    // Re-render views
    this._renderViews();
  }

  _renderViews() {
    const stores = this.runtime.stores;

    // Gantt
    if (this._viewRenderers['__gantt']) {
      this._viewRenderers['__gantt'].runtime = this.runtime;
      this._viewRenderers['__gantt'].render();
    }

    // Declared views
    this.ast.views.forEach(view => {
      const renderer = this._viewRenderers[view.name];
      if (!renderer) return;
      const vtype = view.props.type?.value ?? view.props.type;

      if (vtype === 'bar') {
        const data = this._resolveBarData(view, stores);
        renderer.render(data);
      } else if (vtype === 'line') {
        const series = this._resolveLineSeries(view, stores);
        renderer.render(series);
      } else if (vtype === 'stat_card') {
        const stats = this._resolveStats(view, stores);
        renderer.render(stats);
      } else if (vtype === 'gantt') {
        renderer.runtime = this.runtime;
        renderer.render();
      }
    });

    // Auto stats for finished list
    if (this._viewRenderers['__stats']) {
      const stats = this._autoStats(stores);
      this._viewRenderers['__stats'].render(stats);
    }
  }

  _resolveBarData(view, stores) {
    const sourceExpr = view.props.source || view.props.x_by;
    const yExpr      = view.props.y_by;
    const result     = [];

    // Try to find a list store and map entities
    for (const [name, store] of Object.entries(stores)) {
      if (store._data && Array.isArray(store._data) && store._data.length > 0) {
        store._data.forEach((e, i) => {
          if (!e) return;
          result.push({
            label: e.pid !== undefined ? `P${e.pid}` : String(e.id ?? i),
            value: e.wait ?? e.burst ?? e.value ?? 0,
            color: AUTO_COLORS[i % AUTO_COLORS.length].color,
          });
        });
        break;
      }
    }
    return result;
  }

  _resolveLineSeries(view, stores) {
    const history = this.runtime.history;
    if (history.length < 2) return [];

    // Try to build a meaningful time series from list stores
    const series = [];
    for (const [name, store] of Object.entries(stores)) {
      if (store._data && Array.isArray(store._data)) {
        series.push({
          label: name,
          data:  history.map(h => (h.stores[name] || []).length),
          color: AUTO_COLORS[series.length % AUTO_COLORS.length].color,
        });
        if (series.length >= 3) break;
      }
    }
    return series;
  }

  _resolveStats(view, stores) {
    const statsConf = view.props.stats;
    if (!statsConf) return [];
    return []; // Handled by explicit stats config
  }

  _autoStats(stores) {
    const stats = [];
    for (const [name, store] of Object.entries(stores)) {
      if (store._data && Array.isArray(store._data) && store._data.length > 0) {
        const sample = store._data[0];
        if (sample && sample.wait !== undefined) {
          const avg = store._data.reduce((s, e) => s + (e.wait || 0), 0) / store._data.length;
          stats.push({ label: `Ø Wartezeit (${name})`, value: avg, color: '#1D9E75' });
        }
        stats.push({ label: `${name} (fertig)`, value: store._data.length });
      }
    }
    stats.push({ label: 'Ticks gesamt', value: this.runtime.tick });
    return stats.slice(0, 4);
  }

  // ── Task Overlay ──────────────────────────────────────────────────────────

  _showTask(task) {
    this._stopAuto();
    this._pendingTask  = task;
    const props        = task.props;
    const taskType     = props.type?.value ?? props.type ?? 'fill_in';
    const promptText   = props.prompt?.value ?? props.prompt ?? task.label;
    const hintText     = props.hint?.value ?? props.hint ?? null;
    const hintAfter    = props.hint_after?.value ?? props.hint_after ?? 1;

    this.scoring.logTaskPresented(task.label);

    let inputHTML = '';
    if (taskType === 'fill_in') {
      inputHTML = `<input type="text" id="sf-task-input" class="sf-task-input" placeholder="Antwort eingeben...">`;
    } else if (taskType === 'predict') {
      inputHTML = `<input type="text" id="sf-task-input" class="sf-task-input" placeholder="Deine Vorhersage...">`;
    } else if (taskType === 'choose') {
      const opts = props.options?.elements || props.options || [];
      inputHTML = opts.map((o, i) => {
        const label = o.value ?? o;
        return `<label class="sf-task-option"><input type="radio" name="sf-task-choice" value="${label}"> ${label}</label>`;
      }).join('');
    }

    this._taskOverlay.className = 'sf-task-overlay';
    this._taskOverlay.innerHTML = `
      <div class="sf-task-card">
        <div class="sf-task-type">${taskType.replace('_', ' ')}</div>
        <div class="sf-task-prompt">${promptText}</div>
        <div class="sf-task-input-area">${inputHTML}</div>
        <div class="sf-task-actions">
          <button class="sf-btn sf-btn-primary" id="sf-task-submit">Antwort prüfen</button>
          ${hintText ? `<button class="sf-btn" id="sf-task-hint">💡 Hinweis</button>` : ''}
          <button class="sf-btn" id="sf-task-skip">Überspringen</button>
        </div>
        <div class="sf-task-feedback sf-hidden" id="sf-task-feedback"></div>
        ${hintText ? `<div class="sf-task-hint-text sf-hidden" id="sf-task-hint-text">${hintText}</div>` : ''}
      </div>
    `;

    // Bind actions
    document.getElementById('sf-task-submit')?.addEventListener('click', () => {
      this._submitTaskAnswer(task, taskType, props);
    });

    document.getElementById('sf-task-hint')?.addEventListener('click', () => {
      this.scoring.logHintRequested(task.label);
      const hint = document.getElementById('sf-task-hint-text');
      if (hint) hint.classList.remove('sf-hidden');
    });

    document.getElementById('sf-task-skip')?.addEventListener('click', () => {
      this._taskOverlay.classList.add('sf-hidden');
      this._pendingTask = null;
      this.runtime._tasksDone.add(task.label);
    });

    document.getElementById('sf-task-input')?.focus();
  }

  _submitTaskAnswer(task, taskType, props) {
    let given;
    if (taskType === 'choose') {
      const sel = this._taskOverlay.querySelector('input[name="sf-task-choice"]:checked');
      given = sel ? sel.value : null;
    } else {
      const inp = document.getElementById('sf-task-input');
      given = inp ? inp.value.trim() : null;
    }

    if (given === null || given === '') return;

    // Evaluate correct answer
    let correct = false;
    let correctAnswer = null;

    try {
      const answerNode = props.answer;
      if (answerNode) {
        correctAnswer = this.runtime._eval(answerNode);
        const tolerance = props.tolerance?.value ?? props.tolerance ?? 0;

        const givenNum = parseFloat(given);
        const corrNum  = typeof correctAnswer === 'number' ? correctAnswer : parseFloat(correctAnswer);

        if (!isNaN(givenNum) && !isNaN(corrNum) && tolerance > 0) {
          correct = Math.abs(givenNum - corrNum) <= tolerance;
        } else {
          correct = String(given).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
        }
      } else {
        correct = true; // No answer defined → accept anything
        correctAnswer = given;
      }
    } catch (e) {
      console.warn('[SimFlow] Task answer evaluation error:', e);
    }

    this.scoring.logTaskAnswer(task.label, given, correct, correctAnswer);
    this._addLogEntry('task_answer', `${task.label}: "${given}" ${correct ? '✓' : '✗'}`);

    const feedback = document.getElementById('sf-task-feedback');
    if (feedback) {
      feedback.classList.remove('sf-hidden');
      if (correct) {
        feedback.className = 'sf-task-feedback sf-feedback-correct';
        feedback.textContent = `✓ Richtig! ${correctAnswer !== null ? `Antwort: ${correctAnswer}` : ''}`;
        setTimeout(() => {
          this._taskOverlay.classList.add('sf-hidden');
          this.runtime._tasksDone.add(task.label);
          this._pendingTask = null;
        }, 1500);
      } else {
        feedback.className = 'sf-task-feedback sf-feedback-wrong';
        feedback.textContent = `✗ Nicht ganz. Versuche es nochmal.`;
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _updateStatus(text) {
    const el = document.getElementById('sf-status');
    if (el) el.textContent = text;
  }

  _addLogEntry(type, text) {
    const entry = this._el('div', 'sf-log-entry');
    entry.innerHTML = `<span class="sf-log-tick">[${this.runtime.tick}]</span> <span class="sf-log-type sf-log-${type}">${type}</span> ${text}`;
    this._logContainer.insertBefore(entry, this._logContainer.firstChild);
    if (this._logContainer.children.length > 50) {
      this._logContainer.removeChild(this._logContainer.lastChild);
    }
  }

  _el(tag, cls = '') {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getScoringData() {
    return this.scoring.toJSON();
  }

  exportCSV() {
    return this.scoring.toCSV();
  }
}
