/**
 * SimFlow Scoring & Event Recording
 * Tracks student interactions, evaluates task answers, computes scores.
 */

export class ScoringEngine {
  constructor(ast) {
    this.ast         = ast;
    this.scoringDef  = ast.scoring || null;
    this.events      = [];          // full event log
    this.taskResults = {};          // taskLabel → { attempts, hints, correct, ... }
    this.startTime   = Date.now();
    this._taskAttempts = {};
    this._taskHints    = {};
    this._taskStart    = {};
  }

  // ── Event Logging ──────────────────────────────────────────────────────────

  log(type, data = {}) {
    const event = {
      type,
      tick:       data.tick ?? 0,
      timestamp:  Date.now(),
      elapsed_ms: Date.now() - this.startTime,
      ...data
    };
    this.events.push(event);
    return event;
  }

  logParamChange(name, from, to) {
    return this.log('param_change', { name, from, to });
  }

  logSimStart(params) {
    return this.log('sim_start', { params });
  }

  logReset() {
    return this.log('sim_reset');
  }

  logTaskPresented(taskLabel) {
    this._taskStart[taskLabel] = Date.now();
    this._taskAttempts[taskLabel] = 0;
    this._taskHints[taskLabel]    = 0;
    return this.log('task_presented', { task: taskLabel });
  }

  logTaskAnswer(taskLabel, given, correct, correctAnswer) {
    this._taskAttempts[taskLabel] = (this._taskAttempts[taskLabel] || 0) + 1;
    const attempts  = this._taskAttempts[taskLabel];
    const hints     = this._taskHints[taskLabel] || 0;
    const elapsed   = Date.now() - (this._taskStart[taskLabel] || this.startTime);

    const event = this.log('task_answer', {
      task:           taskLabel,
      given_answer:   given,
      correct_answer: correctAnswer,
      correct,
      attempt:        attempts,
      hints_used:     hints,
      time_ms:        elapsed,
    });

    if (correct || attempts >= 5) {
      const score = this._computeTaskScore(taskLabel, correct, attempts, hints, elapsed);
      this.taskResults[taskLabel] = {
        correct, attempts, hints_used: hints,
        time_ms: elapsed, given_answer: given,
        correct_answer: correctAnswer, score,
      };
    }

    return event;
  }

  logHintRequested(taskLabel) {
    this._taskHints[taskLabel] = (this._taskHints[taskLabel] || 0) + 1;
    return this.log('hint_requested', {
      task:    taskLabel,
      attempt: this._taskAttempts[taskLabel] || 0,
    });
  }

  logSimDone(tick, params) {
    const score = this.totalScore();
    return this.log('sim_done', { tick, params, score, total_time_ms: Date.now() - this.startTime });
  }

  // ── Score Computation ──────────────────────────────────────────────────────

  _computeTaskScore(taskLabel, correct, attempts, hints, elapsed_ms) {
    if (!correct) return 0;

    const sc = this.scoringDef?.props;
    if (!sc) {
      // Default: 1.0 base, -0.2 per extra attempt, -0.25 per hint
      const base = 1.0;
      const deduction = Math.min(0.5,
        (Math.max(0, attempts - 1) * 0.2) + (hints * 0.25)
      );
      return Math.max(0, base - deduction);
    }

    const penalty       = sc.penalty || {};
    const perAttempt    = penalty.per_wrong_attempt?.value ?? penalty.per_wrong_attempt ?? 0.2;
    const perHint       = penalty.per_hint?.value ?? penalty.per_hint ?? 0.25;
    const maxDeduction  = penalty.max_deduction?.value ?? penalty.max_deduction ?? 0.5;

    const deduction = Math.min(maxDeduction,
      (Math.max(0, attempts - 1) * perAttempt) + (hints * perHint)
    );

    let score = Math.max(0, 1.0 - deduction);

    // Bonus for fast solve
    const bonus = sc.bonus || {};
    const fastSec = bonus.fast_solve_sec?.value ?? bonus.fast_solve_sec;
    const bonusPts = bonus.bonus_points?.value ?? bonus.bonus_points ?? 0;
    if (fastSec && elapsed_ms / 1000 < fastSec) score += bonusPts;

    return Math.min(1.0, score);
  }

  totalScore() {
    const tasks   = Object.entries(this.taskResults);
    if (tasks.length === 0) return null;

    const sc       = this.scoringDef?.props;
    const weights  = sc?.weights || {};
    const maxPts   = sc?.max_points?.value ?? sc?.max_points ?? 10;

    let weightedSum = 0, totalWeight = 0;
    tasks.forEach(([label, result]) => {
      const w = weights[label]?.value ?? weights[label] ?? 1.0;
      weightedSum += result.score * w;
      totalWeight += w;
    });

    const normalised = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.round(normalised * maxPts * 10) / 10;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  toJSON() {
    return {
      simulation:   this.ast.name,
      started_at:   new Date(this.startTime).toISOString(),
      duration_sec: Math.round((Date.now() - this.startTime) / 1000),
      events:       this.events,
      task_results: this.taskResults,
      total_score:  this.totalScore(),
    };
  }

  toCSV() {
    const rows = [['task', 'correct', 'attempts', 'hints_used', 'time_sec', 'score']];
    for (const [label, r] of Object.entries(this.taskResults)) {
      rows.push([label, r.correct, r.attempts, r.hints_used,
                 Math.round(r.time_ms / 1000), r.score]);
    }
    return rows.map(r => r.join(',')).join('\n');
  }
}
