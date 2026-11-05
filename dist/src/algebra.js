// Parse a small arithmetic grammar without executing player input.
export function parseLinear(source) {
  const input = source.replace(/\s+/g, '').toLowerCase();
  const tokens = input.match(/\d*\.?\d+|[a-z]|[()+*/-]/g) || [];
  if (!input || tokens.join('') !== input || input.length > 160) throw new Error('Use numbers, one letter, and arithmetic symbols.');
  const letters = new Set(tokens.filter(t => /^[a-z]$/.test(t)));
  if (letters.size > 1) throw new Error('Use the same letter throughout.');
  let index = 0;
  const scale = (p, n) => ({ a: p.a * n, b: p.b * n });
  function atom() {
    const token = tokens[index++];
    if (token === '+' || token === '-') return scale(atom(), token === '-' ? -1 : 1);
    if (token === '(') {
      const result = sum();
      if (tokens[index++] !== ')') throw new Error('Check your parentheses.');
      return result;
    }
    if (/^[a-z]$/.test(token || '')) return { a: 1, b: 0 };
    if (token && /^\d*\.?\d+$/.test(token)) return { a: 0, b: Number(token) };
    throw new Error('Check your expression.');
  }
  function product() {
    let value = atom();
    while (index < tokens.length) {
      const token = tokens[index];
      const implicit = token === '(' || /^[a-z0-9.]/.test(token);
      if (!implicit && token !== '*' && token !== '/') break;
      if (!implicit) index++;
      const right = atom();
      if (token === '/') {
        if (right.a || !right.b) throw new Error('Divide only by a nonzero number.');
        value = scale(value, 1 / right.b);
      } else {
        if (value.a && right.a) throw new Error('Use a linear equation.');
        value = { a: value.a * right.b + right.a * value.b, b: value.b * right.b };
      }
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const sign = tokens[index++] === '+' ? 1 : -1;
      const right = product();
      value = { a: value.a + sign * right.a, b: value.b + sign * right.b };
    }
    return value;
  }
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result.a + result.b)) throw new Error('Check your expression.');
  return { ...result, variable: [...letters][0] };
}

export function assessAnswer(equation, solution, { basketCount = 3, totalApples = 12, expected = null, answer = null, hint = null, correctDetail = null } = {}) {
  let equationCorrect = false;
  let solutionCorrect = false;
  const applesPerBasket = totalApples / basketCount;
  const target = expected || { left: [basketCount, 0], right: [0, totalApples] };
  const correctValue = answer ?? applesPerBasket;
  let detail = hint || `Show ${basketCount} equal baskets making ${totalApples}: for example, ${basketCount}b = ${totalApples}.`;
  let variable = 'b';
  try {
    const sides = equation.split('=');
    if (sides.length !== 2) throw new Error('Include one equals sign and variable.');
    const left = parseLinear(sides[0]);
    const right = parseLinear(sides[1]);
    if (left.variable && right.variable && left.variable !== right.variable) throw new Error('Use the same letter throughout.');
    variable = left.variable || right.variable || 'b';
    const match = (a, b, l, r) => Math.abs(a.a - l[0]) < 1e-8 && Math.abs(a.b - l[1]) < 1e-8 && Math.abs(b.a - r[0]) < 1e-8 && Math.abs(b.b - r[1]) < 1e-8;
    equationCorrect = match(left, right, target.left, target.right) || match(right, left, target.left, target.right);
    if (equationCorrect) detail = correctDetail || `Your equation shows ${basketCount} equal baskets with ${totalApples} apples altogether.`;
  } catch (error) { detail = error.message; }
  try {
    const value = parseLinear(solution);
    solutionCorrect = !value.variable && Math.abs(value.b - correctValue) < 1e-8;
  } catch { /* Invalid numeric input receives feedback on the paper. */ }
  return { equationCorrect, solutionCorrect, detail, variable };
}

// Parse named linear systems without evaluating player input as JavaScript.
export function parseNamedLinear(source, variables) {
  const input = source.replace(/\s+/g, '').toLowerCase();
  if (!input || input.length > 160) throw new Error('Enter a linear expression.');
  const tokens = input.match(/\d*\.?\d+|[a-z]|[()+*/-]/g) || [];
  if (tokens.join('') !== input) throw new Error('Use numbers, named letters, and arithmetic symbols.');
  let index = 0;
  const constant = n => [...variables.map(() => 0), n];
  const scale = (v, n) => v.map(x => x * n);
  const hasVariable = v => v.slice(0, -1).some(x => x !== 0);
  function atom() {
    const token = tokens[index++];
    if (token === '+' || token === '-') return scale(atom(), token === '-' ? -1 : 1);
    if (token === '(') {
      const value = sum();
      if (tokens[index++] !== ')') throw new Error('Check parentheses.');
      return value;
    }
    if (/^[a-z]$/.test(token || '')) {
      if (!variables.includes(token)) throw new Error('Use the variables named in the question.');
      const value = constant(0); value[variables.indexOf(token)] = 1; return value;
    }
    if (/^\d*\.?\d+$/.test(token || '')) return constant(Number(token));
    throw new Error('Check the expression.');
  }
  function product() {
    let value = atom();
    while (index < tokens.length) {
      const token = tokens[index];
      const implicit = token === '(' || /^[a-z0-9.]/.test(token);
      if (!implicit && token !== '*' && token !== '/') break;
      if (!implicit) index++;
      const right = atom();
      if (token === '/') {
        if (hasVariable(right) || !right.at(-1)) throw new Error('Divide only by a nonzero number.');
        value = scale(value, 1 / right.at(-1));
      } else {
        if (hasVariable(value) && hasVariable(right)) throw new Error('Use linear relationships.');
        value = hasVariable(right) ? scale(right, value.at(-1)) : scale(value, right.at(-1));
      }
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const sign = tokens[index++] === '+' ? 1 : -1;
      const right = product(); value = value.map((x, i) => x + sign * right[i]);
    }
    return value;
  }
  const value = sum();
  if (index !== tokens.length || value.some(x => !Number.isFinite(x))) throw new Error('Check the expression.');
  return value;
}

export function assessSystem(equations, solutions, puzzle) {
  const variables = Object.keys(puzzle.values);
  const row = equation => {
    const sides = equation.split('=');
    if (sides.length !== 2) throw new Error('Each equation needs one equals sign.');
    const left = parseNamedLinear(sides[0], variables), right = parseNamedLinear(sides[1], variables);
    const result = left.map((x, i) => x - right[i]);
    const pivot = result.find(x => Math.abs(x) > 1e-8);
    if (!pivot) throw new Error('Write a relationship from the question.');
    return result.map(x => x / pivot);
  };
  let equationCorrect = false, detail = 'Write one equation for each clue, using the named variables.';
  try {
    const expected = puzzle.equations.map(row), actual = equations.map(row);
    const remaining = [...expected];
    equationCorrect = actual.length === expected.length && actual.every(value => {
      const match = remaining.findIndex(target => target.every((x, i) => Math.abs(x - value[i]) < 1e-8));
      if (match < 0) return false;
      remaining.splice(match, 1); return true;
    });
    if (equationCorrect) detail = 'Your equations match all the relationships in the question.';
  } catch (error) { detail = error.message; }
  const solutionCorrect = variables.every(variable => {
    try { const value = parseLinear(solutions[variable] || ''); return !value.variable && Math.abs(value.b - puzzle.values[variable]) < 1e-8; } catch { return false; }
  });
  return { equationCorrect, solutionCorrect, detail };
}
