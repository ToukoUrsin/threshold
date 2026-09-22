const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
let state,
  tools = [],
  calls = [],
  config = {},
  rpcId = 0,
  busy = false,
  inspectionTab = "receipts",
  downloadUrl;
const colors = { alex: "#78926c", sam: "#bf8b75", jo: "#c4a255" };
const icons = {
  bottle: "♧",
  books: "▥",
  bag: "⌑",
  shoes: "⌁",
  keys: "⚿",
  cover: "☂",
  together: "⌂",
};
const labels = { alex: "Alex", sam: "Sam", jo: "Jo" };

async function rpc(method, params, notification = false) {
  const response = await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      ...(notification ? {} : { id: ++rpcId }),
      method,
      params,
    }),
  });
  if (response.status === 202) return;
  const message = await response.json();
  if (!response.ok || message.error)
    throw new Error(
      message.error?.message || `MCP returned ${response.status}`,
    );
  return message.result;
}
function announce(message, error = false) {
  $("#announcement p").textContent = message;
  $("#announcement").classList.toggle("error", error);
}
function setBusy(value) {
  busy = value;
  document.body.classList.toggle("busy", value);
  $("#send").disabled = value;
}
async function callTool(name, args = {}, message) {
  if (busy) return;
  setBusy(true);
  const request =
    name === "get_household"
      ? args
      : {
          ...args,
          expectedRevision: state.revision,
          requestId: crypto.randomUUID(),
        };
  const start = performance.now();
  try {
    const result = await rpc("tools/call", { name, arguments: request });
    calls.unshift({
      name,
      arguments: request,
      elapsed: Math.round(performance.now() - start),
      ok: !result.isError,
      at: new Date().toISOString(),
    });
    calls = calls.slice(0, 30);
    if (result.isError)
      throw new Error(result.content.map((c) => c.text || "").join(" "));
    const data = result.structuredContent || JSON.parse(result.content[0].text);
    state = data.state;
    if (message || data.message) announce(message || data.message);
    else if (name === "get_household")
      announce(
        state.plan
          ? statusMessage()
          : "Let’s make the morning feel a little lighter. Tell me where we’re going.",
      );
    render();
    return data;
  } catch (error) {
    announce(error.message, true);
  } finally {
    setBusy(false);
  }
}
function statusMessage() {
  const plan = state.plan;
  if (plan.blocked)
    return "The step-free exits are unavailable. I’m keeping that requirement. Please confirm an accessible route before leaving.";
  if (plan.ready)
    return "Everyone is together. Your preparation is confirmed, and the step-free route is ready. Have a lovely morning.";
  const next = plan.tasks
    .filter((t) => t.available)
    .map((t) => `${labels[t.owner]}: ${t.title.toLowerCase()}`);
  return `Next, in parallel: ${next.join("; ")}. ${plan.slackMinutes >= 0 ? `There are ${plan.slackMinutes} minutes of breathing room.` : `The plan needs ${-plan.slackMinutes} extra minutes.`}`;
}

