# Product feedback and observed friction

Verified September 21, 2026. These notes describe tools actually used; they do not imply access to a live Alexa developer preview.

## MCP TypeScript SDK 1.30.0

Used for actual server registration, Streamable HTTP transport, tool schemas, resource reads, and an independent client integration test. Initialization negotiated protocol 2025-11-25. Tool discovery, execution, application errors, and resource reads worked in the test and browser client. We would use it again: the protocol let the visual simulator and another client share exactly the same tools.

Onboarding required deciding separately where protocol state and application state live. The stateless request pattern uses a fresh server and transport for each request; the household must persist outside that lifetime. We used a single external store with atomic JSON writes. This is workable, but a concise example pairing stateless HTTP with durable domain state, optimistic revisions, and retry behavior would shorten the path from toy tools to real action workflows.

## Alexa+ hackathon simulation path

Used the official rules' permitted web-simulation path. The UI identifies the simulation continuously. No actual Alexa+ account, preview onboarding, voice service, or hardware was tested, so we cannot provide truthful performance or reliability feedback on those services. The alternative path made it possible to build a complete interaction model without implying access we did not have. We would explore a real host integration next.

Feature request, **important**: a public reference client showing cards, tool failure recovery, user confirmation, and state changes across separate conversations. This would make it easier to validate a household handoff before investing in device deployment.

## Anthropic Messages API / Claude Sonnet 5

Used optional live tool selection from natural-language requests, with the actual household schema. After two initial integration checks, the filmed walkthrough completed five live model requests for outage, rain, handoff, a virtual visual cue and undo. The API key remains in the server process. Optional model errors are explicit and the UI's direct controls stay available. We would use it again for language flexibility while retaining deterministic domain validation. This is not an AWS integration.

## Express and Zod

Express serves the local app and MCP endpoint; Zod provides runtime schemas and model-facing JSON Schema. The straightforward shared schema reduced drift between tool validation and language selection. We would use both again. No material library-specific friction was observed in this small build.

## Friction log: durable actions across a stateless transport

- **Task:** preserve household facts and safely handle repeated commands across MCP clients.
- **Steps:** inspect the official Streamable HTTP example; implement a stateless server lifetime; add a persistent domain store; test retries and stale revisions through an independent SDK client.
- **Expected versus observed:** the transport provides request handling, but household persistence and mutation replay semantics remain application responsibilities. An action-oriented application needs additional patterns beyond the greeting examples.
- **Severity:** medium for application onboarding; no claim of an SDK defect.
- **Workaround:** expected revisions, stable request IDs, atomic storage, and immutable application receipts outside the request-lifetime server.
- **Actionable suggestion:** add a small durable-action example with an idempotent command, a stale write, and a reversible effect.

This log records an implementation design friction, not a fabricated service outage or measured Alexa bug. If the organizers want only Amazon-service-specific friction, omit it rather than relabeling it.
