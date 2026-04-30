# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimFlow is a browser-based interactive educational simulation engine. Educators write simulations in a custom DSL (`.simflow` files), which are interpreted and rendered as interactive visualizations for teaching CS concepts (OS scheduling, data structures, concurrency, etc.). The UI and comments are in German.

## Running / Deployment

No build step — this is vanilla JS served directly by a web server.

```bash
# Docker (recommended)
docker-compose up          # Serves on http://localhost:7070

# Any static HTTP server works, e.g.:
python3 -m http.server 8080
```

## Architecture

The engine follows a classic interpreter pipeline:

```
.simflow source
  → Lexer (engine/lexer.js)       tokenization
  → Parser (engine/parser.js)     recursive descent → AST
  → Runtime (engine/runtime.js)   AST interpreter, state management
  → UI (engine/ui.js)             control panel, store visualizations, task overlays
  → Renderer (engine/renderer.js) SVG/Canvas charts (Gantt, Bar, Line, StatCard)
```

**Public API** (`simflow.js`): Exposes `SimFlow.load(url)` and `SimFlow.parse(source)`, registers the `<sim-flow src="...">` custom HTML element, and injects all CSS.

**Stores** (`engine/stores.js`): Implements Queue, Stack, Slot, List, Set, Grid, Tree, Graph, Table, Array — each exposes operations via a `.proxy` object consumed by the Runtime when evaluating simulation rules.

**Scoring** (`engine/scoring.js`): Tracks student interactions (param changes, wrong answers, hint usage) and computes weighted task scores with configurable penalties.

**Assets** (`engine/assets.js`): SVG templates for entity visuals (process, packet, page, cpu-chip, lock, thread, etc.).

## SimFlow DSL Structure

```simflow
simulation "Name" {
  entity Process { fields...; visual_states {...}; label: expr }
  store ready: Queue<Process>
  param quantum: Int(1..20) = 4

  use Algorithm(arg: store, ...)   // built-in algorithm templates

  setup { /* initialization statements */ }
  rule <name> when <condition> { /* statements executed each matching tick */ }
  done when <condition>

  view gantt_cpu { type: gantt; source: cpu; ... }
  task "Q1" at tick(5) { type: fill_in; prompt: "?"; answer: expr; hint: "..."; }

  scoring { max_points: 10; penalty { wrong_attempt: -0.2; ... } }
}
```

Statement language inside rules/setup: `let`, `if/else`, `repeat`, `for...in`, store operations (`push`, `pop`, `add`, `remove`, `find`, `filter`, `map`, `sort_by`, `min_by`, `max_by`), annotations (`highlight`, `flash`, `mark`).

## Key Files to Understand First

- `examples/cpu_rr.simflow` — most complete example; best starting point for DSL features
- `engine/runtime.js` — `_eval()` and `_execStmts()` define the full expression/statement semantics
- `engine/parser.js` — grammar is entirely implicit in `parse*()` methods; no separate grammar file
- `simflow.js` — the CSS bundle (~900 lines) and public API wrappers live here
