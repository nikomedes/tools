/**
 * SimFlow Store Implementations
 * Each store type provides its data structure + operations accessible from SimFlow rules.
 */

// ─── Base Store ───────────────────────────────────────────────────────────────

class BaseStore {
  constructor(name, entityType) {
    this.name = name;
    this.entityType = entityType;
    this._annotations = []; // highlight, flash, mark etc. for current tick
  }

  // Called by renderer to get annotations and clear them
  flushAnnotations() {
    const a = this._annotations;
    this._annotations = [];
    return a;
  }

  annotate(type, data) {
    this._annotations.push({ type, data });
  }

  // Subclasses implement:
  toJSON() { return {}; }
  static fromJSON(json, name, entityType) { return new BaseStore(name, entityType); }
}

// ─── Queue <T> ────────────────────────────────────────────────────────────────

export class QueueStore extends BaseStore {
  constructor(name, entityType) {
    super(name, entityType);
    this._data = [];
  }

  // Proxy object exposed to simulation rules
  get proxy() {
    const store = this;
    return {
      // Properties
      get empty()    { return store._data.length === 0; },
      get nonempty() { return store._data.length > 0; },
      get size()     { return store._data.length; },
      get top()      { return store._data[0] ?? null; },
      get entities() { return [...store._data]; },
      get last()     { return store._data[store._data.length - 1] ?? null; },

      // Mutations
      push(e)    { store._data.push(e); return e; },
      pop()      { return store._data.shift() ?? null; },
      peek()     { return store._data[0] ?? null; },
      add(e)     { store._data.push(e); return e; },
      remove(e)  { const i = store._data.indexOf(e); if (i >= 0) store._data.splice(i, 1); },
      sort_by(f) { store._data.sort((a, b) => f(a) - f(b)); },
      move(e, other) { store.remove(e); other.add(e); },

      // Queries
      contains(pred) { return typeof pred === 'function' ? store._data.some(pred) : store._data.includes(pred); },
      count(pred)    { return typeof pred === 'function' ? store._data.filter(pred).length : 0; },
      find(pred)     { return store._data.find(pred) ?? null; },
      filter(pred)   { return store._data.filter(pred); },
      map(f)         { return store._data.map(f); },
      forEach(f)     { store._data.forEach(f); },
      min_by(f)      { return store._data.reduce((m, e) => f(e) < f(m) ? e : m, store._data[0]); },
      max_by(f)      { return store._data.reduce((m, e) => f(e) > f(m) ? e : m, store._data[0]); },
      avg(f)         { return store._data.length ? store._data.reduce((s, e) => s + f(e), 0) / store._data.length : 0; },
      sum(f)         { return store._data.reduce((s, e) => s + f(e), 0); },
      index_of(e)    { return store._data.indexOf(e); },
      at(i)          { return store._data[i] ?? null; },
    };
  }

  snapshot() { return this._data.map(e => ({ ...e })); }
  restore(snap) { this._data = snap.map(e => ({ ...e })); }
}

// ─── Stack <T> ────────────────────────────────────────────────────────────────

export class StackStore extends BaseStore {
  constructor(name, entityType) {
    super(name, entityType);
    this._data = [];
  }

  get proxy() {
    const store = this;
    return {
      get empty()    { return store._data.length === 0; },
      get nonempty() { return store._data.length > 0; },
      get size()     { return store._data.length; },
      get top()      { return store._data[store._data.length - 1] ?? null; },
      get entities() { return [...store._data]; },
      push(e)  { store._data.push(e); return e; },
      pop()    { return store._data.pop() ?? null; },
      peek()   { return store._data[store._data.length - 1] ?? null; },
      add(e)   { store._data.push(e); return e; },
      contains(pred) { return typeof pred === 'function' ? store._data.some(pred) : store._data.includes(pred); },
      filter(pred)   { return store._data.filter(pred); },
      map(f)         { return store._data.map(f); },
      forEach(f)     { store._data.forEach(f); },
    };
  }

  snapshot() { return this._data.map(e => ({ ...e })); }
  restore(snap) { this._data = snap.map(e => ({ ...e })); }
}

// ─── Slot <T> ────────────────────────────────────────────────────────────────

export class SlotStore extends BaseStore {
  constructor(name, entityType) {
    super(name, entityType);
    this._entity = null;
    this._prev   = null; // previous entity for gantt history
  }

  get proxy() {
    const store = this;
    return {
      get empty()    { return store._entity === null; },
      get occupied() { return store._entity !== null; },
      get entity()   { return store._entity; },
      get nonempty() { return store._entity !== null; },

      fill(e)  { store._prev = store._entity; store._entity = e; return e; },
      drain()  { const e = store._entity; store._entity = null; return e; },

      // Allow direct field access: cpu.entity.field = value
      // This is handled by the proxy on entity itself
    };
  }

  snapshot() { return this._entity ? { ...this._entity } : null; }
  restore(snap) { this._entity = snap ? { ...snap } : null; }
}

// ─── List <T> ────────────────────────────────────────────────────────────────

export class ListStore extends BaseStore {
  constructor(name, entityType) {
    super(name, entityType);
    this._data = [];
    this.last_modified = null;
  }

