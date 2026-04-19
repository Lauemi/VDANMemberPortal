# FCP Closing Agent Context

## Mission

Fishing Club Portal (FCP) is the first real platform instance of a reusable multi-platform architecture.
The current goal is not to fully build every future platform abstraction, but to close FCP into a formally launchable, stable, and repeatable launch core.

This document exists so that Claude Code, ChatGPT, and future agents operate on the same closure logic.

---

## Core Principle

Do not optimize for total completeness.
Optimize for launch-core closure.

A point is only "done" if:
- implementation truth is present,
- affected contracts / masks / control artifacts are aligned,
- and the closing state can be justified without guessing.

---

## Source of Truth Hierarchy

1. Database / SQL / RPC / Edge Functions = technical and security truth
2. JSON masks / contracts = structure truth
3. Renderer / UI = display truth
4. Board and process-control artifacts = product closure truth

Agents must never let UI or local assumptions override DB/RPC truth.

---

## Leading Repo Artifacts

Primary closure artifacts:
- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`

Use these as the main repo-visible product and process truth.

Additional truth sources:
- `supabase/migrations/*`
- `supabase/functions/*`
- `docs/contracts/*`
- `docs/project/*`
- relevant page and client files under `src/pages/*` and `public/js/*`

---

## What FCP Must Be At Closure

FCP is considered closable only if the following launch-core is true:

1. A club can move through the golden path:
   request/registration -> access/invite/claim/login -> onboarding -> first operational club state

2. The following core domains are no longer unstable:
   - membership / club membership / identity relation
   - roles and club roles
   - onboarding process state
   - CSV onboarding path
   - billing / checkout / webhook state
   - minimum card / pricing / validity logic for launch

3. No remaining unresolved core contradiction may exist in:
   - member vs user vs profile vs club context
   - launch-relevant pricing / card assignment truth
   - billing state transition truth
   - onboarding step / redirect / invite handling truth

---

## Current Closure Interpretation

FCP is already beyond concept stage.
Many modules are already implemented or substantially grounded.
The remaining work is closure work, not greenfield invention.

This means the agent must focus on:
- separating launch blockers from later ideas,
- proving critical paths,
- freezing the minimum viable core model,
- and documenting deliberate scope cuts.

---

## Non-Scope For Current Closure

The following are not automatic launch blockers unless they directly break the launch core:
- generalized future platform abstraction for unlimited future businesses
- complete reporting ecosystem
- full contribution/SEPA suite unless explicitly declared launch-core
- full docs/blog/demo maturity
- deep expansion of non-core modules without launch impact

These may be marked as `PREPARE_ONLY` or `LATER`.

---

## Required Closure Categories

Every open point must be classified into exactly one of:

- `BLOCKER`  
  Launch-core cannot be closed without this.

- `CLOSE_NOW`  
  Should be closed now for a stable first launch core, but is not the most fundamental blocker.

- `PREPARE_ONLY`  
  Important for later platform scaling, but only needs architectural preparation now.

- `LATER`  
  Valuable, but not part of current closure.

---

## Expected Known High-Risk Areas

The agent should explicitly verify and classify at least these domains:

- onboarding flow freeze
- CSV end-to-end proof
- billing end-to-end proof
- membership/core model freeze
- card/pricing minimum launch truth
- club master data vs settings boundaries
- identity/profile/member/role harmonization
- multi-tenant edge cases still affecting launch-core behavior

---

## Stop Condition

FCP is closable only when all of the following are true:

1. Golden path is passable without special rescue actions
2. CSV path is formally proven end-to-end
3. Billing path is formally proven end-to-end
4. Launch-core model decisions are frozen at minimum viable truth level
5. Remaining open points are either:
   - clearly non-blocking,
   - intentionally deferred,
   - or explicitly marked as prepare-only
6. Board/control artifacts can be updated to reflect the above honestly

---

## Expected Agent Output Format

Claude Code should always return:

1. `CLOSING_VERDICT`
   - not closable / almost closable / closable
   - concise explanation

2. `BLOCKER_MATRIX`
   For each blocker:
   - exact problem
   - why it blocks launch-core
   - whether it is a model, implementation, or verification gap
   - smallest clean closure step

3. `EXECUTION_ORDER`
   Ordered work packages, no parallel chaos unless justified

4. `SCOPE_CUT`
   What is deliberately not being closed now

5. `STOP_CONDITION_CHECK`
   Point-by-point status against the closure condition

6. `WRITEBACK_REQUIREMENTS`
   Which board/process artifacts must be updated after changes

---

## Writeback Rule

No closure work is complete if only code changed.

After closing work, the agent must explicitly state:
- which repo files were changed,
- which board/process nodes are affected,
- which smoke checks are now satisfied,
- which status labels should move,
- and which remaining open points stay outside launch-core.

---

## Agent Conduct Rules

- no speculative architecture replacement
- no duplicate models when existing truth can be hardened
- no “boil the ocean” execution
- prefer minimal, truthful closure over elegant but oversized redesign
- do not silently widen scope
- if unsure, mark as decision gap instead of inventing

---

## Goal Beyond FCP

FCP is the first platform instance, not the last.
Closure should therefore preserve future scalability, but only through:
- clean boundaries,
- truthful contracts,
- and non-destructive decisions.

Do not force full platform generalization into the current closure.
Close FCP well enough that it can become the first repeatable blueprint.
