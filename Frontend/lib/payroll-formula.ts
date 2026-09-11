/** Matches the payroll engine: component codes, + - * /, parentheses. Missing codes and / 0 are 0. */
export function evaluatePayrollFormula(
  expression: string,
  lookup: (code: string) => number
): number {
  const expr = (expression ?? "").trim();
  if (!expr) return 0;

  const resolved = expr.replace(/[A-Z_][A-Z0-9_]*/gi, (token) => {
    const value = lookup(token);
    return Number.isFinite(value) ? String(value) : "0";
  });

  try {
    return Math.round(evaluateArithmetic(resolved.replace(/\s/g, "")) * 100) / 100;
  } catch {
    return 0;
  }
}

function evaluateArithmetic(expr: string): number {
  let pos = 0;

  const parseExpression = (): number => {
    let result = parseTerm();
    while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
      const op = expr[pos++];
      const term = parseTerm();
      result = op === "+" ? result + term : result - term;
    }
    return result;
  };

  const parseTerm = (): number => {
    let result = parseFactor();
    while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
      const op = expr[pos++];
      const factor = parseFactor();
      result = op === "*" ? result * factor : factor !== 0 ? result / factor : 0;
    }
    return result;
  };

  const parseFactor = (): number => {
    if (pos < expr.length && expr[pos] === "(") {
      pos++;
      const result = parseExpression();
      if (pos < expr.length && expr[pos] === ")") pos++;
      return result;
    }

    let negative = false;
    if (pos < expr.length && expr[pos] === "-") {
      negative = true;
      pos++;
    }

    const start = pos;
    while (pos < expr.length && (isDigit(expr[pos]) || expr[pos] === ".")) pos++;
    const n = Number.parseFloat(expr.slice(start, pos));
    const value = Number.isFinite(n) ? n : 0;
    return negative ? -value : value;
  };

  return parseExpression();
}

function isDigit(ch: string) {
  return ch >= "0" && ch <= "9";
}
