import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const clone = (value) => structuredClone(value);
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const clock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export function minutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Use a time in HH:MM format.");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function seed() {
  return {
    schemaVersion: 1,
    revision: 0,
    scenarioTime: "08:12",
    household: {
      name: "The Cedar household",
      people: [
        { id: "alex", name: "Alex", color: "sage" },
        { id: "sam", name: "Sam", color: "clay" },
        { id: "jo", name: "Jo", color: "gold" },
      ],
    },
    constraints: {
      stepFree: {
        value: true,
        source: "Sam’s household preference",
        detail: "Use a step-free exit for every plan.",
      },
      quiet: {
        value: true,
        source: "Jo’s household preference",
        detail: "Visual cues, with no spoken announcements.",
      },
      elevator: {
        value: true,
        source: "Synthetic building status",
        detail: "The east elevator is available.",
      },
      ramp: {
        value: true,
        source: "Synthetic building status",
        detail: "The garden ramp is available.",
      },
      rain: {
        value: false,
        source: "Synthetic weather fixture",
        detail: "Dry outside.",
      },
    },
    devices: { hallway: "off" },
    plan: null,
    receipts: [],
    requests: {},
  };
}

function routeFor(constraints) {
  if (!constraints.stepFree.value)
    return {
      id: "stairs",
      name: "Front stairs",
      minutes: 2,
      note: "Step-free requirement is off.",
      path: ["Hallway", "Front stairs", "Pavement"],
      accessible: false,
    };
  if (constraints.elevator.value)
    return {
      id: "elevator",
      name: "East elevator",
      minutes: 3,
      note: "Step-free, sheltered exit.",
      path: ["Hallway", "East elevator", "Pavement"],
      accessible: true,
    };
  if (constraints.ramp.value)
    return {
      id: "ramp",
      name: "Garden ramp",
      minutes: 7,
      note: "Step-free detour. Allow four extra minutes.",
      path: ["Hallway", "Garden ramp", "Pavement"],
      accessible: true,
    };
  return {
    id: "blocked",
    name: "No step-free exit confirmed",
    minutes: 0,
    note: "Both step-free exits are unavailable. The plan cannot declare the household ready.",
    path: ["Hallway"],
    accessible: false,
  };
}

const baseTasks = () => [
  {
    id: "bottle",
    title: "Fill the water bottle",
    detail: "A small job Jo can own.",
    room: "kitchen",
    owner: "jo",
    duration: 2,
    dependsOn: [],
    icon: "bottle",
  },
  {
    id: "books",
    title: "Collect the library books",
    detail: "The three books on the living-room shelf.",
    room: "living",
    owner: "alex",
    duration: 2,
    dependsOn: [],
    icon: "book",
  },
  {
    id: "bag",
    title: "Pack the shared bag",
    detail: "Books and water travel together.",
    room: "hall",
    owner: "alex",
    duration: 2,
    dependsOn: ["books", "bottle"],
    icon: "bag",
  },
  {
    id: "shoes",
    title: "Shoes and outerwear",
    detail: "Everyone gets ready at their own pace.",
    room: "bedroom",
    owner: "sam",
    duration: 4,
    dependsOn: [],
    icon: "shoe",
  },
  {
    id: "keys",
    title: "Pick up keys and travel cards",
    detail: "From the tray by the front door.",
    room: "hall",
    owner: "sam",
    duration: 1,
    dependsOn: ["shoes"],
    icon: "key",
  },
  {
    id: "together",
    title: "Meet at the threshold",
    detail: "Confirm everyone is together before leaving.",
    room: "hall",
    owner: "alex",
    duration: 1,
    dependsOn: ["bag", "keys"],
    icon: "people",
  },
];

export function schedule(state) {
  if (!state.plan) return null;
  const plan = clone(state.plan);
  const starts = {},
    finishes = {},
    free = {},
    now = minutes(state.scenarioTime);
  const pending = [...plan.tasks];
  while (pending.length) {
    const index = pending.findIndex((t) =>
      t.dependsOn.every((dep) => dep in finishes),
    );
    if (index === -1) throw new Error("Task dependencies contain a cycle.");
    const task = pending.splice(index, 1)[0];
    const start = task.done
      ? 0
      : Math.max(
          free[task.owner] || 0,
          ...task.dependsOn.map((id) => finishes[id]),
          0,
        );
    const end = task.done ? 0 : start + task.duration;
    starts[task.id] = start;
    finishes[task.id] = end;
    if (!task.done) free[task.owner] = end;
    task.startMinute = start;
    task.endMinute = end;
    task.available =
      !task.done &&
      task.dependsOn.every((id) => plan.tasks.find((t) => t.id === id)?.done);
    task.waitingFor = task.dependsOn.filter(
      (id) => !plan.tasks.find((t) => t.id === id)?.done,
    );
  }
  plan.prepMinutes = Math.max(0, ...Object.values(finishes));
  plan.totalMinutes = plan.prepMinutes + plan.route.minutes;
  plan.readyAt = clock(now + plan.prepMinutes);
  plan.outsideAt = clock(now + plan.totalMinutes);
  plan.slackMinutes = minutes(plan.departAt) - now - plan.totalMinutes;
  plan.completed = plan.tasks.filter((t) => t.done).length;
  plan.blocked = plan.route.id === "blocked";
  plan.ready = !plan.blocked && plan.tasks.every((t) => t.done);
  return plan;
}

