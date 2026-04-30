/**
 * SimFlow Runtime
 * Interprets the AST, executes rules, manages state and history.
 */

import { createStore } from './stores.js';

export class SimFlowRuntime {
  constructor(ast, options = {}) {
    this.ast      = ast;
    this.options  = options;
    this._stores  = {};       // name → Store instance
    this._params  = {};       // name → current value
    this._paramDefs = {};     // name → param AST node
    this._entityDefs = {};    // name → entity AST node
    this.tick     = 0;
    this.done     = false;
    this.history  = [];       // array of {tick, slot_snapshots, metrics}
    this.events   = [];       // event log for scoring
    this._listeners = {};
    this._locals  = {};       // let bindings during execution
    this._annotations = [];   // visual annotations this tick
    this._tasksDone = new Set();

    this._init();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  _init() {
    const ast = this.ast;

    // Register entity definitions
    for (const e of ast.entities) {
      this._entityDefs[e.name] = e;
    }

    // Register param defaults
    for (const p of ast.params) {
      this._paramDefs[p.name] = p;
      this._params[p.name] = this._evalParamDefault(p);
    }
    for (const g of (ast.groups || [])) {
      for (const p of g.params) {
        this._paramDefs[p.name] = p;
        this._params[p.name] = this._evalParamDefault(p);
      }
    }

    // Create stores
    for (const s of ast.stores) {
      const sizeVal = s.size ? this._evalExprSimple(s.size) : null;
      this._stores[s.name] = createStore(s.storeType, s.name, s.entityType, sizeVal);
    }

    // Apply builtins (use statements)
    for (const u of (ast.uses || [])) {
      this._applyBuiltin(u);
    }

    // Run setup
    if (ast.setup) this._execStmts(ast.setup.body);

    // Record initial state
    this._recordHistory();
  }

  _evalParamDefault(p) {
    if (p.default !== null && p.default !== undefined) return this._evalExprSimple(p.default);
    if (p.ptype.base === 'Bool') return false;
    if (p.ptype.base === 'Int' || p.ptype.base === 'Float') return p.ptype.min ?? 0;
    if (p.ptype.base === 'Choice') return p.ptype.opts?.[0] ?? '';
    if (p.ptype.base === 'String') return '';
    return null;
  }

  _evalExprSimple(node) {
    if (!node) return null;
    if (node.type === 'literal') return node.value;
    if (node.type === 'ident')   return this._params[node.name] ?? node.name;
    return null;
  }

  // ── Tick Execution ─────────────────────────────────────────────────────────

  step() {
    if (this.done) return false;

    this._annotations = [];
    this._locals      = {};

    // Check done condition
    if (this.ast.doneWhen) {
      const cond = this._eval(this.ast.doneWhen.condition);
      if (cond) {
        this.done = true;
        this._emit('done', {});
        return false;
      }
    }

    // Fire all rules whose conditions are true
    for (const rule of this.ast.rules) {
      if (rule.condition.type === 'placeholder') continue; // incomplete rule
      try {
        const cond = this._eval(rule.condition);
        if (cond) this._execStmts(rule.body);
      } catch (e) {
        console.warn(`[SimFlow] Rule '${rule.name}' error:`, e.message);
      }
    }

    this.tick++;
    this._recordHistory();

    // Check tasks
    this._checkTasks();

    // Check done again after tick
    if (this.ast.doneWhen) {
      const cond = this._eval(this.ast.doneWhen.condition);
      if (cond) {
        this.done = true;
        this._emit('done', {});
      }
    }

    this._emit('tick', { tick: this.tick, annotations: this._annotations });
    return !this.done;
  }

  _checkTasks() {
    for (const task of (this.ast.tasks || [])) {
      if (this._tasksDone.has(task.label)) continue;
      const tr = task.trigger;
      let fire = false;
      if      (tr.type === 'tick' && this._eval(tr.n) === this.tick) fire = true;
      else if (tr.type === 'done' && this.done) fire = true;
      else if (tr.type === 'condition') {
        try { fire = !!this._eval(tr.expr); } catch(_) {}
      }
      if (fire) {
        this._emit('task', { task });
      }
    }
  }

  _recordHistory() {
    const snapshot = {};
    for (const [name, store] of Object.entries(this._stores)) {
      snapshot[name] = store.snapshot();
    }
    this.history.push({ tick: this.tick, stores: snapshot });
  }

  reset() {
    this.tick      = 0;
    this.done      = false;
    this.history   = [];
    this._locals   = {};
    this._tasksDone = new Set();
    this._annotations = [];

    // Re-create stores
    for (const s of this.ast.stores) {
      const sizeVal = s.size ? this._evalExprSimple(s.size) : null;
      this._stores[s.name] = createStore(s.storeType, s.name, s.entityType, sizeVal);
    }

    // Re-apply builtins
    for (const u of (this.ast.uses || [])) {
      this._applyBuiltin(u);
    }

    // Re-run setup
    if (this.ast.setup) this._execStmts(this.ast.setup.body);

    this._recordHistory();
    this._emit('reset', {});
  }

  setParam(name, value) {
    const old = this._params[name];
    this._params[name] = value;
    this._emit('param_change', { name, from: old, to: value });

    // Check on_change
    const def = this._paramDefs[name];
    const onchange = def?.mods?.on_change;
    if (onchange === 'reset') this.reset();
  }

  triggerEvent(name, args = {}) {
    const eventDef = this.ast.events.find(e => e.name === name);
    if (!eventDef) return;
    const savedLocals = this._locals;
    this._locals = { ...args };
    this._execStmts(eventDef.body);
    this._locals = savedLocals;
    this._emit('event', { name, args });
    this.tick++;
    this._recordHistory();
    this._checkTasks();
    this._emit('tick', { tick: this.tick });
  }

  // ── Interpreter ────────────────────────────────────────────────────────────

  _eval(node) {
    if (!node) return null;

    switch (node.type) {
      case 'literal': return node.value;

      case 'ident': {
        const name = node.name;
        if (name === 'tick') return this.tick;
        if (name === 'true') return true;
        if (name === 'false') return false;
        if (name === 'null') return null;
        if (name in this._locals) return this._locals[name];
        if (name in this._params) return this._params[name];
        if (name in this._stores) return this._stores[name].proxy;
        if (name === 'rand')    return (min, max) => min + Math.floor(Math.random() * (max - min + 1));
        if (name === 'rand_choice') return list => list[Math.floor(Math.random() * list.length)];
        if (name === 'history') return expr => this.history.map(h => this._evalHistoryExpr(expr, h));
        if (name === 'int')     return x => Math.floor(Number(x));
        if (name === 'float')   return x => Number(x);
        if (name === 'abs')     return x => Math.abs(x);
        if (name === 'min')     return (a, b) => Math.min(a, b);
        if (name === 'max')     return (a, b) => Math.max(a, b);
        if (name === 'loop')    return this._locals._loop ?? {};
        if (name === 'params')  return this._params;
        return null;
      }

      case 'binop': {
        const l = this._eval(node.left);
        const r = this._eval(node.right);
        switch (node.op) {
          case '+':  return l + r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':  return r !== 0 ? l / r : 0;
          case '%':  return l % r;
          case '==': return l === r;
          case '!=': return l !== r;
          case '<':  return l < r;
          case '>':  return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          case '&&': return l && r;
          case '||': return l || r;
        }
        return null;
      }

      case 'ternary':
        return this._eval(node.cond) ? this._eval(node.then) : this._eval(node.else);

      case 'unop': {
        const v = this._eval(node.operand);
        switch (node.op) {
          case '!': return !v;
          case '-': return -v;
        }
        return null;
      }

      case 'member': {
        const obj = this._eval(node.obj);
        if (obj === null || obj === undefined) return null;
        const val = obj[node.member];
        return typeof val === 'function' ? val.bind(obj) : val;
      }

      case 'method_call': {
        const obj = this._eval(node.obj);
        if (obj === null || obj === undefined) return null;
        const method = obj[node.method];
        if (typeof method !== 'function') return null;
        const args = node.args.map(a => this._evalArg(a));
        return method.apply(obj, args);
      }

      case 'call': {
        const fn = this._eval(node.fn);
        if (typeof fn !== 'function') return null;
        const args = node.args.map(a => this._evalArg(a));
        return fn(...args);
      }

      case 'index': {
        const obj = this._eval(node.obj);
        const idx = this._eval(node.idx);
        return obj?.[idx] ?? null;
      }

      case 'constructor': {
        const entityDef = this._entityDefs[node.entity];
        const obj = {};
        // Apply defaults first
        if (entityDef) {
          for (const f of entityDef.fields) {
            if (f.default !== null) obj[f.name] = this._eval(f.default);
          }
        }
        // Apply provided fields
        for (const [k, v] of Object.entries(node.fields)) {
          obj[k] = v.type ? this._eval(v) : v; // v might be already-parsed value or AST node
        }
        // Self-referencing defaults (e.g., remaining: burst)
        if (entityDef) {
          for (const f of entityDef.fields) {
            if (!(f.name in obj) && f.default) {
              const val = this._evalWithLocals(f.default, obj);
              if (val !== null) obj[f.name] = val;
            }
          }
        }
        return obj;
      }

      case 'lambda': {
        const params = node.params;
        const body   = node.body;
        const savedLocals = this._locals;
        return (...args) => {
          const prevLocals = this._locals;
          this._locals = { ...savedLocals };
          params.forEach((p, i) => this._locals[p] = args[i]);
          const result = this._eval(body);
          this._locals = prevLocals;
          return result;
        };
      }

      case 'array_literal':
        return node.elements.map(e => e.type ? this._eval(e) : e);

      case 'placeholder':
        return null;

      default:
        // If it's a plain JS object (from parseObjectLit), convert recursively
        if (node && typeof node === 'object' && !node.type) {
          const result = {};
          for (const [k, v] of Object.entries(node)) {
            result[k] = v && v.type ? this._eval(v) : v;
          }
          return result;
        }
        return null;
    }
  }

  _evalArg(arg) {
    // Named args are passed as-is from the arg list
    if (arg && arg.type === 'named_arg') {
      return this._eval(arg.value);
    }
    return this._eval(arg);
  }

  _evalWithLocals(node, extraLocals) {
    const prev = this._locals;
    this._locals = { ...prev, ...extraLocals };
    const result = this._eval(node);
    this._locals = prev;
    return result;
  }

  _evalHistoryExpr(exprStr, histSnapshot) {
    // history() returns array of values over time
    // For now, evaluate on snapshots
    return histSnapshot.tick;
  }

  // ── Statement Execution ────────────────────────────────────────────────────

  _execStmts(stmts) {
    for (const stmt of stmts) {
      const result = this._execStmt(stmt);
      if (result && result.type === 'return') return result;
    }
  }

  _execStmt(stmt) {
    switch (stmt.type) {
      case 'if': {
        if (this._eval(stmt.cond)) this._execStmts(stmt.then);
        else if (stmt.else)        this._execStmts(stmt.else);
        break;
      }

      case 'repeat': {
        const count = this._eval(stmt.count);
        for (let i = 0; i < count; i++) {
          const prev = this._locals;
          this._locals = { ...prev, _loop: { i } };
          this._execStmts(stmt.body);
          this._locals = prev;
        }
        break;
      }

      case 'for': {
        const iter = this._eval(stmt.iter);
        if (Array.isArray(iter)) {
          for (const item of iter) {
            const prev = this._locals;
            this._locals = { ...prev, [stmt.var]: item };
            this._execStmts(stmt.body);
            this._locals = prev;
          }
        }
        break;
      }

      case 'let': {
        this._locals[stmt.name] = this._eval(stmt.value);
        break;
      }

      case 'assign': {
        const value = this._eval(stmt.value);
        this._setTarget(stmt.target, value, stmt.op);
        break;
      }

      case 'expr_stmt': {
        this._eval(stmt.expr);
        break;
      }

      case 'return': {
        return { type: 'return', value: this._eval(stmt.value) };
      }

      case 'annotation': {
        this._annotations.push({
          type: stmt.fn,
          args: stmt.args.map(a => this._eval(a))
        });
        break;
      }
    }
    return null;
  }

  _setTarget(target, value, op) {
    // Handle compound assignment
    const applyOp = (existing) => {
      switch (op) {
        case '+=': return existing + value;
        case '-=': return existing - value;
        default:   return value;
      }
    };

    if (target.type === 'ident') {
      const name = target.name;
      if (name in this._locals) {
        this._locals[name] = applyOp(this._locals[name]);
      } else if (name in this._params) {
        this._params[name] = applyOp(this._params[name]);
      }
      return;
    }

    if (target.type === 'member') {
      const obj = this._eval(target.obj);
      if (obj !== null && obj !== undefined) {
        const existing = obj[target.member];
        obj[target.member] = applyOp(existing);
      }
      return;
    }

    if (target.type === 'index') {
      const obj = this._eval(target.obj);
      const idx = this._eval(target.idx);
      if (obj !== null) obj[idx] = applyOp(obj[idx]);
    }
  }

  // ── Built-in Algorithms ────────────────────────────────────────────────────

  _applyBuiltin(useNode) {
    const { name, args } = useNode;
    switch (name) {
      case 'RoundRobin':
        this._installRoundRobin(args);
        break;
      case 'LRU':
        this._installLRU(args);
        break;
      case 'QuickSort':
        this._installQuickSort(args);
        break;
      case 'BubbleSort':
        this._installBubbleSort(args);
        break;
      case 'KanbanFlow':
        this._installKanban(args);
        break;
    }
  }

  _installRoundRobin(args) {
    // RoundRobin(queue: ready, cpu: cpu, done: finished, quantum: quantum)
    const queueName  = args.queue || 'ready';
    const cpuName    = args.cpu   || 'cpu';
    const doneName   = args.done  || 'finished';
    const quantumRef = args.quantum || 'quantum';

    this.ast.rules.push({
      type: 'rule',
      name: '__rr_dispatch',
      condition: { type: 'placeholder', _builtin: true, _check: () => {
        const cpu = this._stores[cpuName];
        const q   = this._stores[queueName];
        return cpu && q && cpu._entity === null && q._data.length > 0;
      }},
      body: [],
      _exec: () => {
        const cpu = this._stores[cpuName];
        const q   = this._stores[queueName];
        const e   = q._data.shift();
        cpu._entity = e;
        e._rr_used = 0;
      }
    });

    this.ast.rules.push({
      type: 'rule',
      name: '__rr_run',
      condition: { type: 'placeholder', _builtin: true, _check: () => {
        return this._stores[cpuName]?._entity !== null;
      }},
      body: [],
      _exec: () => {
        const cpu     = this._stores[cpuName];
        const q       = this._stores[queueName];
        const doneS   = this._stores[doneName];
        const quantum = typeof quantumRef === 'number' ? quantumRef : this._params[quantumRef] ?? 4;
        const e       = cpu._entity;

        e.remaining  -= 1;
        e._rr_used   = (e._rr_used || 0) + 1;

        // Increment wait for others
        q._data.forEach(p => { p.wait = (p.wait || 0) + 1; });

        if (e.remaining <= 0) {
          e.done = true;
          doneS._data.push(e);
          cpu._entity = null;
        } else if (e._rr_used >= quantum) {
          e._rr_used = 0;
          q._data.push(e);
          cpu._entity = null;
        }
      }
    });

    // Override rule execution for builtin rules
    this._builtinRuleHandlers = this._builtinRuleHandlers || {};
    this._builtinRuleHandlers['__rr_dispatch'] = this.ast.rules[this.ast.rules.length - 2];
    this._builtinRuleHandlers['__rr_run']      = this.ast.rules[this.ast.rules.length - 1];
  }

  _installLRU(args) {
    const framesName   = args.frames   || 'frames';
    const sequenceName = args.requests || 'sequence';
    const logName      = args.log      || null;

    this.ast.rules.push({
      type: 'rule',
      name: '__lru_step',
      condition: { type: 'placeholder', _builtin: true, _check: () => {
        return this._stores[sequenceName]?._data.length > 0;
      }},
      body: [],
      _exec: () => {
        const frames   = this._stores[framesName];
        const sequence = this._stores[sequenceName];
        const req      = sequence._data.shift();

        const hit = frames._data.find(p => p && p.number === req.number);
        if (hit) {
          hit.last_used = this.tick;
          if (logName && this._stores[logName]) {
            this._stores[logName]._data.push({ tick: this.tick, page: req.number, fault: false });
          }
        } else {
          // Find victim (LRU: lowest last_used, or empty slot)
          const empty = frames._data.findIndex(f => f === null);
          let idx;
          if (empty >= 0) {
            idx = empty;
          } else {
            let minTick = Infinity, minIdx = 0;
            frames._data.forEach((f, i) => { if (f && f.last_used < minTick) { minTick = f.last_used; minIdx = i; } });
            idx = minIdx;
          }
          frames._data[idx] = { number: req.number, last_used: this.tick };
          this._annotations.push({ type: 'flash', store: framesName, index: idx });
          if (logName && this._stores[logName]) {
            this._stores[logName]._data.push({ tick: this.tick, page: req.number, fault: true });
          }
        }
      }
    });
  }

  _installBubbleSort(args) {
    const arrName = args.array || 'arr';
    let _i = 0, _j = 0;

    this.ast.rules.push({
      type: 'rule',
      name: '__bubble_step',
      condition: { type: 'placeholder', _builtin: true, _check: () => {
        const arr = this._stores[arrName];
        return arr && _i < arr._data.length;
      }},
      body: [],
      _exec: () => {
        const arr = this._stores[arrName];
        const data = arr._data;
        if (_j < data.length - _i - 1) {
          arr.last_compared = [data[_j], data[_j + 1]];
          if (data[_j] && data[_j + 1] && data[_j].value > data[_j + 1].value) {
            [data[_j], data[_j + 1]] = [data[_j + 1], data[_j]];
          }
          _j++;
        } else {
          if (data[data.length - _i - 1]) data[data.length - _i - 1].state = 'sorted';
          _i++;
          _j = 0;
        }
        this.done = this.done || (_i >= data.length);
      }
    });
  }

  _installQuickSort(args) {
    const arrName = args.array || 'arr';
    let _stack = null, _done = false;

    const quickSortInit = (data) => {
      _stack = [{ lo: 0, hi: data.length - 1, phase: 'pivot', i: -1, j: 0 }];
    };

    this.ast.rules.push({
      type: 'rule',
      name: '__quick_step',
      condition: { type: 'placeholder', _builtin: true, _check: () => {
        const arr = this._stores[arrName];
        if (!arr) return false;
        if (_stack === null) { quickSortInit(arr._data); }
        return _stack.length > 0;
      }},
      body: [],
      _exec: () => {
        const arr  = this._stores[arrName];
        const data = arr._data;

        if (_stack.length === 0) { _done = true; this.done = true; return; }

        const frame = _stack[_stack.length - 1];
        const { lo, hi } = frame;

        if (lo >= hi) {
          if (data[lo]) data[lo].state = 'sorted';
          _stack.pop();
          return;
        }

        const pivot = data[hi];
        if (pivot) pivot.state = 'pivot';
        let p = lo;

        // Do one swap per tick
        if (frame.j <= hi) {
          const j = frame.j;
          arr.last_compared = [data[j], pivot];
          if (data[j] && data[j].value <= pivot.value && j !== hi) {
            [data[p], data[j]] = [data[j], data[p]];
            p++;
          }
          frame.j++;
          frame.i = p;
        } else {
          // Partition done
          const pivotIdx = frame.i;
          [data[pivotIdx], data[hi]] = [data[hi], data[pivotIdx]];
          if (data[pivotIdx]) data[pivotIdx].state = 'sorted';
          _stack.pop();
          if (pivotIdx - 1 > lo) _stack.push({ lo, hi: pivotIdx - 1, phase: 'pivot', i: lo, j: lo });
          if (pivotIdx + 1 < hi) _stack.push({ lo: pivotIdx + 1, hi, phase: 'pivot', i: pivotIdx + 1, j: pivotIdx + 1 });
        }
      }
    });
  }

  _installKanban(args) {
    // KanbanFlow just sets up the stores, no auto-rules
    // The teacher drives it via events
  }

  // ── Step override for builtin rules ───────────────────────────────────────

  step() {
    if (this.done) return false;
    this._annotations = [];
    this._locals      = {};

    if (this.ast.doneWhen) {
      if (this._eval(this.ast.doneWhen.condition)) {
        this.done = true; this._emit('done', {}); return false;
      }
    }

    for (const rule of this.ast.rules) {
      try {
        let condTrue = false;
        if (rule.condition._builtin && rule.condition._check) {
          condTrue = rule.condition._check();
        } else if (rule.condition.type !== 'placeholder') {
          condTrue = !!this._eval(rule.condition);
        }

        if (condTrue) {
          if (rule._exec) rule._exec();
          else this._execStmts(rule.body);
        }
      } catch (e) {
        console.warn(`[SimFlow] Rule '${rule.name}' error:`, e.message);
      }
    }

    this.tick++;
    this._recordHistory();
    this._checkTasks();

    if (this.ast.doneWhen) {
      if (this._eval(this.ast.doneWhen.condition)) {
        this.done = true; this._emit('done', {});
      }
    }

    this._emit('tick', { tick: this.tick, annotations: this._annotations });
    return !this.done;
  }

  // ── Event System ──────────────────────────────────────────────────────────

  on(event, handler) {
    (this._listeners[event] = this._listeners[event] || []).push(handler);
    return () => { this._listeners[event] = this._listeners[event].filter(h => h !== handler); };
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(h => h(data));
  }

  // ── Getters for renderer ──────────────────────────────────────────────────

  get stores() { return this._stores; }
  get params() { return this._params; }
  get paramDefs() { return this._paramDefs; }

  // Get history of a specific store's state
  getStoreHistory(storeName) {
    return this.history.map(h => h.stores[storeName]);
  }

  // Get history of a slot's entity (for Gantt)
  getSlotHistory(storeName) {
    return this.history.map(h => ({
      tick: h.tick,
      entity: h.stores[storeName] // slot snapshot is the entity or null
    }));
  }
}
