'use client';

/**
 * Evaluates the "Asked when" expressions from the assessment workbook, exactly as
 * they were written, so the condition stays editable text in the Control Centre
 * rather than something compiled away at seed time.
 *
 * The grammar the workbook actually uses:
 *   Always asked
 *   key is 'Value'
 *   key is not 'Value'
 *   key is greater than 0
 *   key is less than 10
 *   key                          (answered at all)
 *   A and B          A or B          (A) or (B)
 */

function tokenise(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({t: c}); i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { s += src[j]; j++; }
      out.push({t: 'str', v: s}); i = j + 1; continue;
    }
    let j = i, w = '';
    while (j < src.length && /[A-Za-z0-9_.\-]/.test(src[j])) { w += src[j]; j++; }
    if (!w) { i++; continue; }               // skip anything unexpected
    out.push({t: 'word', v: w}); i = j;
  }
  return out;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const isWord = w => peek() && peek().t === 'word' && peek().v.toLowerCase() === w;

  function parseOr() {
    let left = parseAnd();
    while (isWord('or')) { p++; left = {op: 'or', a: left, b: parseAnd()}; }
    return left;
  }
  function parseAnd() {
    let left = parseAtom();
    while (isWord('and')) { p++; left = {op: 'and', a: left, b: parseAtom()}; }
    return left;
  }
  function parseAtom() {
    if (peek() && peek().t === '(') {
      p++;
      const inner = parseOr();
      if (peek() && peek().t === ')') p++;
      return inner;
    }
    if (!peek() || peek().t !== 'word') { p++; return {op: 'true'}; }

    const key = tokens[p].v;
    if (key.toLowerCase() === 'always') { p = tokens.length; return {op: 'true'}; }
    p++;

    if (!isWord('is')) return {op: 'answered', key};
    p++;                                          // consume "is"

    if (isWord('not')) {
      p++;
      const v = peek(); p++;
      return {op: 'ne', key, value: v ? (v.v ?? '') : ''};
    }
    if (isWord('greater')) {
      p++; if (isWord('than')) p++;
      const v = peek(); p++;
      return {op: 'gt', key, value: Number(v ? v.v : 0)};
    }
    if (isWord('less')) {
      p++; if (isWord('than')) p++;
      const v = peek(); p++;
      return {op: 'lt', key, value: Number(v ? v.v : 0)};
    }
    const v = peek(); p++;
    return {op: 'eq', key, value: v ? (v.v ?? '') : ''};
  }

  const ast = parseOr();
  return ast;
}

const cache = new Map();

export function compile(expr) {
  const src = String(expr || '').trim();
  if (!src || /^always asked$/i.test(src)) return {op: 'true'};
  if (cache.has(src)) return cache.get(src);
  let ast;
  try { ast = parse(tokenise(src)); }
  catch { ast = {op: 'true'}; }               // an unreadable condition asks the question
  cache.set(src, ast);
  return ast;
}

function answered(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

export function evaluate(ast, answers) {
  switch (ast.op) {
    case 'true': return true;
    case 'and': return evaluate(ast.a, answers) && evaluate(ast.b, answers);
    case 'or': return evaluate(ast.a, answers) || evaluate(ast.b, answers);
    case 'answered': return answered(answers[ast.key]);
    case 'eq': return String(answers[ast.key] ?? '') === String(ast.value);
    case 'ne': return answered(answers[ast.key]) && String(answers[ast.key]) !== String(ast.value);
    case 'gt': return answered(answers[ast.key]) && Number(answers[ast.key]) > ast.value;
    case 'lt': return answered(answers[ast.key]) && Number(answers[ast.key]) < ast.value;
    default: return true;
  }
}

// Should this question be asked, given what has been answered so far?
export function shouldAsk(question, answers) {
  return evaluate(compile(question.askWhen), answers);
}
