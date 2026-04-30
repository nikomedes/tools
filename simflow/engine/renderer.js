/**
 * SimFlow Renderer
 * Renders stores (queue, slot, list, array) and views (gantt, bar, line, stat_card).
 * Uses SVG + Canvas. Updates incrementally via diffs.
 */

import { ASSETS, AUTO_COLORS, STATE_COLORS, renderEntitySVG } from './assets.js';

// ─── Store Renderer ───────────────────────────────────────────────────────────

/**
 * Renders a store visually inside a container element.
 * Re-renders on each tick call.
 */
export class StoreRenderer {
  constructor(container, storeInst, storeDecl, entityDef) {
    this.container  = container;
    this.store      = storeInst;
    this.decl       = storeDecl;
    this.entityDef  = entityDef;
    this._entityColors = new Map(); // entity identity → AUTO_COLORS index
    this._colorIdx  = 0;
    this.render();
  }

  _getColor(entity) {
    if (!entity) return AUTO_COLORS[0];
    const key = entity.pid ?? entity.id ?? entity.number ?? JSON.stringify(entity);
    if (!this._entityColors.has(key)) {
      this._entityColors.set(key, AUTO_COLORS[this._colorIdx++ % AUTO_COLORS.length]);
    }
    return this._entityColors.get(key);
  }

  render() {
    const { storeType } = this.decl;
    switch (storeType) {
      case 'Queue': case 'Stack': this._renderQueue(); break;
      case 'Slot':                this._renderSlot();  break;
      case 'List':                this._renderList();  break;
      case 'Array':               this._renderArray(); break;
      case 'Set':                 this._renderQueue(); break; // similar to queue
      default:                    this._renderGeneric();
    }
  }

  _renderQueue() {
    const data = this.store._data || [];
    this.container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'sf-store-queue';

    const arrow = () => {
      const a = document.createElement('div');
      a.className = 'sf-queue-arrow';
      a.innerHTML = `<svg viewBox="0 0 16 12" width="16" height="12"><path d="M2 6h10M8 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      return a;
    };

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sf-store-empty';
      empty.textContent = 'leer';
      wrap.appendChild(empty);
    }

    data.forEach((entity, i) => {
      if (i > 0) wrap.appendChild(arrow());
      wrap.appendChild(this._renderEntity(entity));
    });

    this.container.appendChild(wrap);
  }

  _renderSlot() {
    const entity = this.store._entity;
    this.container.innerHTML = '';

    const slot = document.createElement('div');
    slot.className = 'sf-store-slot' + (entity ? ' sf-slot-occupied' : ' sf-slot-empty');

    if (entity) {
      slot.appendChild(this._renderEntity(entity, true));
    } else {
      const empty = document.createElement('div');
      empty.className = 'sf-slot-placeholder';
      empty.innerHTML = `<svg viewBox="0 0 44 32" width="44" height="32"><rect x="2" y="2" width="40" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.3"/></svg>`;
      slot.appendChild(empty);
    }
    this.container.appendChild(slot);
  }

  _renderList() {
    const data = this.store._data || [];
    this.container.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'sf-store-list';

    data.slice(-8).forEach((entity, i) => {
      const row = document.createElement('div');
      row.className = 'sf-list-row';
      const idx = document.createElement('span');
      idx.className = 'sf-list-idx';
      idx.textContent = data.length > 8 ? (data.length - 8 + i) : i;
      row.appendChild(idx);
      row.appendChild(this._renderEntity(entity, false, 'small'));
      list.appendChild(row);
    });

    if (data.length === 0) {
      list.innerHTML = '<div class="sf-store-empty">leer</div>';
    }

    this.container.appendChild(list);
  }

