# Threshold demonstration video

`threshold-demo.mp4` is a 106-second, 1920×1080 narrated demo. It includes an English caption track; `threshold-demo.en.srt` is available separately.

All screen states are from real CDP recordings of the running prototype. The edit preserves action order within each of nine scenes, extends useful holds and accelerates some waits to fit the explanation. Three initial viewport-resize frames were omitted from scene 2. No result or screen state was fabricated. `edit-manifest.json` links each output segment to its original capture timestamp; `edit.py` reproduces the edit from `raw/scene1`–`scene9` and the provided final narration.

The persistent disclosure is **Alexa+ interaction simulator · real MCP · synthetic household · virtual devices**. The lamp is a virtual device, Alexa+ interaction is simulated, the household is synthetic, and the MCP server is real. No physical device-control or official Alexa+ integration certification is claimed. The handoff changes task ownership while preserving the scheduling constraint; the narration does not claim that it changes the total duration in this example.

Suggested public title:

**Threshold — A little less to carry | Alexa+ interaction simulator + real MCP**

Suggested YouTube description:

> Threshold helps a household share the work of getting out the door. It remembers a step-free route and quiet cues, gives small jobs an owner, and changes the plan when the elevator fails or rain adds a new dependency. People confirm completed work; a generated plan never counts as proof that a task happened.
>
> This recorded prototype demo shows task dependencies, accessibility-preserving replanning, caregiver handoff, a reversible virtual hallway cue, action receipts, and real MCP tool calls over Streamable HTTP. The official SDK handles the protocol. Revision checks, retry protection and stored context support reliable actions.
>
> Disclosure: Alexa+ interaction simulator, real self-hosted MCP server, synthetic household, virtual devices. No physical device-control or certified Alexa+ integration is claimed. Screen states are from actual prototype execution; pauses and waits were edited for narration. English captions are available.
>
> Source code: https://github.com/ToukoUrsin/threshold

Raw recordings and rendered video stay local and are excluded by the repository's existing media ignore rules. The campaign owner handles upload and submission; creation of this file does not establish either.
