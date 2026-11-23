---
name: maxims
description: Apply UNIX philosophy and software engineering maxims to inspect, design, refactor, test, and maintain an existing codebase. Use when reviewing architecture, proposing simplifications, eliminating accidental complexity, designing APIs, or implementing changes.
---

# Maxims

Apply the following maxims as **decision heuristics, not unquestionable laws**. Optimize for correctness, simplicity, clarity, composability, maintainability, and the codebase's actual requirements. Preserve its working behavior unless a change is explicitly requested.

## Operating procedure

1. **Establish the context.** Inspect repository instructions, README, architecture, APIs, dependency manifests, tests, and representative call sites. Identify the target environment, public contracts, compatibility promises, performance constraints, and security boundaries. Prefer established project conventions when consistent with correctness.
2. **State the problem.** Identify observable defects, unnecessary complexity, duplication of *knowledge*, coupling, confusing interfaces, or measurable performance problems. Distinguish evidence from conjecture. Do not manufacture reasons for a rewrite.
3. **Consider the smallest effective change.** Prefer deleting unnecessary code, using existing platform capabilities, simplifying data representations, isolating policies from mechanisms, or improving interfaces before introducing another layer, dependency, abstraction, or framework.
4. **Evaluate alternatives against the maxims.** Name the maxims that support an option **and those that oppose it**. Prefer the least complex solution that meets current requirements. Explicitly account for compatibility, operability, security, performance, and migration cost.
5. **Implement incrementally.** Keep changes focused. Preserve public behavior, data formats, error semantics, and integration points unless authorized otherwise. Avoid speculative generalization and unrelated cleanups.
6. **Verify.** Run focused tests, type checks, linting, and relevant integration tests. Measure when claiming a speed or memory improvement. Add tests for changed behavior and edge cases. Report what ran, what failed, and what could not be checked.
7. **Summarize.** Explain the change, removed complexity, tradeoffs, and any deferred work. Never describe a heuristic preference as a proved property.

## Core priorities

Use this order to resolve conflicts in ordinary cases:

1. **Correctness, security, and explicit requirements** outweigh stylistic maxims.
2. **Clarity and simplicity** outweigh cleverness, premature abstraction, and speculative optimization.
3. **Existing contracts and composability** outweigh local aesthetic preferences.
4. **Evidence** (tests, profiling, real use cases) outweighs guesses about future requirements.
5. **Local consistency** usually outweighs introducing a new style solely to satisfy a maxim.

This is a default ordering, not a license to ignore stated latency, portability, reliability, or extensibility requirements.

## UNIX philosophy

### McIlroy's UNIX principles

- **Do one thing well.** Give each command, module, and function a coherent responsibility. Do not equate one responsibility with a rigid line-count limit.
- **Write programs to work together.** Use explicit, stable, low-friction interfaces. Make composition possible without requiring knowledge of internals.
- **Handle text streams when appropriate.** For CLI pipelines, favor well-defined stdin/stdout conventions and documented textual formats; use structured or binary formats when their guarantees are needed. Do not force everything into text.
- **Expect unknown consumers.** Make output predictable; reserve stdout for data and stderr for diagnostics where applicable.
- **Prototype early and revise.** Test risky ideas with small, disposable implementations.
- **Automate repetitive work.** Use tools and scripts instead of repeatedly executing manual procedures.

### Gancarz's nine tenets

1. **Small is beautiful.** Prefer a small, understandable solution over an unnecessarily expansive system.
2. **Make each program do one thing well.** Keep responsibilities focused.
3. **Build a prototype as soon as possible.** Validate uncertain designs with working examples.
4. **Choose portability over efficiency** *when portability is an actual goal*. Avoid needless platform coupling; do not sacrifice a required performance target dogmatically.
5. **Store data in flat text files** *where human inspection and simple interchange are valuable*. Use databases or structured formats when consistency, concurrency, types, or scale require them.
6. **Use software leverage to your advantage.** Reuse reliable tooling and automate work.
7. **Use shell scripts to increase leverage and portability.** Compose existing commands for suitable orchestration; use a programming language for complex state, error handling, or portability requirements.
8. **Avoid captive user interfaces.** Prefer scriptable, accessible, interoperable interfaces and an escape hatch for automation.
9. **Make every program a filter** *when the domain fits stream processing*. Prefer composable transformations over tightly coupled workflows.

### Raymond's seventeen rules