function rebuild(state) {
  if (!state.plan) return;
  const prior = new Map(state.plan.tasks.map((t) => [t.id, t]));
  const route = routeFor(state.constraints);
  const tasks = baseTasks();
  if (state.constraints.rain.value && route.id === "ramp") {
    tasks.splice(4, 0, {
      id: "cover",
      title: "Pack the rain cover",
      detail: "The garden ramp is outdoors. Keep the bag dry.",
      room: "bedroom",
      owner: "sam",
      duration: 2,
      dependsOn: ["shoes"],
      icon: "rain",
    });
    tasks.find((t) => t.id === "together").dependsOn.push("cover");
  }
  for (const task of tasks) {
    const old = prior.get(task.id);
    task.owner = old?.owner || task.owner;
    task.done = old?.done || false;
  }
  // A changed dependency must be checked again even when the old terminal task was complete.
  for (const task of tasks)
    if (
      task.done &&
      task.dependsOn.some((id) => !tasks.find((t) => t.id === id)?.done)
    )
      task.done = false;
  state.plan.tasks = tasks;
  state.plan.route = route;
  state.plan.contextRevision = state.revision;
}

export class HouseholdStore {
  constructor(path) {
    this.path = path;
    this.state =
      path && existsSync(path)
        ? JSON.parse(readFileSync(path, "utf8"))
        : seed();
    if (this.state.schemaVersion !== 1)
      throw new Error("Unsupported household data version.");
  }
  save() {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    renameSync(temp, this.path);
  }
  read() {
    const state = clone(this.state);
    state.plan = schedule(state);
    delete state.requests;
    return state;
  }
  transact(operation, args, fn) {
    const { expectedRevision, requestId } = args;
    const fingerprint = hash({ operation, ...args });
    if (this.state.requests[requestId]) {
      const previous = this.state.requests[requestId];
      if (previous.fingerprint !== fingerprint)
        throw new Error(
          "This request ID was already used for a different action.",
        );
      return {
        state: this.read(),
        message: previous.message,
        replay: true,
        receiptId: previous.receiptId,
      };
    }
    if (expectedRevision !== this.state.revision)
      throw new Error(
        `The household changed (revision ${this.state.revision}). Read the current plan before acting.`,
      );
    const backup = clone(this.state);
    try {
      const change = fn(this.state);
      this.state.revision++;
      rebuild(this.state);
      const previousHash = this.state.receipts.at(-1)?.hash || "genesis";
      const receipt = {
        id: randomUUID(),
        operation,
        revision: this.state.revision,
        at: new Date().toISOString(),
        title: change.title,
        detail: change.detail,
        reversible: !!change.undo,
        undo: change.undo || null,
        previousHash,
      };
      receipt.hash = hash(receipt);
      this.state.receipts.push(receipt);
      this.state.requests[requestId] = {
        fingerprint,
        message: change.message || change.detail,
        receiptId: receipt.id,
      };
      this.save();
      return {
        state: this.read(),
        message: change.message || change.detail,
        receiptId: receipt.id,
      };
    } catch (error) {
      this.state = backup;
      throw error;
    }
  }
  plan(args) {
    return this.transact("plan_departure", args, (state) => {
      minutes(args.departAt);
      if (minutes(args.departAt) < minutes(state.scenarioTime))
        throw new Error(
          "Choose a departure later than the rehearsal clock, 08:12.",
        );
      state.plan = {
        id: randomUUID(),
        destination: args.destination.trim(),
        departAt: args.departAt,
        tasks: [],
        route: routeFor(state.constraints),
        contextRevision: state.revision,
      };
      rebuild(state);
      return {
        title: "A morning, shared",
        detail: `Created a plan for ${args.destination}, outside by ${args.departAt}. Every task has an owner and a reason.`,
        message:
          "I’ve split the morning between Alex, Sam, and Jo. Books and water can happen together. Sam’s step-free route and Jo’s quiet cues are included.",
      };
    });
  }
  constraint(args) {
    return this.transact("update_constraint", args, (state) => {
      const record = state.constraints[args.key];
      if (!record) throw new Error("Unknown household constraint.");
      const before = clone(record);
      record.value = args.value;
      record.source = args.source;
      record.detail = args.note;
      const route = routeFor(state.constraints);
      const message =
        route.id === "blocked"
          ? "Neither step-free exit is available. I’m keeping the accessibility requirement and pausing departure until a usable route is confirmed."
          : args.key === "elevator" && !args.value && route.id === "ramp"
            ? "The elevator is out. I’ve moved us to the garden ramp, kept the step-free requirement, and allowed four extra minutes. Completed preparation stays complete."
            : args.key === "rain" && args.value && route.id === "ramp"
              ? "The garden route is outdoors, so I’ve added the rain cover before we meet at the door. The timing now includes that extra step."
              : "I’ve kept the source of that change and updated the plan. Completed preparation stays complete.";
      return {
        title: "The plan changed with you",
        detail: args.note,
        undo: {
          type: "constraint",
          key: args.key,
          before,
          after: clone(record),
        },
        message,
      };
    });
  }
  complete(args) {
    return this.transact("complete_task", args, (state) => {
      const task = state.plan?.tasks.find((t) => t.id === args.taskId);
      if (!task)
        throw new Error("Start a departure plan before completing a task.");
      if (task.done) throw new Error("This task is already complete.");
      const unmet = task.dependsOn.filter(
        (id) => !state.plan.tasks.find((t) => t.id === id)?.done,
      );
      if (unmet.length)
        throw new Error(
          `First complete: ${unmet.map((id) => state.plan.tasks.find((t) => t.id === id).title).join(", ")}.`,
        );
      if (
        task.id === "together" &&
        routeFor(state.constraints).id === "blocked"
      )
        throw new Error(
          "No accessible exit is confirmed. Resolve the route before declaring the household ready.",
        );
      task.done = true;
      return {
        title: task.title,
        detail: `${args.confirmedBy} confirmed this task was done.`,
        undo: { type: "task", taskId: task.id, planId: state.plan.id },
        message: `${task.title} is done. I’ve updated what can happen next.`,
      };
    });
  }
  handoff(args) {
    return this.transact("handoff_tasks", args, (state) => {
      if (!state.plan) throw new Error("Create a plan first.");
      if (args.from === args.to)
        throw new Error("Choose another person for the handoff.");
      const tasks = state.plan.tasks.filter(
        (t) => t.owner === args.from && !t.done,
      );
      if (!tasks.length)
        throw new Error("There are no remaining tasks to hand over.");
      const ids = tasks.map((t) => t.id);
      tasks.forEach((t) => {
        t.owner = args.to;
      });
      return {
        title: "A handoff without the retelling",
        detail: `${args.to} takes ${tasks.length} remaining tasks from ${args.from}. Completed work is untouched.`,
        undo: {
          type: "handoff",
          ids,
          from: args.from,
          to: args.to,
          planId: state.plan.id,
        },
        message: `${args.to} now has the remaining tasks. I recalculated the schedule so one person is never asked to do two things at once.`,
      };
    });
  }
  cue(args) {
    return this.transact("set_departure_cue", args, (state) => {
      const before = state.devices.hallway;
      state.devices.hallway = args.mode;
      return {
        title:
          args.mode === "warm"
            ? "A gentler way to get going"
            : "Departure cue switched off",
        detail:
          args.mode === "warm"
            ? "Virtual hallway lamp set to warm. No audio announcement. This is a device emulator."
            : "Virtual hallway lamp switched off.",
        undo: { type: "device", key: "hallway", before, after: args.mode },
        message:
          args.mode === "warm"
            ? "The hallway has a warm visual cue. No sound, just a shared signal. You can undo it."
            : "The hallway cue is off.",
      };
    });
  }
  undo(args) {
    return this.transact("undo_action", args, (state) => {
      const receipt = state.receipts.find((r) => r.id === args.receiptId);
      if (!receipt?.reversible || receipt.undoneBy)
        throw new Error("That receipt cannot be undone.");
      const u = receipt.undo;
      if (u.type === "device") {
        if (state.devices[u.key] !== u.after)
          throw new Error(
            "The device changed again. This old action cannot safely be undone.",
          );
        state.devices[u.key] = u.before;
      } else if (u.type === "constraint") {
        if (
          JSON.stringify(state.constraints[u.key]) !== JSON.stringify(u.after)
        )
          throw new Error("This constraint has a newer source. Preserve it.");
        state.constraints[u.key] = u.before;
      } else if (u.type === "task") {
        if (state.plan?.id !== u.planId)
          throw new Error("That receipt belongs to an earlier departure plan.");
        const task = state.plan?.tasks.find((t) => t.id === u.taskId);
        if (!task?.done)
          throw new Error("That completed task is no longer current.");
        if (
          state.plan.tasks.some((t) => t.done && t.dependsOn.includes(u.taskId))
        )
          throw new Error("Undo dependent completed tasks first.");
        task.done = false;
      } else if (u.type === "handoff") {
        if (state.plan?.id !== u.planId)
          throw new Error("That receipt belongs to an earlier departure plan.");
        const tasks = u.ids.map((id) =>
          state.plan?.tasks.find((t) => t.id === id),
        );
        if (tasks.some((t) => !t || t.owner !== u.to || t.done))
          throw new Error("Those tasks changed after the handoff.");
        tasks.forEach((t) => {
          t.owner = u.from;
        });
      }
      // Keep original receipts immutable; the undo receipt references the earlier receipt.
      if (
        state.receipts.some(
          (r) => r.operation === "undo_action" && r.detail.endsWith(receipt.id),
        )
      )
        throw new Error("That action was already undone.");
      return {
        title: "Undone, with a record",
        detail: `Restored the earlier state. Original receipt: ${receipt.id}`,
        message:
          "Undone. The original action and its reversal remain in the receipt trail.",
      };
    });
  }
}