  get proxy() {
    const store = this;
    return {
      get empty()    { return store._data.length === 0; },
      get nonempty() { return store._data.length > 0; },
      get size()     { return store._data.length; },
      get entities() { return [...store._data]; },
      get last()     { return store._data[store._data.length - 1] ?? null; },
      get last_modified() { return store.last_modified; },

      add(e)     { store._data.push(e); store.last_modified = e; return e; },
      remove(e)  { const i = store._data.indexOf(e); if (i >= 0) store._data.splice(i, 1); },
      at(i)      { return store._data[i] ?? null; },
      find(pred) { return store._data.find(pred) ?? null; },
      filter(pred) { return store._data.filter(pred); },
      map(f)     { return store._data.map(f); },
      forEach(f) { store._data.forEach(f); },
      sort_by(f) { store._data.sort((a, b) => f(a) - f(b)); },
      contains(pred) { return typeof pred === 'function' ? store._data.some(pred) : store._data.includes(pred); },
      count(pred)  { return typeof pred === 'function' ? store._data.filter(pred).length : 0; },
      avg(f)       { return store._data.length ? store._data.reduce((s, e) => s + f(e), 0) / store._data.length : 0; },
      sum(f)       { return store._data.reduce((s, e) => s + f(e), 0); },
      min_by(f)    { return store._data.reduce((m, e) => f(e) < f(m) ? e : m, store._data[0]); },
      max_by(f)    { return store._data.reduce((m, e) => f(e) > f(m) ? e : m, store._data[0]); },
      index_of(e) { return store._data.indexOf(e); },
      group_by(f) {
        const g = {};
        store._data.forEach(e => { const k = f(e); (g[k] = g[k] || []).push(e); });
        return g;
      },
    };
  }

  snapshot() { return this._data.map(e => ({ ...e })); }
  restore(snap) { this._data = snap.map(e => ({ ...e })); }
}

// ─── Array <T>(n) ─────────────────────────────────────────────────────────────

export class ArrayStore extends BaseStore {
  constructor(name, entityType, size) {
    super(name, entityType);
    this._size = size || 8;
    this._data = new Array(this._size).fill(null);
    this.last_compared = [];
  }

  get proxy() {
    const store = this;
    return {
      get size()       { return store._size; },
      get entities()   { return [...store._data]; },
      get last_compared() { return store.last_compared; },

      at(i)         { return store._data[i] ?? null; },
      set(i, e)     { store._data[i] = e; },
      push(e)       { const i = store._data.findIndex(x => x === null); if (i >= 0) store._data[i] = e; },
      swap(i, j)    {
        store.last_compared = [store._data[i], store._data[j]];
        [store._data[i], store._data[j]] = [store._data[j], store._data[i]];
      },
      indexOf(e)    { return store._data.indexOf(e); },
      find(pred)    { return store._data.find(pred) ?? null; },
      filter(pred)  { return store._data.filter(pred); },
      map(f)        { return store._data.map(f); },
      contains(pred) { return typeof pred === 'function' ? store._data.some(pred) : store._data.includes(pred); },
      every(pred)   { return store._data.every(pred); },
      count(pred)   { return typeof pred === 'function' ? store._data.filter(Boolean).filter(pred).length : 0; },
    };
  }

  snapshot() { return this._data.map(e => e ? { ...e } : null); }
  restore(snap) { this._data = snap.map(e => e ? { ...e } : null); }
}

// ─── Set <T> ─────────────────────────────────────────────────────────────────

export class SetStore extends BaseStore {
  constructor(name, entityType) {
    super(name, entityType);
    this._data = [];
  }

  get proxy() {
    const store = this;
    return {
      get empty()    { return store._data.length === 0; },
      get nonempty() { return store._data.length > 0; },
      get size()     { return store._data.length; },
      get entities() { return [...store._data]; },

      add(e)         { if (!store._data.includes(e)) store._data.push(e); return e; },
      remove(e)      { const i = store._data.indexOf(e); if (i >= 0) store._data.splice(i, 1); },
      contains(pred) { return typeof pred === 'function' ? store._data.some(pred) : store._data.includes(pred); },
      filter(pred)   { return store._data.filter(pred); },
      map(f)         { return store._data.map(f); },
      forEach(f)     { store._data.forEach(f); },
      count(pred)    { return typeof pred === 'function' ? store._data.filter(pred).length : 0; },
      any(pred)      { return store._data.some(pred); },
      min_by(f)      { return store._data.reduce((m, e) => f(e) < f(m) ? e : m, store._data[0]); },
    };
  }

  snapshot() { return this._data.map(e => ({ ...e })); }
  restore(snap) { this._data = snap.map(e => ({ ...e })); }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createStore(storeType, name, entityType, size) {
  switch (storeType) {
    case 'Queue': return new QueueStore(name, entityType);
    case 'Stack': return new StackStore(name, entityType);
    case 'Slot':  return new SlotStore(name, entityType);
    case 'List':  return new ListStore(name, entityType);
    case 'Array': return new ArrayStore(name, entityType, size);
    case 'Set':   return new SetStore(name, entityType);
    default: throw new Error(`[SimFlow] Unknown store type: ${storeType}`);
  }
}