| Rule | Application to the codebase |
| --- | --- |
| **Modularity** | Build simple components connected by well-defined interfaces. |
| **Clarity** | Favor easily understood control flow, naming, and APIs over cleverness. |
| **Composition** | Make components independently usable and combinable. |
| **Separation** | Separate policy from mechanism, interface from implementation, and pure logic from effects when useful. |
| **Simplicity** | Introduce complexity only when justified by requirements. |
| **Parsimony** | Do not build a large system before smaller solutions have been ruled out. |
| **Transparency** | Make behavior inspectable and diagnosable; keep state and failure modes understandable. |
| **Robustness** | Achieve reliability through simple, transparent invariants and explicit error handling. |
| **Representation** | Prefer good data models and declarative representations over elaborate procedural logic. |
| **Least Surprise** | Make names, defaults, errors, and side effects match user and maintainer expectations. |
| **Silence** | On successful routine operations, emit no needless output; avoid hiding actionable warnings or errors. |
| **Repair** | Recover from recoverable problems; otherwise fail early, visibly, and informatively. |
| **Economy** | Conserve developer effort as well as compute; optimize for whole-life cost. |
| **Generation** | Generate repetitive artifacts from a single authoritative representation where beneficial. |
| **Optimization** | First make it correct, then measure, then optimize where justified. |
| **Diversity** | Avoid insisting that one language, tool, paradigm, or architecture fits every task. |
| **Extensibility** | Maintain sensible extension points where change is likely, without speculative scaffolding. |

## General software engineering principles

- **KISS — Keep It Simple, Stupid.** Select the simplest correct approach; minimize moving parts, branches, concepts, and configuration.
- **DRY — Don't Repeat Yourself.** Avoid duplicating *knowledge, rules, and decisions*. Similar-looking code with independent reasons to change need not be abstracted.
- **YAGNI — You Aren't Gonna Need It.** Do not implement hypothetical requirements, generic frameworks, unused options, or unnecessary configuration.
- **AHA — Avoid Hasty Abstractions.** Allow small duplication until a stable common concept emerges; remove a bad abstraction before forcing divergent cases into it.
- **SSOT — Single Source of Truth.** Keep one authoritative definition for each fact, contract, or configuration value; derive or generate secondary representations when practical.
- **SoC — Separation of Concerns.** Isolate independently changing concerns; avoid separation that only adds indirection.
- **SOLID — five object-oriented design principles:**
  - **SRP (Single Responsibility):** A component has one coherent reason to change.
  - **OCP (Open/Closed):** Where extension is a real use case, extend behavior through stable interfaces rather than repeatedly modifying central logic.
  - **LSP (Liskov Substitution):** Subtypes must honor the behavioral contracts of their supertypes.
  - **ISP (Interface Segregation):** Prefer focused interfaces over large interfaces forcing unused capabilities on consumers.
  - **DIP (Dependency Inversion):** High-level policies should not be unnecessarily coupled to replaceable low-level mechanisms; abstract only genuine boundaries.
- **LoD — Law of Demeter.** Limit knowledge of collaborators' internal object graphs; avoid long chains of structural coupling.
- **POLA — Principle of Least Astonishment (Least Surprise).** Respect users' established expectations and ecosystem conventions.
- **PoLA — Principle of Least Authority.** Grant each component only the privileges it needs; use least-privilege defaults.
- **GRASP — General Responsibility Assignment Software Patterns.** Assign responsibilities according to information ownership, cohesion, coupling, polymorphism, indirection, and controlled variation; do not turn pattern names into mandatory architecture.
- **Convention over Configuration.** Use established, discoverable defaults instead of gratuitous options; expose configuration for meaningful differences.
- **Composition over Inheritance.** Prefer assembling behavior from collaborating components over rigid inheritance hierarchies, unless inheritance truly models the contract.
- **Explicit is better than implicit.** Make significant dependencies, effects, and failure conditions apparent; permit conventional shorthand when clarity benefits.
- **Fail Fast.** Detect invalid assumptions at appropriate boundaries and report failures promptly; do not replace resilience with unnecessary crashes.
- **Make illegal states unrepresentable.** Model invariants in types and constructors when feasible; still validate untrusted input at runtime.
- **Parse, don't validate.** Convert untrusted data into a representation that carries verified invariants rather than repeatedly checking raw values.

## Implementation and optimization maxims

