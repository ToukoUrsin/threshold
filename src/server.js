import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { HouseholdStore, seed } from "./household.js";
import { createMcpServer } from "./tools.js";
import { interpret } from "./interpret.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function createApp(store) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(req.hostname))
      return res.status(403).json({ error: "Local host required." });
    if (req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        return res.status(403).json({ error: "Invalid origin." });
      }
      if (
        !["http:", "https:"].includes(origin.protocol) ||
        origin.host !== req.headers.host
      )
        return res
          .status(403)
          .json({ error: "Same-origin requests required." });
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'",
    );
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/config", (_req, res) =>
    res.json({
      protocol: "2025-11-25",
      provider: process.env.ANTHROPIC_API_KEY
        ? process.env.THRESHOLD_MODEL || "claude-sonnet-5"
        : "Local demo parser",
      synthetic: true,
      physicalDevices: false,
    }),
  );
  app.post("/api/interpret", async (req, res) => {
    if (
      typeof req.body?.text !== "string" ||
      req.body.text.length > 1000 ||
      !req.body.text.trim()
    )
      return res
        .status(400)
        .json({ error: "Enter a request under 1,000 characters." });
    try {
      res.json(await interpret(req.body.text, store.read()));
    } catch (error) {
      res.status(422).json({ error: error.message });
    }
  });
  app.post("/api/reset", (req, res) => {
    if (req.body?.confirm !== "reset-synthetic-household")
      return res.status(400).json({ error: "Explicit demo reset required." });
    store.state = seed();
    store.save();
    res.json({ state: store.read() });
  });
  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent)
        res
          .status(500)
          .json({
            jsonrpc: "2.0",
            id: req.body?.id || null,
            error: { code: -32603, message: "MCP request failed." },
          });
    }
  });
  app.get("/mcp", (_req, res) => res.status(405).set("Allow", "POST").end());
  app.delete("/mcp", (_req, res) => res.status(405).set("Allow", "POST").end());
  app.use(express.static(resolve(root, "public")));
  return app;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4318);
  const store = new HouseholdStore(
    process.env.THRESHOLD_DATA || resolve(root, "data/household.json"),
  );
  createApp(store).listen(port, "127.0.0.1", () =>
    console.log(
      `Threshold http://127.0.0.1:${port} · MCP /mcp · synthetic household`,
    ),
  );
}
