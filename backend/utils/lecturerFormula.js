// A tiny, SAFE formula calculator for lecturer salaries (no eval).
//
// Formulas are typed by the super admin, e.g.
//     attendance * subFee * percentage%
//     attendance * subFee * percentage% * (1 - 5%)
//     min(attendance * subFee * percentage%, 100000)
//
// What can be used:
//   names      attendance, subFee, percentage      (not case sensitive)
//   numbers    12   2500   0.5
//   operators  +  -  *  /  ( )     (x and × also mean multiply, ÷ means divide)
//   percent    a number or name followed by %  means "divided by 100"   (5% = 0.05)
//              BUT right after + or - it means "that % of the left side":
//              attendance * subFee * percentage% - 5%   takes 5% off the salary
//   functions  min(a, b, ...)   max(a, b, ...)   round(a)   floor(a)
//
// The same logic is copied in frontend/src/utils/lecturerFormula.js for the live preview.
// The server always re-calculates, so what is saved is what the server worked out.

const VARIABLES = ['attendance', 'subFee', 'percentage', 'hours', 'hourRate'];
const VARIABLE_LOOKUP = new Map(VARIABLES.map((v) => [v.toLowerCase(), v]));
const FUNCTIONS = {
  min: { fn: Math.min, minArgs: 2 },
  max: { fn: Math.max, minArgs: 2 },
  round: { fn: Math.round, minArgs: 1, maxArgs: 1 },
  floor: { fn: Math.floor, minArgs: 1, maxArgs: 1 }, // drops the cents: floor(1923.75) = 1923
};
const MAX_LENGTH = 200;

class FormulaError extends Error {}

function tokenize(source) {
  const text = source.replace(/×/g, '*').replace(/÷/g, '/');
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i += 1; continue; }

    const number = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(i));
    if (number) { tokens.push({ type: 'num', value: Number(number[0]) }); i += number[0].length; continue; }

    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (word) {
      // a lone x / X means multiply ("attendance x subFee")
      tokens.push(/^[xX]$/.test(word[0]) ? { type: 'op', value: '*' } : { type: 'name', value: word[0] });
      i += word[0].length;
      continue;
    }

    if ('+-*/(),%'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i += 1; continue; }

    throw new FormulaError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

// Recursive-descent parser. Returns { ast, variables } (variables = names the formula uses).
function parseFormula(source) {
  if (typeof source !== 'string' || !source.trim()) throw new FormulaError('Type a formula');
  if (source.length > MAX_LENGTH) throw new FormulaError(`The formula is too long (max ${MAX_LENGTH} characters)`);

  const tokens = tokenize(source);
  const used = new Set();
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;
  const take = () => tokens[pos++];

  function expression() {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = take().value;
      left = { t: 'bin', op, l: left, r: term() };
    }
    return left;
  }

  function term() {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = take().value;
      left = { t: 'bin', op, l: left, r: unary() };
    }
    return left;
  }

  function unary() {
    if (isOp('-')) { take(); return { t: 'neg', a: unary() }; }
    if (isOp('+')) { take(); return unary(); }
    return postfix();
  }

  function postfix() {
    let node = primary();
    while (isOp('%')) { take(); node = { t: 'pct', a: node }; }
    return node;
  }

  function primary() {
    const tok = take();
    if (!tok) throw new FormulaError('The formula ends too early');

    if (tok.type === 'num') return { t: 'num', v: tok.value };

    if (tok.type === 'name') {
      const lower = tok.value.toLowerCase();
      if (isOp('(')) {
        const spec = FUNCTIONS[lower];
        if (!spec) throw new FormulaError(`Unknown function "${tok.value}". You can use: min, max, round, floor`);
        take();
        const args = [];
        if (!isOp(')')) {
          args.push(expression());
          while (isOp(',')) { take(); args.push(expression()); }
        }
        if (!isOp(')')) throw new FormulaError('A ")" is missing');
        take();
        if (args.length < spec.minArgs || (spec.maxArgs && args.length > spec.maxArgs)) {
          throw new FormulaError(`${lower}() needs ${spec.maxArgs ? `${spec.minArgs}` : `at least ${spec.minArgs}`} value(s)`);
        }
        return { t: 'call', fn: lower, args };
      }
      const variable = VARIABLE_LOOKUP.get(lower);
      if (!variable) throw new FormulaError(`Unknown name "${tok.value}". You can use: ${VARIABLES.join(', ')}`);
      used.add(variable);
      return { t: 'var', name: variable };
    }

    if (tok.value === '(') {
      const inner = expression();
      if (!isOp(')')) throw new FormulaError('A ")" is missing');
      take();
      return inner;
    }

    throw new FormulaError(`Unexpected "${tok.value}"`);
  }

  const ast = expression();
  if (pos < tokens.length) throw new FormulaError(`Unexpected "${tokens[pos].value}"`);
  return { ast, variables: [...used] };
}

function run(node, values) {
  switch (node.t) {
    case 'num': return node.v;
    case 'var': return values[node.name];
    case 'neg': return -run(node.a, values);
    case 'pct': return run(node.a, values) / 100;
    case 'call': return FUNCTIONS[node.fn].fn(...node.args.map((a) => run(a, values)));
    default: {
      const l = run(node.l, values);
      let r = run(node.r, values);
      // Calculator style: "1000 - 5%" means 5% OF 1000 is taken off (950), not 0.05 taken off.
      if ((node.op === '+' || node.op === '-') && node.r.t === 'pct') r = l * r;
      if (node.op === '+') return l + r;
      if (node.op === '-') return l - r;
      if (node.op === '*') return l * r;
      if (r === 0) throw new FormulaError('The formula divides by zero');
      return l / r;
    }
  }
}

// Works the formula out. values = { attendance, subFee, percentage } (numbers).
// Returns the amount rounded to 2 decimals. Throws FormulaError if the result is not a
// sensible, non-negative amount (allowNegative: true skips the negative check - used when
// only testing that a formula is written correctly).
function evaluateFormula(source, values, { allowNegative = false } = {}) {
  const { ast } = parseFormula(source);
  const result = run(ast, values);
  if (!Number.isFinite(result)) throw new FormulaError('The formula does not give a valid number');
  if (result < 0 && !allowNegative) throw new FormulaError('The formula gives a negative salary');
  return Math.round(result * 100) / 100;
}

module.exports = { VARIABLES, FormulaError, parseFormula, evaluateFormula };