- **Premature optimization is the root of all evil.** Do not increase complexity for hypothetical performance gains.
- **Make it work, make it right, make it fast.** Establish behavior and correctness before measured optimization; do not defer security or fundamental correctness.
- **Measure, don't guess.** Use benchmarks, profiles, traces, and representative inputs to guide performance work.
- **Data dominates.** Choose data structures and invariants carefully; they often simplify the algorithms that follow.
- **Avoid clever code.** Prefer readable and unsurprising implementations over tricks that save a few lines.
- **Don't reinvent the wheel.** Prefer stable existing platform and standard-library facilities; assess maintenance, licenses, security, and dependency cost.
- **Readable code is maintainable code.** Use direct naming, visible control flow, localized effects, and comments explaining *why*, not restating *what*.
- **Optimize for change.** Keep likely changes localized without inventing extension points for speculative futures.
- **Worse is better.** A small, workable, interoperable solution can outperform an overdesigned ideal; never interpret this as permission to violate critical requirements.
- **Everything is a file.** Consider uniform resource interfaces where useful; recognize it as a UNIX design tendency, not a literal universal rule.
- **Mechanism, not policy.** Provide reusable capabilities while leaving context-dependent choices to callers or configuration.
- **Silence is golden.** Avoid noisy success logs, accidental console output, and gratuitous status messages.
- **When in doubt, use brute force.** Start with a straightforward, verifiable algorithm when its cost is acceptable; replace it on evidence.
- **You can't tell where a program is going to spend its time.** Profile instead of predicting hot spots by intuition.
- **Those who do not understand UNIX are condemned to reinvent it, poorly.** Before designing custom orchestration, inspect existing composable system capabilities.

## Resolve tensions explicitly

| Tension | Default resolution |
| --- | --- |
| **DRY vs AHA** | Abstract shared *knowledge* with a stable common meaning; tolerate superficial duplication that may evolve independently. |
| **YAGNI vs Extensibility/OCP** | Support documented current variation; defer speculative plugins, adapters, and parameters. |
| **KISS vs SOLID/GRASP** | Use separation and interfaces only when they measurably improve clarity, testability, cohesion, or independence. |
| **Fail Fast vs Robustness/Repair** | Validate at boundaries, recover where the recovery is safe and defined, otherwise fail clearly. |
| **Convention vs Explicitness** | Follow unsurprising conventions; document or expose important implicit behavior and side effects. |
| **Portability vs Performance** | Apply stated platform and latency constraints; optimize or specialize only with evidence. |
| **Silence vs Observability** | Keep normal output quiet but preserve necessary diagnostics, structured logs, and errors. |
| **Text streams vs Typed contracts** | Choose the simplest interchange format that preserves required semantics and interoperability. |
| **Composition vs Dependency count** | Prefer built-in interfaces and a few strong abstractions over excessive wrappers and micro-modules. |
| **Reuse vs Dependency risk** | Reuse maintained standard facilities first; add dependencies only when their benefit exceeds their costs. |

## Review checklist

When reviewing or changing code, ask:

- [ ] Is each relevant unit's responsibility coherent and easy to explain?
- [ ] Can a newcomer follow the main flow without tracing needless indirection?
- [ ] Are APIs predictable, composable, and explicit about important effects?
- [ ] Are independent concerns separated without fragmenting the code gratuitously?
- [ ] Is duplicated *knowledge* represented authoritatively in one place?
- [ ] Are abstraction layers and options justified by concrete current use cases?
- [ ] Are data representations and invalid-state boundaries well chosen?
- [ ] Are failures informative, safe, and handled at the right level?
- [ ] Can routine behavior be inspected, tested, and automated?
- [ ] Are platform facilities preferred over unnecessary custom dependencies?
- [ ] Are performance claims supported by representative measurements?
- [ ] Does the change preserve required behavior and interoperability?
- [ ] Have relevant tests and checks actually been run?

## Reporting format

For meaningful reviews or refactors, provide:

1. **Finding:** Concrete code location and observed problem; distinguish confirmed behavior from suspicion.
2. **Principle:** Which maxims apply, including any conflicting ones.
3. **Change:** Smallest recommended or implemented modification and why it wins.
4. **Validation:** Tests, checks, or measurements performed and their results.
5. **Tradeoff:** Compatibility, migration, performance, or maintenance implications.

Do **not** rewrite the codebase solely to satisfy a checklist, introduce abstractions without consumers, remove useful duplication mechanically, replace simple code with patterns for their own sake, or claim performance improvements without measurements.
