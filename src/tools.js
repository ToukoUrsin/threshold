import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const mutation = {
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .describe("Revision from a fresh household read; stale writes fail."),
  requestId: z
    .string()
    .min(8)
    .max(100)
    .describe(
      "Unique action ID; retries must reuse the same ID and arguments.",
    ),
};
const person = z.enum(["alex", "sam", "jo"]);
export const definitions = [
  {
    name: "get_household",
    description:
      "Read the current household, sourced constraints, dependency plan, device emulator, and action receipts. Always read before proposing a mutation.",
    schema: z.object({}),
    method: (store) => ({ state: store.read() }),
    readOnly: true,
  },
  {
    name: "plan_departure",
    description:
      "Plan a library departure for the synthetic Cedar household, scheduling parallel work and accessible routing. Tasks remain unconfirmed until a person reports completing them.",
    schema: z.object({
      ...mutation,
      destination: z.string().min(1).max(80),
      departAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    }),
    method: (store, args) => store.plan(args),
  },
  {
    name: "update_constraint",
    description:
      "Record a user-reported changed household constraint with its source, then recompute the plan. Never remove an accessibility preference merely to make a plan feasible.",
    schema: z.object({
      ...mutation,
      key: z.enum(["stepFree", "quiet", "elevator", "ramp", "rain"]),
      value: z.boolean(),
      source: z.string().min(1).max(160),
      note: z.string().min(1).max(240),
    }),
    method: (store, args) => store.constraint(args),
  },
  {
    name: "complete_task",
    description:
      "Record that a person explicitly confirmed a real-world preparation task. Dependencies must already be complete. Planning is not completion.",
    schema: z.object({
      ...mutation,
      taskId: z.string().max(60),
      confirmedBy: z.string().min(1).max(80),
    }),
    method: (store, args) => store.complete(args),
  },
  {
    name: "handoff_tasks",
    description:
      "Transfer all remaining preparation tasks from one person to another without changing completed work. Recompute owner-aware timing.",
    schema: z.object({ ...mutation, from: person, to: person }),
    method: (store, args) => store.handoff(args),
  },
  {
    name: "set_departure_cue",
    description:
      "Set the local hallway lamp EMULATOR to warm or off. Does not control a physical device. Returns a reversible receipt.",
    schema: z.object({ ...mutation, mode: z.enum(["warm", "off"]) }),
    method: (store, args) => store.cue(args),
  },
  {
    name: "undo_action",
    description:
      "Undo an eligible earlier action only if its state has not been superseded. Preserve the immutable original receipt and add a reversal.",
    schema: z.object({ ...mutation, receiptId: z.string().uuid() }),
    method: (store, args) => store.undo(args),
  },
];

export function createMcpServer(store) {
  const server = new McpServer(
    { name: "threshold", version: "1.0.0" },
    {
      instructions:
        "Threshold coordinates a synthetic household. Read current state first. Respect step-free and quiet preferences. Never mark a physical task complete unless the user explicitly confirms it. Virtual device effects are emulated. Never claim live Alexa or real hardware execution.",
    },
  );
  for (const def of definitions) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.schema,
        annotations: {
          readOnlyHint: !!def.readOnly,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          const result = def.method(store, args);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: error.message }],
          };
        }
      },
    );
  }
  server.registerResource(
    "household",
    "threshold://household/current",
    {
      description: "Current synthetic household plan and sourced context",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(store.read()),
        },
      ],
    }),
  );
  return server;
}

export function interpretationTools() {
  return definitions.map((def) => {
    const schema = z.toJSONSchema(def.schema);
    delete schema.$schema;
    delete schema.properties.expectedRevision;
    delete schema.properties.requestId;
    schema.required = (schema.required || []).filter(
      (x) => !["expectedRevision", "requestId"].includes(x),
    );
    return {
      name: def.name,
      description: def.description,
      input_schema: schema,
    };
  });
}
