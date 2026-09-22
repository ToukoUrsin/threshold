# Prepared submission text

## Project name

Threshold

## One-line description

A household assistant that shares the work of getting out the door, remembers different needs, and rebuilds the plan when life changes.

## Inspiration

The hardest part of a shared routine is often invisible: one person remembers who needs what, which step depends on another, and what changed since yesterday. Repeating that context during a handoff adds more work. A household assistant should carry the context forward and leave the family in control.

## What it does

Threshold creates a dependency-aware library-departure plan for a synthetic household. Alex, Sam, and Jo have individual tasks, a step-free route, and a quiet cue preference. When the elevator fails, Threshold selects the garden ramp without dropping the accessibility requirement. When rain arrives, it adds a cover task before departure. A handoff reassigns only unfinished work and recalculates the schedule around each person's availability. People confirm completed physical tasks. A virtual hallway lamp can be set and undone, with a receipt for both actions.

## How we built it

The original web interface uses a calm illustrated household map, a shared task list, and a changing preparation timeline. Every action goes through a real MCP server built with the official TypeScript SDK, using Streamable HTTP and tested protocol 2025-11-25. Household state persists locally. Zod validates schemas; expected revisions reject stale actions; idempotency keys prevent duplicate effects; hash-linked receipts preserve application history. An optional Anthropic tool-selection adapter understands natural language. A visibly labeled local parser supports a free, reproducible demo without credentials.

## Accomplishments and checks

Eleven automated tests cover scheduling, dependencies, accessible-route failure, new prerequisites, safe undo, retries, persistence, Origin/Host checks, and actual official-client MCP interoperability. The filmed browser demonstration completed five real optional model requests and nine actual MCP tool calls, including elevator outage, rain, caregiver handoff, a virtual visual cue and undo. These are scoped integration checks, not a claim of real-world safety or broad language accuracy.

## What is simulated

This entry uses the permitted Alexa+ web-simulation path and also supplies a working MCP server. It is not connected to a live Alexa account. The household, building status, weather, and lamp are synthetic. There is one library departure template. The clock and durations are illustrative; the target time is outside the building, not arrival at a destination. No physical device or safety system is controlled.

## What's next

Test the interaction with families and caregivers, add more user-authored routine templates, and connect a consented physical visual-cue device. Validate host authorization and multi-household isolation before production deployment. Measure whether handoffs actually reduce repeated explanations and missed prerequisites.

## Track and publication checklist

- Primary track: Alexa+.
- Repository: https://github.com/ToukoUrsin/threshold (public, MIT).
- Video: to be filled with a verified public YouTube or Vimeo link under three minutes.
- Entry is newly created during the submission period; no prior project's source was reused.
- Product feedback: `docs/FEEDBACK.md`.
- Do not claim the AWS Builder mini challenge: no AWS service was used.
- A public MIT license on this primary project alone is not proof of the **additional** contribution required by the Open Source mini challenge. Enter that mini challenge only if an additional qualifying contribution is actually created and linked.
- Submission and receipt verification are handled separately. This file is not evidence of submission.
