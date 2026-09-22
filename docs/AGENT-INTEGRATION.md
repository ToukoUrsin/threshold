# Connect a capable agent

This is a local MCP server that a compatible host can call. It is not an installed Alexa skill. Endpoint: `http://127.0.0.1:4318/mcp`, Streamable HTTP, MCP protocol 2025-11-25.

Use this instruction in the host:

> Use Threshold to coordinate the synthetic Cedar household's library departure. Read `get_household` before a mutation. Keep household preferences unless the user explicitly changes them. Pass the current revision and a new request ID. On a retry of the same action, reuse both the ID and the original arguments. A stale revision means read again and reconsider; do not overwrite the changed state. Only complete physical tasks when a person explicitly reports them done. Explain when timing or prerequisites change. Describe lamp effects as virtual. Never claim Alexa or physical-device integration. Do not invent arrival estimates: the deadline means outside the building.

## Calling sequence

1. `initialize` with `protocolVersion: "2025-11-25"`.
2. `notifications/initialized`.
3. `tools/list` to obtain the actual JSON Schemas.
4. `tools/call` with `get_household`, then the selected action.

Every HTTP request declares `Accept: application/json, text/event-stream`. After initialization, include `MCP-Protocol-Version: 2025-11-25`. This server selects JSON responses; it does not offer an independent SSE stream and returns 405 to GET. It is stateless at the transport layer, so there is no session header to persist.

Example arguments for a mutation, after reading revision 0:

```json
{
  "name": "plan_departure",
  "arguments": {
    "destination": "The neighborhood library",
    "departAt": "08:30",
    "expectedRevision": 0,
    "requestId": "use-a-unique-request-id"
  }
}
```

`test/mcp.test.js` is an executable integration example using the official MCP Client and StreamableHTTPClientTransport. `public/app.js` is the browser client used by the demo. Both execute actual tool calls rather than an MCP-shaped REST facade.

For production hosting, implement the host's required authorization, tenant isolation, HTTPS, secret management, durable database transactions, quotas, and real device adapters. These are intentionally not claimed by the local entry.
