import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/server.js";
import { HouseholdStore } from "../src/household.js";

test("official SDK negotiates 2025-11-25 and executes real Streamable HTTP tool calls", async () => {
  const app = createApp(new HouseholdStore());
  const server = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = new Client({
    name: "threshold-integration-test",
    version: "1.0.0",
  });
  try {
    const init = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "protocol-check", version: "1" },
        },
      }),
    }).then((r) => r.json());
    assert.equal(init.result.protocolVersion, "2025-11-25");
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`)),
    );
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 7);
    assert.ok(tools.tools.find((t) => t.name === "plan_departure"));
    const result = await client.callTool({
      name: "plan_departure",
      arguments: {
        destination: "The neighborhood library",
        departAt: "08:30",
        expectedRevision: 0,
        requestId: randomUUID(),
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.state.plan.route.id, "elevator");
    const invalid = await client.callTool({
      name: "complete_task",
      arguments: {
        taskId: "bag",
        confirmedBy: "Tester",
        expectedRevision: 1,
        requestId: randomUUID(),
      },
    });
    assert.equal(invalid.isError, true);
    const resource = await client.readResource({
      uri: "threshold://household/current",
    });
    assert.equal(JSON.parse(resource.contents[0].text).revision, 1);
    const badOrigin = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(badOrigin.status, 403);
    const badHost = await new Promise((resolve, reject) => {
      const req = request(
        `${base}/api/config`,
        { headers: { host: "attacker.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(badHost, 403);
    const get = await fetch(`${base}/mcp`, {
      headers: { accept: "text/event-stream" },
    });
    assert.equal(get.status, 405);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
