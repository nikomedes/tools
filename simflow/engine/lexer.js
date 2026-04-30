/**
 * SimFlow Lexer
 * Converts .simflow source text into a token stream.
 */

export const TK = {
  INT: 'INT', FLOAT: 'FLOAT', STRING: 'STRING', BOOL: 'BOOL',
  IDENT: 'IDENT', KW: 'KW', STORE_TYPE: 'STORE_TYPE', PARAM_TYPE: 'PARAM_TYPE',
  LBRACE: 'LBRACE', RBRACE: 'RBRACE', LPAREN: 'LPAREN', RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
  COMMA: 'COMMA', COLON: 'COLON', DOT: 'DOT', DOTDOT: 'DOTDOT', SEMICOLON: 'SEMICOLON',
  PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH', PERCENT: 'PERCENT',
  EQ: 'EQ', NEQ: 'NEQ', LT: 'LT', GT: 'GT', LTE: 'LTE', GTE: 'GTE',
  AND: 'AND', OR: 'OR', NOT: 'NOT',
  ASSIGN: 'ASSIGN', PLUS_ASSIGN: 'PLUS_ASSIGN', MINUS_ASSIGN: 'MINUS_ASSIGN',
  ARROW: 'ARROW', PLACEHOLDER: 'PLACEHOLDER', QMARK: 'QMARK',
  EOF: 'EOF'
};

const KEYWORDS = new Set([
  'simulation','entity','store','param','setup','rule','when','event','done','tick',
  'view','task','at','use','extends','group','scoring','label','sublabel',
  'visual','visual_states','hint','hint_after','answer','prompt','penalty',
  'bonus','weights','series','source','x_axis','y_axis','color','color_by',
  'height_by','if','else','repeat','for','in','let','return','null','step',
  'format','enabled_when','on_change','max_points','per_wrong_attempt',
  'per_hint','max_deduction','fast_solve_sec','bonus_points','tolerance',
  'reveal_at','requires','validate','check','options','options_from','display',
  'weight','target','columns','show_wip_limit','ideal_line','selectable',
  'highlight_selected','tooltip','trigger','drives','except','placeholder',
  'widget','renderer','nodes_from','edges_from','highlight','x_by','y_by',
  'stats','value','style','labels','default','flash','trace','mark','compare',
  'pause','log','auto','from','type','start','condition','speed','default_ms',
  'min','max','selectable','moves_to','max_deduction','and'
]);

const STORE_TYPES = new Set(['Queue','Stack','Slot','List','Set','Grid','Tree','Graph','Table','Array']);
const PARAM_TYPES = new Set(['Int','Float','String','Bool','Color','Choice','Ref']);

export function tokenize(src) {
  const tokens = [];
  let i = 0, line = 1;

  const ch  = (n = 0) => src[i + n] ?? '';
  const adv = () => { const c = src[i++]; if (c === '\n') line++; return c; };
  const add = (type, value) => tokens.push({ type, value, line });

  while (i < src.length) {
    // Whitespace
    if (/\s/.test(ch())) { adv(); continue; }

    // Line comment
    if (ch() === '/' && ch(1) === '/') {
      while (i < src.length && ch() !== '\n') adv();
      continue;
    }

    // Placeholder ???
    if (ch() === '?' && ch(1) === '?' && ch(2) === '?') {
      add(TK.PLACEHOLDER, '???'); adv(); adv(); adv(); continue;
    }

    // String literal
    if (ch() === '"') {
      adv(); let s = '';
      while (i < src.length && ch() !== '"') {
        if (ch() === '\\') {
          adv();
          s += ({ n:'\n', t:'\t', r:'\r', '"':'"', '\\':'\\' }[ch()] ?? ch());
          adv();
        } else s += adv();
      }
      adv(); add(TK.STRING, s); continue;
    }

    // Numbers
    if (/\d/.test(ch())) {
      let n = '';
      while (/\d/.test(ch())) n += adv();
      if (ch() === '.' && ch(1) !== '.') {
        n += adv();
        while (/\d/.test(ch())) n += adv();
        add(TK.FLOAT, parseFloat(n));
      } else {
        add(TK.INT, parseInt(n));
      }
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch())) {
      let id = '';
      while (/[a-zA-Z0-9_]/.test(ch())) id += adv();
      if      (id === 'true')           add(TK.BOOL, true);
      else if (id === 'false')          add(TK.BOOL, false);
      else if (STORE_TYPES.has(id))     add(TK.STORE_TYPE, id);
      else if (PARAM_TYPES.has(id))     add(TK.PARAM_TYPE, id);
      else if (KEYWORDS.has(id))        add(TK.KW, id);
      else                              add(TK.IDENT, id);
      continue;
    }

    // Two-character operators
    const two = ch() + ch(1);
    const TWO_OPS = {
      '==': TK.EQ,  '!=': TK.NEQ, '<=': TK.LTE, '>=': TK.GTE,
      '&&': TK.AND, '||': TK.OR,  '+=': TK.PLUS_ASSIGN, '-=': TK.MINUS_ASSIGN,
      '=>': TK.ARROW, '..': TK.DOTDOT
    };
    if (TWO_OPS[two]) { add(TWO_OPS[two], two); adv(); adv(); continue; }

    // Single-character operators
    const ONE_OPS = {
      '{': TK.LBRACE, '}': TK.RBRACE, '(': TK.LPAREN, ')': TK.RPAREN,
      '[': TK.LBRACKET, ']': TK.RBRACKET, ',': TK.COMMA, ':': TK.COLON,
      ';': TK.SEMICOLON, '.': TK.DOT, '+': TK.PLUS, '-': TK.MINUS,
      '*': TK.STAR, '/': TK.SLASH, '%': TK.PERCENT, '=': TK.ASSIGN,
      '<': TK.LT, '>': TK.GT, '!': TK.NOT, '?': TK.QMARK
    };
    if (ONE_OPS[ch()]) { add(ONE_OPS[ch()], ch()); adv(); continue; }

    adv(); // skip unknown character
  }

  add(TK.EOF, null);
  return tokens;
}
