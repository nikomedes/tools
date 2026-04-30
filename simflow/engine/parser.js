/**
 * SimFlow Parser
 * Recursive descent parser — produces an AST from the token stream.
 */

import { TK } from './lexer.js';

export function parse(tokens) {
  let pos = 0;

  const peek  = ()        => tokens[pos];
  const peek2 = ()        => tokens[pos + 1];
  const at    = (t, v)    => peek().type === t && (v === undefined || peek().value === v);
  const atKW  = (v)       => peek().type === TK.KW && (v === undefined || peek().value === v);
  const atAny = (...ts)   => ts.some(t => peek().type === t);

  const eat = (t, v) => {
    const tok = tokens[pos];
    if (t && tok.type !== t && tok.value !== t)
      throw new Error(`[SimFlow Parser] Expected ${t} but got ${tok.type}('${tok.value}') at line ${tok.line}`);
    if (v !== undefined && tok.value !== v)
      throw new Error(`[SimFlow Parser] Expected '${v}' but got '${tok.value}' at line ${tok.line}`);
    pos++;
    return tok;
  };

  const maybe  = (t, v) => { if (peek().type === t && (v === undefined || peek().value === v)) { return eat(t, v); } return null; };
  const maybeKW = v => maybe(TK.KW, v);
  const eatIdOrKW = () => at(TK.IDENT) ? eat(TK.IDENT) : at(TK.KW) ? eat(TK.KW) : eat(TK.PARAM_TYPE);

  // ── Top Level ─────────────────────────────────────────────────────────────

  function parseSimulation() {
    eat(TK.KW, 'simulation');
    const name = eat(TK.STRING).value;
    eat(TK.LBRACE);

    const sim = {
      type: 'simulation', name,
      entities: [], stores: [], params: [], groups: [],
      setup: null, rules: [], events: [], doneWhen: null,
      views: [], tasks: [], scoring: null, uses: []
    };

    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      const kw = peek().value;
      if      (kw === 'entity')  sim.entities.push(parseEntity());
      else if (kw === 'store')   sim.stores.push(parseStore());
      else if (kw === 'param')   sim.params.push(parseParam());
      else if (kw === 'group')   sim.groups.push(parseGroup());
      else if (kw === 'setup')   sim.setup = parseSetup();
      else if (kw === 'rule')    sim.rules.push(parseRule());
      else if (kw === 'event')   sim.events.push(parseEventDecl());
      else if (kw === 'done')    sim.doneWhen = parseDone();
      else if (kw === 'view')    sim.views.push(parseView());
      else if (kw === 'task')    sim.tasks.push(parseTask());
      else if (kw === 'scoring') sim.scoring = parseScoring();
      else if (kw === 'use')     sim.uses.push(parseUse());
      else { eat(TK.KW); } // skip unknown
    }
    eat(TK.RBRACE);
    return sim;
  }

  // ── Entity ────────────────────────────────────────────────────────────────

  function parseEntity() {
    eat(TK.KW, 'entity');
    const name = eat(TK.IDENT).value;
    eat(TK.LBRACE);
    const fields = [], meta = {};

    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      if (atKW('visual') && peek2().type === TK.COLON) {
        eat(TK.KW, 'visual'); eat(TK.COLON);
        meta.visual = eat(TK.STRING).value;
      } else if (atKW('visual_states')) {
        eat(TK.KW, 'visual_states'); eat(TK.COLON);
        meta.visual_states = parseObjectLit();
      } else if (atKW('label')) {
        eat(TK.KW, 'label'); eat(TK.COLON);
        meta.label = eat(TK.STRING).value;
      } else if (atKW('sublabel')) {
        eat(TK.KW, 'sublabel'); eat(TK.COLON);
        meta.sublabel = eat(TK.STRING).value;
      } else {
        const fname = eatIdOrKW().value;
        eat(TK.COLON);
        const ftype = parseTypeExpr();
        let dflt = null;
        if (maybe(TK.ASSIGN)) dflt = parseExpr();
        fields.push({ name: fname, type: ftype, default: dflt });
        maybe(TK.COMMA); maybe(TK.SEMICOLON);
      }
    }
    eat(TK.RBRACE);
    return { type: 'entity', name, fields, meta };
  }

  function parseTypeExpr() {
    if (at(TK.PARAM_TYPE)) {
      const base = eat(TK.PARAM_TYPE).value;
      if (base === 'Choice') {
        eat(TK.LPAREN);
        const opts = [];
        while (!at(TK.RPAREN) && !at(TK.EOF)) { opts.push(eat(TK.STRING).value); maybe(TK.COMMA); }
        eat(TK.RPAREN);
        return { base, opts };
      }
      if (at(TK.LPAREN)) {
        eat(TK.LPAREN);
        const min = eat(TK.INT).value; eat(TK.DOTDOT); const max = eat(TK.INT).value;
        eat(TK.RPAREN);
        return { base, min, max };
      }
      return { base };
    }
    if (at(TK.STORE_TYPE)) {
      const base = eat(TK.STORE_TYPE).value;
      let inner = null, size = null;
      if (at(TK.LT)) { eat(TK.LT); inner = parseTypeExpr(); eat(TK.GT); }
      if (at(TK.LPAREN)) { eat(TK.LPAREN); size = parseExpr(); eat(TK.RPAREN); }
      return { base, inner, size };
    }
    if (at(TK.IDENT)) return { base: eat(TK.IDENT).value };
    return { base: 'Any' };
  }

  // ── Store ─────────────────────────────────────────────────────────────────

  function parseStore() {
    eat(TK.KW, 'store');
    const name = eatIdOrKW().value;
    eat(TK.COLON);
    const storeType = eat(TK.STORE_TYPE).value;
    let entityType = null, size = null;
    if (at(TK.LT)) {
      eat(TK.LT);
      entityType = at(TK.PARAM_TYPE) ? eat(TK.PARAM_TYPE).value : eat(TK.IDENT).value;
      eat(TK.GT);
    }
    if (at(TK.LPAREN)) { eat(TK.LPAREN); size = parseExpr(); eat(TK.RPAREN); }
    return { type: 'store', name, storeType, entityType, size };
  }

  // ── Param ─────────────────────────────────────────────────────────────────

  function parseParam() {
    eat(TK.KW, 'param');
    const name = eatIdOrKW().value;
    eat(TK.COLON);
    const ptype = parseTypeExpr();
    let dflt = null;
    if (maybe(TK.ASSIGN)) dflt = parseExpr();
    const mods = {};
    const MOD_KWS = new Set(['label','sublabel','step','format','enabled_when','on_change','widget','placeholder','labels','min','max']);
    while (atKW() && MOD_KWS.has(peek().value)) {
      const mod = eat(TK.KW).value; maybe(TK.COLON);
      mods[mod] = at(TK.STRING) ? eat(TK.STRING).value : parseExpr();
    }
    return { type: 'param', name, ptype, default: dflt, mods };
  }

  function parseGroup() {
    eat(TK.KW, 'group');
    const name = eat(TK.STRING).value;
    eat(TK.LBRACE);
    const params = [];
    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      if (atKW('param')) params.push(parseParam());
      else eat(TK.KW);
    }
    eat(TK.RBRACE);
    return { type: 'group', name, params };
  }

  // ── Setup / Rule / Event ──────────────────────────────────────────────────

  function parseSetup() {
    eat(TK.KW, 'setup'); eat(TK.LBRACE);
    const body = parseStmts(); eat(TK.RBRACE);
    return { type: 'setup', body };
  }

  function parseRule() {
    eat(TK.KW, 'rule');
    const name = eat(TK.IDENT).value;
    eat(TK.KW, 'when');
    const condition = parseExpr();
    eat(TK.LBRACE);
    const body = parseStmts();
    eat(TK.RBRACE);
    return { type: 'rule', name, condition, body };
  }

  function parseEventDecl() {
    eat(TK.KW, 'event');
    const name = eat(TK.IDENT).value;
    const params = [];
    if (at(TK.LPAREN)) {
      eat(TK.LPAREN);
      while (!at(TK.RPAREN) && !at(TK.EOF)) {
        const pname = eat(TK.IDENT).value; eat(TK.COLON);
        const ptype = parseTypeExpr();
        let fromP = null;
        if (atKW('from')) { eat(TK.KW); fromP = eat(TK.IDENT).value; }
        params.push({ name: pname, type: ptype, from: fromP });
        maybe(TK.COMMA);
      }
      eat(TK.RPAREN);
    }
    eat(TK.LBRACE);
    const body = parseStmts();
    eat(TK.RBRACE);
    return { type: 'event', name, params, body };
  }

  function parseDone() {
    eat(TK.KW, 'done'); eat(TK.KW, 'when');
    return { type: 'done', condition: parseExpr() };
  }

  // ── View / Task / Scoring / Use ───────────────────────────────────────────

  function parseView() {
    eat(TK.KW, 'view');
    const name = eat(TK.IDENT).value;
    eat(TK.LBRACE);
    const props = parseKVBlock();
    eat(TK.RBRACE);
    return { type: 'view', name, props };
  }

  function parseTask() {
    eat(TK.KW, 'task');
    const label = eat(TK.STRING).value;
    eat(TK.KW, 'at');
    const trigger = parseTrigger();
    eat(TK.LBRACE);
    const props = parseKVBlock();
    eat(TK.RBRACE);
    return { type: 'task', label, trigger, props };
  }

  function parseTrigger() {
    if (atKW('tick'))  { eat(TK.KW); eat(TK.LPAREN); const n = parseExpr(); eat(TK.RPAREN); return { type: 'tick', n }; }
    if (atKW('done'))  { eat(TK.KW); return { type: 'done' }; }
    if (atKW('start')) { eat(TK.KW); return { type: 'tick', n: { type: 'literal', value: 0 } }; }
    if (atKW('event')) {
      eat(TK.KW); eat(TK.LPAREN);
      const name = eat(TK.IDENT).value;
      eat(TK.RPAREN);
      return { type: 'event', name };
    }
    if (atKW('condition')) {
      eat(TK.KW); eat(TK.LPAREN);
      const expr = parseExpr();
      eat(TK.RPAREN);
      return { type: 'condition', expr };
    }
    return { type: 'condition', expr: parseExpr() };
  }

  function parseScoring() {
    eat(TK.KW, 'scoring'); eat(TK.LBRACE);
    const props = parseKVBlock();
    eat(TK.RBRACE);
    return { type: 'scoring', props };
  }

  function parseUse() {
    eat(TK.KW, 'use');
    const name = at(TK.PARAM_TYPE) ? eat(TK.PARAM_TYPE).value : eat(TK.IDENT).value;
    const args = {};
    if (at(TK.LPAREN)) {
      eat(TK.LPAREN);
      while (!at(TK.RPAREN) && !at(TK.EOF)) {
        const k = eatIdOrKW().value; eat(TK.COLON);
        args[k] = eatIdOrKW().value;
        maybe(TK.COMMA);
      }
      eat(TK.RPAREN);
    }
    let excpt = null;
    if (atKW('except')) {
      eat(TK.KW); eat(TK.LBRACE);
      excpt = [];
      while (!at(TK.RBRACE) && !at(TK.EOF)) {
        if (atKW('rule')) excpt.push(parseRule());
        else eat(TK.KW);
      }
      eat(TK.RBRACE);
    }
    return { type: 'use', name, args, except: excpt };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function parseKVBlock() {
    const props = {};
    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      const key = at(TK.STRING) ? eat(TK.STRING).value : eatIdOrKW().value;
      maybe(TK.COLON);
      props[key] = parseValueOrBlock();
      maybe(TK.COMMA);
    }
    return props;
  }

  function parseValueOrBlock() {
    if (at(TK.LBRACE)) return parseObjectLit();
    if (at(TK.LBRACKET)) {
      eat(TK.LBRACKET);
      const els = [];
      while (!at(TK.RBRACKET) && !at(TK.EOF)) {
        els.push(at(TK.LBRACE) ? parseObjectLit() : parseExpr());
        maybe(TK.COMMA);
      }
      eat(TK.RBRACKET);
      return { type: 'array_literal', elements: els };
    }
    return parseExpr();
  }

  function parseObjectLit() {
    eat(TK.LBRACE);
    const obj = {};
    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      const key = at(TK.STRING) ? eat(TK.STRING).value : eatIdOrKW().value; eat(TK.COLON);
      obj[key] = parseValueOrBlock();
      maybe(TK.COMMA);
    }
    eat(TK.RBRACE);
    return obj;
  }

  // ── Statements ────────────────────────────────────────────────────────────

  function parseStmts() {
    const stmts = [];
    while (!at(TK.RBRACE) && !at(TK.EOF)) {
      stmts.push(parseStmt());
      maybe(TK.SEMICOLON);
    }
    return stmts;
  }

  function parseStmt() {
    if (atKW('if'))     return parseIf();
    if (atKW('repeat')) return parseRepeat();
    if (atKW('for'))    return parseFor();
    if (atKW('let'))    return parseLet();
    if (atKW('return')) { eat(TK.KW); return { type: 'return', value: parseExpr() }; }

    const ANNOTATIONS = new Set(['highlight','flash','mark','compare','trace','pause']);
    if (atKW() && ANNOTATIONS.has(peek().value)) {
      const fn = eat(TK.KW).value; eat(TK.LPAREN);
      const args = parseArgList(); eat(TK.RPAREN);
      return { type: 'annotation', fn, args };
    }

    const expr = parseExpr();
    if (at(TK.ASSIGN) || at(TK.PLUS_ASSIGN) || at(TK.MINUS_ASSIGN)) {
      const op = eat(peek().type).value;
      const right = parseExpr();
      return { type: 'assign', op, target: expr, value: right };
    }
    return { type: 'expr_stmt', expr };
  }

  function parseIf() {
    eat(TK.KW, 'if'); eat(TK.LPAREN);
    const cond = parseExpr(); eat(TK.RPAREN);
    eat(TK.LBRACE); const then = parseStmts(); eat(TK.RBRACE);
    let els = null;
    if (atKW('else')) {
      eat(TK.KW);
      if (atKW('if')) els = [parseIf()];
      else { eat(TK.LBRACE); els = parseStmts(); eat(TK.RBRACE); }
    }
    return { type: 'if', cond, then, else: els };
  }

  function parseRepeat() {
    eat(TK.KW, 'repeat');
    const count = parseExpr();
    eat(TK.LBRACE); const body = parseStmts(); eat(TK.RBRACE);
    return { type: 'repeat', count, body };
  }

  function parseFor() {
    eat(TK.KW, 'for');
    const varName = eat(TK.IDENT).value;
    eat(TK.KW, 'in');
    const iter = parseExpr();
    eat(TK.LBRACE); const body = parseStmts(); eat(TK.RBRACE);
    return { type: 'for', var: varName, iter, body };
  }

  function parseLet() {
    eat(TK.KW, 'let');
    const name = eat(TK.IDENT).value; eat(TK.ASSIGN);
    return { type: 'let', name, value: parseExpr() };
  }

  // ── Expressions ───────────────────────────────────────────────────────────

  function parseExpr() {
    const cond = parseOr();
    if (!at(TK.QMARK)) return cond;
    eat(TK.QMARK);
    const then = parseExpr();
    eat(TK.COLON);
    const els = parseExpr();
    return { type: 'ternary', cond, then, else: els };
  }

  const binop = (higher, ...ops) => () => {
    let left = higher();
    while (ops.some(op => peek().type === op || peek().value === op)) {
      const op = tokens[pos++].value;
      left = { type: 'binop', op, left, right: higher() };
    }
    return left;
  };

  const parseOr  = binop(() => parseAnd(), TK.OR);
  const parseAnd = binop(() => parseEq(),  TK.AND);
  const parseEq  = binop(() => parseCmp(), TK.EQ, TK.NEQ);
  const parseCmp = binop(() => parseAdd(), TK.LT, TK.GT, TK.LTE, TK.GTE);
  const parseAdd = binop(() => parseMul(), TK.PLUS, TK.MINUS);
  const parseMul = binop(() => parseUnary(), TK.STAR, TK.SLASH, TK.PERCENT);

  function parseUnary() {
    if (at(TK.NOT))   { eat(TK.NOT);   return { type: 'unop', op: '!', operand: parseUnary() }; }
    if (at(TK.MINUS)) { eat(TK.MINUS); return { type: 'unop', op: '-', operand: parseUnary() }; }
    return parsePostfix();
  }

  function parsePostfix() {
    let expr = parsePrimary();
    while (true) {
      if (at(TK.DOT)) {
        eat(TK.DOT);
        const member = eatIdOrKW().value;
        if (at(TK.LPAREN)) {
          eat(TK.LPAREN); const args = parseArgList(); eat(TK.RPAREN);
          expr = { type: 'method_call', obj: expr, method: member, args };
        } else {
          expr = { type: 'member', obj: expr, member };
        }
      } else if (at(TK.LBRACKET)) {
        eat(TK.LBRACKET); const idx = parseExpr(); eat(TK.RBRACKET);
        expr = { type: 'index', obj: expr, idx };
      } else break;
    }
    return expr;
  }

  function parsePrimary() {
    if (at(TK.INT))         return { type: 'literal', value: eat(TK.INT).value };
    if (at(TK.FLOAT))       return { type: 'literal', value: eat(TK.FLOAT).value };
    if (at(TK.STRING))      return { type: 'literal', value: eat(TK.STRING).value };
    if (at(TK.BOOL))        return { type: 'literal', value: eat(TK.BOOL).value };
    if (at(TK.PLACEHOLDER)) { eat(TK.PLACEHOLDER); return { type: 'placeholder' }; }
    if (atKW('null'))       { eat(TK.KW); return { type: 'literal', value: null }; }
    if (atKW('auto'))       { eat(TK.KW); return { type: 'literal', value: 'auto' }; }

    if (at(TK.LPAREN)) {
      // Check for lambda: (x) => or (x, y) =>
      if (isLambdaAhead()) return parseLambda();
      eat(TK.LPAREN); const e = parseExpr(); eat(TK.RPAREN); return e;
    }

    if (at(TK.LBRACKET)) {
      eat(TK.LBRACKET);
      const els = [];
      while (!at(TK.RBRACKET) && !at(TK.EOF)) { els.push(parseExpr()); maybe(TK.COMMA); }
      eat(TK.RBRACKET);
      return { type: 'array_literal', elements: els };
    }

    // Entity constructor: TypeName { ... }  (uppercase first letter distinguishes from block statements)
    if ((at(TK.PARAM_TYPE) || (at(TK.IDENT) && /^[A-Z]/.test(peek().value))) && peek2()?.type === TK.LBRACE) {
      const tname = at(TK.PARAM_TYPE) ? eat(TK.PARAM_TYPE).value : eat(TK.IDENT).value;
      return { type: 'constructor', entity: tname, fields: parseObjectLit() };
    }

    // Single-param lambda: x => expr
    if (at(TK.IDENT) && peek2()?.type === TK.ARROW) {
      const param = eat(TK.IDENT).value; eat(TK.ARROW);
      return { type: 'lambda', params: [param], body: parseExpr() };
    }

    if (at(TK.IDENT))       return { type: 'ident', name: eat(TK.IDENT).value };
    if (at(TK.KW))          return { type: 'ident', name: eat(TK.KW).value };
    if (at(TK.PARAM_TYPE))  return { type: 'ident', name: eat(TK.PARAM_TYPE).value };
    if (at(TK.STORE_TYPE))  return { type: 'ident', name: eat(TK.STORE_TYPE).value };

    throw new Error(`[SimFlow Parser] Unexpected token: ${peek().type}('${peek().value}') at line ${peek().line}`);
  }

  function isLambdaAhead() {
    let depth = 0;
    for (let k = pos; k < tokens.length && k < pos + 30; k++) {
      if (tokens[k].type === TK.LPAREN) depth++;
      if (tokens[k].type === TK.RPAREN) {
        depth--;
        if (depth === 0) return tokens[k + 1]?.type === TK.ARROW;
      }
    }
    return false;
  }

  function parseLambda() {
    eat(TK.LPAREN);
    const params = [];
    while (!at(TK.RPAREN) && !at(TK.EOF)) { params.push(eat(TK.IDENT).value); maybe(TK.COMMA); }
    eat(TK.RPAREN); eat(TK.ARROW);
    return { type: 'lambda', params, body: parseExpr() };
  }

  function parseArgList() {
    const args = [];
    while (!at(TK.RPAREN) && !at(TK.EOF)) {
      args.push(parseExpr()); maybe(TK.COMMA);
    }
    return args;
  }

  return parseSimulation();
}