function houseSVG() {
  const plan = state.plan;
  const doneIn = (room) =>
    plan?.tasks.filter((t) => t.room === room && t.done).length || 0;
  const node = (x, y, person, room) =>
    `<g transform="translate(${x},${y})"><circle r="17" fill="${colors[person]}" stroke="#fffef9" stroke-width="4"/><text class="map-person" y="3.5" text-anchor="middle">${labels[person][0]}</text>${doneIn(room) ? '<circle cx="12" cy="-12" r="7" fill="#e7eddc" stroke="#fff" stroke-width="2"/><text x="12" y="-9" text-anchor="middle" style="font-size:8px;fill:#709060">✓</text>' : ""}</g>`;
  const route = plan?.route.id;
  const routeLine =
    route === "ramp"
      ? "M330 201L400 201L400 241L515 241L515 270"
      : route === "stairs"
        ? "M330 201L330 270"
        : "M330 201L437 201L437 131L515 131L515 270";
  return `<svg viewBox="0 0 640 290" role="img" aria-label="Cedar household floor plan. ${plan ? esc(plan.route.name) : "No departure planned."}">
  <defs><pattern id="garden" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".7" fill="#d0d8bc"/></pattern><pattern id="floor" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 20H20M0 0V20" stroke="#eae9dd" stroke-width=".7"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#65704a" flood-opacity=".07"/></filter></defs>
  <rect x="79" y="24" width="500" height="228" rx="42" fill="#f2f4e8"/><rect x="79" y="24" width="500" height="228" rx="42" fill="url(#garden)"/>
  <path d="M517 27V86M517 175V276" stroke="#e6e9d9" stroke-width="22"/><path d="M374 243H512" stroke="#e8eadb" stroke-width="22"/>
  <g filter="url(#shadow)"><rect x="119" y="38" width="348" height="186" rx="6" fill="#fbfaf4" stroke="#d0d4c1" stroke-width="6"/>
  <rect x="124" y="43" width="176" height="113" fill="url(#floor)"/><rect x="306" y="43" width="155" height="113" fill="#f1eee3"/>
  <path d="M303 41V123M303 151V219M122 159H251M283 159H466" stroke="#d0d4c1" stroke-width="5"/>
  <rect x="125" y="165" width="172" height="53" fill="#f6f1e9"/><rect x="307" y="165" width="154" height="53" fill="#f4f3e8"/>
  <rect x="144" y="60" width="58" height="19" rx="5" fill="#dbe0cb" stroke="#cbd3bb"/><rect x="139" y="63" width="10" height="20" rx="3" fill="#d1d9be"/><rect x="197" y="63" width="10" height="20" rx="3" fill="#d1d9be"/>
  <rect x="154" y="92" width="51" height="23" rx="12" fill="#ebe2cd" stroke="#dcd2b9"/><circle cx="182" cy="100" r="4" fill="#d6c59f"/>
  <rect x="252" y="60" width="31" height="54" rx="2" fill="#e8e4d6"/><path d="M259 65v15m6-15v15m7-15v15m-13 9v18m7-18v18m6-18v18" stroke="#c3bea9" stroke-width="4"/>
  <path d="M324 61H444V86H421V74H324Z" fill="#e1dfcc" stroke="#c9ccb5"/><rect x="419" y="59" width="20" height="18" rx="4" fill="#ccd3bf"/><circle cx="353" cy="67" r="4" fill="#bbbfa8"/><circle cx="368" cy="67" r="4" fill="#bbbfa8"/>
  <rect x="359" y="104" width="49" height="23" rx="4" fill="#e6dbbf" stroke="#d9cba9"/><circle cx="383" cy="114" r="5" fill="#c4ceab"/>
  <rect x="141" y="172" width="69" height="39" rx="4" fill="#e3d6c7" stroke="#d6c8b8"/><rect x="144" y="175" width="19" height="33" rx="4" fill="#f8f3e9"/><path d="M169 173v36" stroke="#d4c4b1"/>
  <rect x="419" y="178" width="23" height="10" rx="2" fill="#d8d7c0"/><circle cx="428" cy="183" r="2" fill="#b09a6f"/>
  <path d="M466 188v22" stroke="#fbfaf4" stroke-width="7"/><path d="M466 210A23 23 0 0 0 489 188H466" fill="none" stroke="#c4cbb5" stroke-width="1.4"/>
  <path d="M332 223h31" stroke="#fafaf1" stroke-width="7"/>
  <text x="146" y="139" class="map-room">LIVING ROOM</text><text x="326" y="143" class="map-room">KITCHEN</text><text x="225" y="190" class="map-room">ROOM</text><text x="323" y="181" class="map-room">HALLWAY</text></g>
  <g><circle cx="99" cy="194" r="15" fill="#d5ddc0"/><circle cx="93" cy="189" r="8" fill="#c6d1ae"/><circle cx="557" cy="60" r="17" fill="#dce2c9"/><circle cx="562" cy="51" r="10" fill="#ced9b8"/><circle cx="554" cy="214" r="16" fill="#d0dab8"/><circle cx="562" cy="208" r="9" fill="#bfcca4"/></g>
  ${plan && route !== "blocked" ? `<path d="${routeLine}" fill="none" class="route-line ${route === "ramp" ? "detour" : ""}" stroke-width="3" stroke-linecap="round"/><circle cx="515" cy="270" r="5" fill="${route === "ramp" ? "#baa079" : "#9bae7b"}"/>` : ""}
  <rect x="489" y="108" width="52" height="44" rx="7" fill="${state.constraints.elevator.value ? "#ebeedf" : "#f1e3d5"}" stroke="${state.constraints.elevator.value ? "#cbd6b8" : "#dbbda3"}"/><text x="515" y="128" text-anchor="middle" style="font:17px Arial;fill:${state.constraints.elevator.value ? "#8b9d73" : "#b28a65"}">${state.constraints.elevator.value ? "↕" : "×"}</text><text x="515" y="142" text-anchor="middle" style="font:7px Arial;fill:#9ba18b">ELEVATOR</text>
  <text x="420" y="266" class="map-label">GARDEN RAMP</text><text x="548" y="275" class="map-label">OUTSIDE</text>
  ${node(225, 103, "alex", "living")}${node(392, 96, "jo", "kitchen")}${node(271, 195, "sam", "bedroom")}
  ${state.devices.hallway === "warm" ? '<circle cx="344" cy="199" r="24" fill="#e6c777" opacity=".23"/><circle cx="344" cy="199" r="11" fill="#e5c471" opacity=".4"/><circle cx="344" cy="199" r="4" fill="#d9b053"/>' : '<circle cx="344" cy="199" r="4" fill="#dfe2d3"/>'}
  </svg>`;
}

function render() {
  if (!state) return;
  const plan = state.plan;
  $("#house-map").innerHTML = houseSVG();
  $("#plan-title").textContent = plan
    ? plan.destination
        .replace(/^The /, "")
        .replace(/^./, (c) => c.toUpperCase()) + "."
    : "Home, in harmony.";
  const ready = $("#readiness");
  ready.textContent = !plan
    ? "Ready when you are"
    : plan.blocked
      ? "Route needs attention"
      : plan.ready
        ? "Ready, together"
        : `${plan.prepMinutes} min to get ready`;
  ready.className = `pill ${!plan ? "neutral" : plan.blocked ? "alert" : plan.ready ? "ready" : ""}`;
  $("#task-count").textContent = plan
    ? `${plan.completed} / ${plan.tasks.length}`
    : "0 / 0";
  $("#tasks-heading").textContent = plan?.ready
    ? "Together. Ready."
    : "The way out.";
  $("#tasks").innerHTML = !plan
    ? `<div class="empty-state"><div class="empty-art"></div><h3>Let’s get there, together.</h3><p>A plan that remembers the little things,<br>so you don’t have to carry them all.</p><button class="primary-button" data-action="start">Plan our library morning ↗</button></div>`
    : plan.tasks
        .map(
          (t) =>
            `<div class="task ${t.done ? "done" : t.available ? "" : "waiting"}"><button class="task-check" data-complete="${t.id}" ${t.done || !t.available || (plan.blocked && t.id === "together") ? "disabled" : ""} aria-label="${t.done ? "Completed" : "Confirm complete"}: ${esc(t.title)}" title="${t.waitingFor.length ? `First: ${t.waitingFor.join(", ")}` : "Confirm a person completed this task"}">${t.done ? "✓" : ""}</button><div class="task-info"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${t.done ? "Confirmed by you" : t.waitingFor.length ? "After " + t.waitingFor.map((id) => plan.tasks.find((x) => x.id === id).title.toLowerCase()).join(" + ") : `${t.duration} min · Ready to begin`}</div></div><span class="task-avatar" style="background:${colors[t.owner]}" title="${labels[t.owner]}">${labels[t.owner][0]}</span></div>`,
        )
        .join("");
  $("#route-strip").innerHTML =
    `<span class="route-icon">${plan?.blocked ? "!" : "↗"}</span><div><strong>${plan ? esc(plan.route.name) : "A route that remembers your needs"}</strong><p>${plan ? esc(plan.route.note) : "Step-free exits. Quiet cues. No details to repeat."}</p></div>${plan && !plan.blocked ? `<span class="pill ${plan.route.id === "ramp" ? "alert" : ""}" style="margin-left:auto">${plan.route.minutes} min</span>` : ""}`;
  if (plan) {
    const total = Math.max(
      plan.totalMinutes,
      plan.totalMinutes + plan.slackMinutes,
      1,
    );
    $("#timing").innerHTML =
      `<div class="timing-top"><div class="eyebrow">ROOM TO BREATHE</div><strong>${plan.blocked ? '<b class="late">Resolve the route first</b>' : plan.slackMinutes >= 0 ? `<b>${plan.slackMinutes} min of breathing room</b>` : `<b class="late">${-plan.slackMinutes} min past the target</b>`}</strong></div><div class="timeline"><span class="timeline-piece" style="flex:${Math.max(plan.prepMinutes, 1)}">${plan.prepMinutes} min · together</span><span class="timeline-piece route" style="flex:${Math.max(plan.route.minutes, 1)}">${plan.route.minutes} min · exit</span>${plan.slackMinutes > 0 ? `<span class="timeline-piece buffer" style="flex:${plan.slackMinutes}">breathing room</span>` : ""}</div><div class="timeline-times"><span>08:12 · now</span><span>${esc(plan.readyAt)} · prepared</span><span>${esc(plan.departAt)} · outside by</span></div>`;
  } else
    $("#timing").innerHTML =
      '<div class="timing-top"><div class="eyebrow">ROOM TO BREATHE</div><strong>Less rushing. More room.</strong></div><div class="timeline"><span class="timeline-piece" style="flex:4">PREPARE TOGETHER</span><span class="timeline-piece route" style="flex:2">STEP-FREE EXIT</span><span class="timeline-piece buffer" style="flex:3">A LITTLE EXTRA TIME</span></div>';
  $("#context-row").innerHTML =
    `<button class="context-chip" disabled title="${esc(state.constraints.stepFree.source)}">♧ ${state.constraints.stepFree.value ? "Step-free remembered" : "Step-free off"}</button><button class="context-chip" disabled>⌁ ${state.constraints.quiet.value ? "Quiet cues remembered" : "Spoken cues allowed"}</button><button class="context-chip ${!state.constraints.elevator.value ? "changed" : ""}" data-toggle="elevator">↕ Elevator ${state.constraints.elevator.value ? "available" : "out"} ↺</button><button class="context-chip ${state.constraints.rain.value ? "changed" : ""}" data-toggle="rain">☂ ${state.constraints.rain.value ? "Rain outside" : "Dry outside"} ↺</button>`;
  const last = state.receipts.at(-1);
  $("#last-receipt").innerHTML = last
    ? `<div class="receipt-summary"><div class="receipt-mark">✓</div><div><strong>${esc(last.title)}</strong><span>Revision ${last.revision} · ${last.hash.slice(0, 8)} · stored locally</span></div>${canUndo(last) ? `<button class="undo-button" data-undo="${last.id}">Undo</button>` : ""}</div>`
    : "Actions leave a receipt. Changes can be undone.";
  const suggestions = !plan
    ? ["Get us out the door by 08:30", "What do you remember?"]
    : !state.constraints.elevator.value
      ? [
          state.constraints.rain.value
            ? "What should we do next?"
            : "It’s raining now",
          "Alex can take over Sam’s tasks",
          "Turn on a quiet cue",
        ]
      : [
          "The elevator is out",
          "Turn on a quiet cue",
          "What should we do next?",
        ];
  $("#suggestions").innerHTML = suggestions
    .map((s) => `<button data-suggest="${esc(s)}">${esc(s)} ↗</button>`)
    .join("");
  $("#provider").textContent =
    `${config.provider || "Local demo parser"} · MCP connected`;
  renderInspector();
}

function canUndo(receipt) {
  return (
    receipt.reversible &&
    !state.receipts.some(
      (r) => r.operation === "undo_action" && r.detail.endsWith(receipt.id),
    )
  );
}
function renderInspector() {
  if (!state) return;
  $("#revision").textContent = `Revision ${state.revision}`;
  $("#receipt-tab").classList.toggle("active", inspectionTab === "receipts");
  $("#tools-tab").classList.toggle("active", inspectionTab === "tools");
  if (inspectionTab === "receipts")
    $("#inspector-content").innerHTML = state.receipts.length
      ? [...state.receipts]
          .reverse()
          .map(
            (r) =>
              `<div class="receipt-detail"><span class="receipt-mark">${r.operation === "undo_action" ? "↶" : "✓"}</span><div><h4>${esc(r.title)}</h4><p>${esc(r.detail)}</p><code>${esc(r.operation)} · revision ${r.revision}<br>SHA-256 ${r.hash}</code>${canUndo(r) ? `<button class="undo-button" data-undo="${r.id}">Undo this action</button>` : ""}</div></div>`,
          )
          .join("")
      : '<p class="inspector-note" style="padding:20px 0">No household mutations yet. Make a plan to begin the trail.</p>';
  else
    $("#inspector-content").innerHTML =
      `<div class="tool-item"><strong>${calls.length} real MCP calls in this browser session</strong><p>${calls
        .slice(0, 8)
        .map(
          (c) =>
            `${esc(c.name)} · ${c.elapsed} ms · ${c.ok ? "success" : "rejected"}`,
        )
        .join("<br>")}</p></div>` +
      tools
        .map(
          (t) =>
            `<div class="tool-item"><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p></div>`,
        )
        .join("");
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            schema: 1,
            household: state.household.name,
            synthetic: true,
            revision: state.revision,
            receipts: state.receipts,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  $("#download").href = downloadUrl;
}
async function command(text) {
  if (busy || !text.trim()) return;
  setBusy(true);
  announce("Making room for what changed…");
  try {
    const response = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const intent = await response.json();
    if (!response.ok) throw new Error(intent.error);
    setBusy(false);
    if (intent.clarification) {
      announce(intent.clarification);
      return;
    }
    await callTool(intent.name, intent.arguments);
    $("#command").value = "";
  } catch (error) {
    announce(error.message, true);
    setBusy(false);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || busy) return;
  if (button.dataset.action === "start")
    callTool("plan_departure", {
      destination: "The neighborhood library",
      departAt: "08:30",
    });
  if (button.dataset.complete)
    callTool("complete_task", {
      taskId: button.dataset.complete,
      confirmedBy: "User",
    });
  if (button.dataset.undo)
    callTool("undo_action", { receiptId: button.dataset.undo });
  if (button.dataset.suggest) command(button.dataset.suggest);
  if (button.dataset.toggle) {
    const key = button.dataset.toggle,
      value = !state.constraints[key].value;
    const note =
      key === "elevator"
        ? value
          ? "The elevator is working again."
          : "The elevator is out."
        : value
          ? "It is raining outside."
          : "The rain has stopped.";
    callTool("update_constraint", {
      key,
      value,
      source: "User report in the rehearsal",
      note,
    });
  }
});
$("#command-form").addEventListener("submit", (event) => {
  event.preventDefault();
  command($("#command").value);
});
$("#inspect").onclick = $("#all-receipts").onclick = () => {
  renderInspector();
  $("#inspector").showModal();
};
$("#close-inspector").onclick = () => $("#inspector").close();
$("#receipt-tab").onclick = () => {
  inspectionTab = "receipts";
  renderInspector();
};
$("#tools-tab").onclick = () => {
  inspectionTab = "tools";
  renderInspector();
};
$("#reset").onclick = async () => {
  if (busy) return;
  setBusy(true);
  try {
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "reset-synthetic-household" }),
    });
    if (!response.ok) throw new Error("The rehearsal could not reset.");
    state = (await response.json()).state;
    calls = [];
    render();
    announce("A fresh morning. Your synthetic household is reset.");
  } catch (error) {
    announce(error.message, true);
  } finally {
    setBusy(false);
  }
};
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
$("#mic").disabled = !Speech;
if (Speech)
  $("#mic").onclick = () => {
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      $("#command").value = text;
      command(text);
    };
    recognition.onerror = () =>
      announce(
        "Speech input is unavailable. You can type the same request.",
        true,
      );
    announce("Listening through your browser. Say what you need.");
    recognition.start();
  };

try {
  config = await fetch("/api/config").then((r) => r.json());
  const initialized = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "threshold-web-simulator", version: "1.0.0" },
  });
  $("#protocol-version").textContent = initialized.protocolVersion;
  await rpc("notifications/initialized", undefined, true);
  tools = (await rpc("tools/list", {})).tools;
  await callTool("get_household");
  if (new URLSearchParams(location.search).has("demo") && !state.plan)
    await callTool("plan_departure", {
      destination: "The neighborhood library",
      departAt: "08:30",
    });
} catch (error) {
  announce(`Could not connect to the household: ${error.message}`, true);
}