  _renderArray() {
    const data  = this.store._data || [];
    const lastC = this.store.last_compared || [];
    this.container.innerHTML = '';

    const canvas = document.createElement('canvas');
    const w = this.container.clientWidth || 300;
    const h = 80;
    canvas.width = w; canvas.height = h;
    canvas.className = 'sf-array-canvas';
    this.container.appendChild(canvas);

    const ctx   = canvas.getContext('2d');
    const n     = data.length;
    const bw    = (w - 8) / n;
    const maxV  = Math.max(...data.filter(Boolean).map(e => e.value || e.remaining || 1), 1);
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const palette = {
      unsorted: isDark ? '#c2c0b6' : '#888780',
      pivot:    '#EF9F27',
      sorted:   '#1D9E75',
      compared: '#534AB7',
    };

    data.forEach((e, i) => {
      if (!e) return;
      const val = e.value || e.remaining || 1;
      const bh  = Math.max(4, (val / maxV) * (h - 16));
      const x   = 4 + i * bw;
      const isCompared = lastC.includes(e);

      ctx.fillStyle = isCompared ? palette.compared
                    : (e.state ? (palette[e.state] || palette.unsorted) : palette.unsorted);
      ctx.beginPath();
      ctx.roundRect(x + 1, h - 8 - bh, bw - 2, bh, 3);
      ctx.fill();

      // Label if bars are wide enough
      if (bw > 18) {
        ctx.fillStyle = isDark ? '#f1ede0' : '#1a1916';
        ctx.font = `${Math.min(11, bw - 4)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(val, x + bw / 2, h - 1);
      }
    });
  }

  _renderGeneric() {
    this.container.innerHTML = `<div class="sf-store-empty">${this.decl.name}</div>`;
  }

  _renderEntity(entity, large = false, size = 'normal') {
    const assetName   = this.entityDef?.meta?.visual || 'box';
    const autoColor   = this._getColor(entity);
    const colorName   = entity.state ? null : null;
    let colors        = autoColor;

    // Apply visual_states
    const vs = this.entityDef?.meta?.visual_states;
    if (vs && entity.state && vs[entity.state]) {
      const stateConf = vs[entity.state];
      colors = STATE_COLORS[stateConf.color] || autoColor;
    }

    const assetFn  = ASSETS[assetName] || ASSETS.box;
    const svgStr   = assetFn(colors);

    const div = document.createElement('div');
    div.className = `sf-entity ${large ? 'sf-entity-large' : ''} ${size === 'small' ? 'sf-entity-small' : ''}`;

    // Determine label
    const labelTemplate  = this.entityDef?.meta?.label    || null;
    const subTemplate    = this.entityDef?.meta?.sublabel  || null;

    const evalTpl = (tpl) => {
      if (!tpl) return null;
      return tpl.replace(/'([^']*)'\s*\+\s*(\w+)/g, (_, s, field) => s + (entity[field] ?? ''))
                .replace(/(\w+)\s*\+\s*'([^']*)'/g, (_, field, s) => (entity[field] ?? '') + s)
                .replace(/^['"](.*)['"]$/, '$1')
                .replace(/^\w+$/, m => entity[m] !== undefined ? String(entity[m]) : m);
    };

    const label    = evalTpl(labelTemplate) || (entity.pid !== undefined ? `P${entity.pid}` : entity.id !== undefined ? `${entity.id}` : entity.number !== undefined ? `${entity.number}` : '');
    const sublabel = evalTpl(subTemplate)   || (entity.remaining !== undefined ? `${entity.remaining}` : entity.value !== undefined ? `${entity.value}` : '');

    const pulse = vs && entity.state && vs[entity.state]?.pulse;
    if (pulse) div.classList.add('sf-entity-pulse');
    if (vs && entity.state && vs[entity.state]?.dim) div.style.opacity = '0.4';

    div.innerHTML = `
      <div class="sf-entity-svg">${svgStr}</div>
      <div class="sf-entity-labels">
        ${label ? `<div class="sf-entity-label">${label}</div>` : ''}
        ${sublabel ? `<div class="sf-entity-sublabel">${sublabel}</div>` : ''}
      </div>
    `;
    return div;
  }
}

// ─── View Renderers ───────────────────────────────────────────────────────────

export class GanttRenderer {
  constructor(container, runtime, viewDecl) {
    this.container = container;
    this.runtime   = runtime;
    this.viewDecl  = viewDecl;
    this._canvas   = null;
    this._entityColors = new Map();
    this._colorIdx  = 0;
    this._init();
  }

  _init() {
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'sf-view-canvas';
    this._canvas.height = 60;
    this.container.appendChild(this._canvas);
  }

  _getColor(entity) {
    if (!entity) return '#888780';
    const key = entity.pid ?? entity.id ?? JSON.stringify(entity);
    if (!this._entityColors.has(key)) {
      this._entityColors.set(key, AUTO_COLORS[this._colorIdx++ % AUTO_COLORS.length].color);
    }
    return this._entityColors.get(key);
  }

  render() {
    // Find slot store from viewDecl source or first slot store
    let storeName = null;
    for (const [n, s] of Object.entries(this.runtime.stores)) {
      if (s.constructor.name === 'SlotStore') { storeName = n; break; }
    }
    if (!storeName) return;

    const history  = this.runtime.getSlotHistory(storeName);
    const w        = this.container.clientWidth || 400;
    this._canvas.width = w;
    const ctx      = this._canvas.getContext('2d');
    const h        = this._canvas.height;
    const total    = Math.max(history.length, 1);
    const rh       = 20, ry = (h - rh) / 2;

    ctx.clearRect(0, 0, w, h);

    // Group consecutive same entity
    let segs = [], cur = null;
    history.forEach((h, i) => {
      const e = h.entity;
      if (!cur || JSON.stringify(cur.entity) !== JSON.stringify(e)) {
        cur = { entity: e, start: i, end: i + 1 };
        segs.push(cur);
      } else cur.end = i + 1;
    });

    segs.forEach(seg => {
      if (!seg.entity) return;
      const x  = 4 + seg.start * (w - 8) / total;
      const sw = (seg.end - seg.start) * (w - 8) / total;
      ctx.fillStyle = this._getColor(seg.entity);
      ctx.beginPath(); ctx.roundRect(x, ry, sw - 1, rh, 3); ctx.fill();

      if (sw > 20) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '10px monospace'; ctx.textAlign = 'center';
        const label = seg.entity.pid !== undefined ? `P${seg.entity.pid}` : (seg.entity.id || '?');
        ctx.fillText(label, x + sw / 2, ry + 13);
      }
    });

    // Tick axis
    ctx.fillStyle = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#666' : '#aaa';
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(total / 10));
    for (let t = 0; t <= total; t += step) {
      const x = 4 + t * (w - 8) / total;
      ctx.fillText(t, x, h - 2);
    }
  }
}

export class BarRenderer {
  constructor(container, viewDecl) {
    this.container = container;
    this.viewDecl  = viewDecl;
    this._canvas   = null;
    this._init();
  }

  _init() {
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'sf-view-canvas';
    this._canvas.height = 100;
    this.container.appendChild(this._canvas);
  }

  render(data) {
    // data: array of { label, value, color }
    const w = this.container.clientWidth || 300;
    this._canvas.width = w;
    const ctx    = this._canvas.getContext('2d');
    const h      = this._canvas.height;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const n      = data.length;
    if (n === 0) return;

    ctx.clearRect(0, 0, w, h);

    const maxV = Math.max(...data.map(d => d.value), 1);
    const bw   = (w - 16) / n - 4;

    data.forEach((d, i) => {
      const bh   = Math.max(2, (d.value / maxV) * (h - 24));
      const x    = 8 + i * (bw + 4);
      const color = d.color || AUTO_COLORS[i % AUTO_COLORS.length].color;

      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, h - 16 - bh, bw, bh, 3); ctx.fill();

      // Label
      ctx.fillStyle = isDark ? '#c2c0b6' : '#555';
      ctx.font = `${Math.min(10, bw)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + bw / 2, h - 3);
      ctx.fillText(d.value.toFixed(1), x + bw / 2, h - bh - 20);
    });
  }
}

export class LineRenderer {
  constructor(container, viewDecl) {
    this.container = container;
    this.viewDecl  = viewDecl;
    this._canvas   = null;
    this._init();
  }

