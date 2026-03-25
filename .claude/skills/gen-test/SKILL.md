---
name: gen-test
description: Generate browser-based test suites for GardenSync modules using the project's custom HTML test harness (suite/assert pattern). Creates test cases that run in test-pure-logic.html or test-integration.html.
---

# Generate GardenSync Tests

Generate test cases for GardenSync JS modules using the project's custom browser test framework.

## Test Harness API

The project uses a minimal custom test framework (NO Jest, NO Mocha). Tests run in HTML files opened in a browser.

### Available assertions:
- `suite(name, fn)` — Group tests into a named suite
- `assert(description, condition)` — Boolean assertion
- `assertApprox(description, actual, expected, tolerance)` — Approximate numeric match (default tolerance 0.01)

### Test file structure:
```html
<!-- Load required modules -->
<script src="../js/constants.js"></script>
<script src="../js/state.js"></script>
<script src="../js/MODULE_UNDER_TEST.js"></script>

<!-- Stub DOM-dependent functions -->
<script>
if (typeof saveState === 'undefined') window.saveState = function() {};
if (typeof showToast === 'undefined') window.showToast = function() {};
// ... add stubs for any globals the module references
</script>

<script>
// Tests go here using suite() and assert()
suite('functionName', () => {
    assert('describes what should happen', actualValue === expectedValue);
});
</script>
```

## Workflow

1. **Read the target module** (`js/<module>.js`) to understand exported functions
2. **Identify pure functions** that can be tested without DOM (prefer these)
3. **Check what stubs are needed** — look at global function calls in the module
4. **Generate test suites** — one `suite()` per function, 3-5 assertions each
5. **Add tests to the appropriate file**:
   - `tests/test-pure-logic.html` — for pure logic (no DOM needed)
   - `tests/test-integration.html` — for tests needing DOM elements or canvas

## Key Patterns

### Modules communicate via globals
All functions are on `window`. State is in the global `state` object. Test setup:
```js
// Reset state before tests
state.containers = [];
state.undoStack = [];
state.redoStack = [];
```

### Plant library is in constants.js
`PLANT_LIBRARY` array with `{id, name, icon, spacingInches, companions, enemies, ...}`.

### Container types
`CONTAINER_TYPES` object with `'raised-bed'`, `'pot-round'`, `'pot-square'`, `'grow-bag'`, `'in-ground'`.

### Canvas constants
`CANVAS_PX_PER_FOOT = 40`, grid snap at 4px intervals.

## Rules
- NEVER use Jest, Mocha, or any test runner — browser HTML only
- ALWAYS use the `suite()` / `assert()` / `assertApprox()` API
- ALWAYS stub DOM-dependent functions that the module under test references
- Test pure logic first, integration second
- Include edge cases (empty arrays, zero values, missing properties)
