#!/usr/bin/env python3
import sys
import json

try:
    import pulp
except Exception as e:
    print(json.dumps({"error": "missing_dependency", "detail": str(e)}))
    sys.exit(2)


def safe_float(v, default=1.0):
    try:
        return float(v)
    except Exception:
        return float(default)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"error": "invalid_input", "detail": str(e)}))
        sys.exit(2)

    criteria = data.get('criteria', [])
    best = data.get('bestCriterion')
    worst = data.get('worstCriterion')
    best_to_others = data.get('bestToOthers', {}) or {}
    others_to_worst = data.get('othersToWorst', {}) or {}

    if not criteria or best not in criteria or worst not in criteria:
        print(json.dumps({"error": "invalid_criteria"}))
        sys.exit(2)

    prob = pulp.LpProblem('bwm', pulp.LpMinimize)
    w = {c: pulp.LpVariable(f"w__{c}", lowBound=0) for c in criteria}
    xi = pulp.LpVariable('xi', lowBound=0)

    prob += xi
    prob += pulp.lpSum([w[c] for c in criteria]) == 1

    for c in criteria:
        a_Bc = safe_float(best_to_others.get(c, 1.0), 1.0)
        a_cW = safe_float(others_to_worst.get(c, 1.0), 1.0)

        prob += w[best] - a_Bc * w[c] <= xi
        prob += a_Bc * w[c] - w[best] <= xi

        prob += w[c] - a_cW * w[worst] <= xi
        prob += a_cW * w[worst] - w[c] <= xi

    # Solve quietly
    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    status = pulp.LpStatus.get(prob.status, None) if hasattr(pulp, 'LpStatus') else None
    if status not in ('Optimal', None) and pulp.value(xi) is None:
        print(json.dumps({"error": "no_opt"}))
        sys.exit(3)

    weights = {c: float(pulp.value(w[c]) or 0.0) for c in criteria}
    total = sum(weights.values()) or 1.0
    normalized = {k: (v / total) for k, v in weights.items()}

    print(json.dumps({"weights": normalized}))


if __name__ == '__main__':
    main()