  _init() {
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'sf-view-canvas';
    this._canvas.height = 80;
    this.container.appendChild(this._canvas);
  }

  render(series) {
    // series: array of { label, data: number[], color?, dashed? }
    const w = this.container.clientWidth || 300;
    this._canvas.width = w;
    const ctx    = this._canvas.getContext('2d');
    const h      = this._canvas.height;
    ctx.clearRect(0, 0, w, h);

    const allVals = series.flatMap(s => s.data);
    const maxV    = Math.max(...allVals, 1);
    const minV    = Math.min(...allVals, 0);
    const range   = maxV - minV || 1;
    const COLORS  = ['#534AB7', '#1D9E75', '#BA7517', '#A32D2D', '#185FA5'];

    series.forEach((s, si) => {
      const data  = s.data;
      const color = s.color || COLORS[si % COLORS.length];
      const n     = data.length;
      if (n < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash(s.dashed ? [5, 3] : []);

      data.forEach((v, i) => {
        const x = 4 + i * (w - 8) / (n - 1);
        const y = (h - 16) - ((v - minV) / range) * (h - 24);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // X-axis labels
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = isDark ? '#666' : '#aaa';
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    const n = series[0]?.data.length || 0;
    if (n > 1) {
      const step = Math.max(1, Math.floor(n / 8));
      for (let i = 0; i < n; i += step) {
        ctx.fillText(i, 4 + i * (w - 8) / (n - 1), h - 2);
      }
    }
  }
}

export class StatCardRenderer {
  constructor(container) {
    this.container = container;
  }

  render(stats) {
    // stats: array of { label, value, color? }
    this.container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sf-stat-grid';

    stats.forEach(s => {
      const card = document.createElement('div');
      card.className = 'sf-stat-card';
      const valStr = typeof s.value === 'number'
        ? (Number.isInteger(s.value) ? String(s.value) : s.value.toFixed(1))
        : String(s.value ?? '—');

      card.innerHTML = `
        <div class="sf-stat-value" style="color:${s.color || 'var(--color-text-primary)'}">${valStr}</div>
        <div class="sf-stat-label">${s.label}</div>
      `;
      grid.appendChild(card);
    });
    this.container.appendChild(grid);
  }
}
