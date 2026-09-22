import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { HouseholdStore } from "../src/household.js";
import { localInterpret, requireCompletionReport } from "../src/interpret.js";

const args = (store, rest = {}) => ({
  expectedRevision: store.state.revision,
  requestId: randomUUID(),
  ...rest,
});
const plan = (store) =>
  store.plan(
    args(store, { destination: "The neighborhood library", departAt: "08:30" }),
  );
const change = (store, key, value) =>
  store.constraint(
    args(store, {
      key,
      value,
      source: "Synthetic test",
      note: `${key} changed to ${value}`,
    }),
  );
const done = (store, taskId) =>
  store.complete(args(store, { taskId, confirmedBy: "Test user" }));

test("planning produces a feasible parallel schedule without declaring physical completion", () => {
  const store = new HouseholdStore();
  const result = plan(store).state;
  assert.equal(result.plan.prepMinutes, 6);
  assert.equal(result.plan.totalMinutes, 9);
  assert.equal(result.plan.slackMinutes, 9);
  assert.equal(result.plan.completed, 0);
  assert.equal(result.plan.ready, false);
  assert.equal(result.plan.route.id, "elevator");
  assert.equal(result.plan.tasks.find((t) => t.id === "bag").available, false);
});

test("dependencies prevent premature completion; existing progress survives accessible reroute", () => {
  const store = new HouseholdStore();
  plan(store);
  assert.throws(() => done(store, "bag"), /First complete/);
  assert.equal(store.state.revision, 1);
  done(store, "books");
  done(store, "bottle");
  done(store, "bag");
  change(store, "elevator", false);
  assert.equal(store.read().plan.route.id, "ramp");
  assert.equal(store.read().plan.completed, 3);
  assert.equal(store.read().constraints.stepFree.value, true);
  change(store, "rain", true);
  assert.ok(store.read().plan.tasks.some((t) => t.id === "cover"));
  assert.ok(
    store
      .read()
      .plan.tasks.find((t) => t.id === "together")
      .dependsOn.includes("cover"),
  );
});

test("changed dependencies invalidate a completed terminal task", () => {
  const store = new HouseholdStore();
  plan(store);
  for (const id of ["books", "bottle", "bag", "shoes", "keys", "together"])
    done(store, id);
  assert.equal(store.read().plan.ready, true);
  change(store, "elevator", false);
  change(store, "rain", true);
  assert.equal(
    store.read().plan.tasks.find((t) => t.id === "together").done,
    false,
  );
  assert.equal(store.read().plan.ready, false);
  done(store, "cover");
  done(store, "together");
  assert.equal(store.read().plan.ready, true);
});

test("no accessible route cannot be solved by silently choosing stairs", () => {
  const store = new HouseholdStore();
  plan(store);
  change(store, "elevator", false);
  change(store, "ramp", false);
  for (const id of ["books", "bottle", "bag", "shoes", "keys"]) done(store, id);
  assert.equal(store.read().plan.blocked, true);
  assert.throws(() => done(store, "together"), /No accessible exit/);
  assert.equal(store.read().plan.ready, false);
});

test("handoff keeps completed tasks and never schedules overlapping work for a person", () => {
  const store = new HouseholdStore();
  plan(store);
  done(store, "shoes");
  store.handoff(args(store, { from: "sam", to: "alex" }));
  const tasks = store.read().plan.tasks;
  assert.equal(tasks.find((t) => t.id === "shoes").owner, "sam");
  assert.equal(tasks.find((t) => t.id === "keys").owner, "alex");
  for (const owner of ["alex", "sam", "jo"]) {
    const work = tasks
      .filter((t) => t.owner === owner && !t.done)
      .sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < work.length; i++)
      assert.ok(work[i].startMinute >= work[i - 1].endMinute);
  }
});

test("optimistic revision rejects stale writes and duplicate retries do not double-apply", () => {
  const store = new HouseholdStore();
  plan(store);
  const command = args(store, { mode: "warm" });
  const receipt = store.cue(command);
  const replay = store.cue(command);
  assert.equal(replay.replay, true);
  assert.equal(replay.receiptId, receipt.receiptId);
  assert.equal(store.state.revision, 2);
  assert.equal(store.state.receipts.length, 2);
  assert.throws(() => store.cue({ ...command, mode: "off" }), /already used/);
  assert.throws(
    () => store.cue({ ...command, requestId: randomUUID() }),
    /household changed/,
  );
});

test("reversal preserves originals and rejects superseded device effects", () => {
  const store = new HouseholdStore();
  const on = store.cue(args(store, { mode: "warm" }));
  const original = structuredClone(store.state.receipts[0]);
  store.undo(args(store, { receiptId: on.receiptId }));
  assert.equal(store.state.devices.hallway, "off");
  assert.deepEqual(store.state.receipts[0], original);
  assert.throws(
    () => store.undo(args(store, { receiptId: on.receiptId })),
    /cannot safely|already undone/,
  );
  const newer = store.cue(args(store, { mode: "warm" }));
  store.cue(args(store, { mode: "off" }));
  assert.throws(
    () => store.undo(args(store, { receiptId: newer.receiptId })),
    /cannot safely/,
  );
});

test("task undo respects completed dependents and plan identity", () => {
  const store = new HouseholdStore();
  plan(store);
  const books = done(store, "books");
  done(store, "bottle");
  done(store, "bag");
  assert.throws(
    () => store.undo(args(store, { receiptId: books.receiptId })),
    /dependent/,
  );
  plan(store);
  done(store, "books");
  assert.throws(
    () => store.undo(args(store, { receiptId: books.receiptId })),
    /earlier departure/,
  );
});

test("state and hash-linked receipts survive a new process-equivalent store", () => {
  const dir = mkdtempSync(join(tmpdir(), "threshold-test-"));
  try {
    const path = join(dir, "household.json");
    const store = new HouseholdStore(path);
    plan(store);
    change(store, "elevator", false);
    const read = new HouseholdStore(path).read();
    assert.equal(read.plan.route.id, "ramp");
    assert.equal(read.revision, 2);
    let previousHash = "genesis";
    for (const receipt of read.receipts) {
      assert.equal(receipt.previousHash, previousHash);
      const { hash, ...body } = receipt;
      assert.equal(
        hash,
        createHash("sha256").update(JSON.stringify(body)).digest("hex"),
      );
      previousHash = hash;
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("local parser does not reset a plan in response to readiness questions", () => {
  const store = new HouseholdStore();
  plan(store);
  assert.equal(
    localInterpret("Are we ready?", store.read()).name,
    "get_household",
  );
  done(store, "books");
  assert.equal(
    localInterpret("I'm not ready", store.read()).name,
    "get_household",
  );
  assert.equal(store.read().plan.completed, 1);
  assert.equal(
    localInterpret("The elevator is not working", store.read()).arguments.value,
    false,
  );
  assert.equal(
    localInterpret("The elevator is working again", store.read()).arguments
      .value,
    true,
  );
  assert.equal(
    localInterpret("The books are collected", store.read()).name,
    "complete_task",
  );
});

test("denials, incomplete progress, questions and future plans cannot complete physical tasks", () => {
  const store = new HouseholdStore();
  plan(store);
  const before = store.read();
  for (const statement of [
    "The books are not collected",
    "The bottle isn't filled",
    "The bottle hasn’t been filled",
    "Are the books collected?",
    "Please get the bag packed",
    "The books will be collected later",
    "The bottle is almost filled",
    "If the books are collected, we can leave",
    "The bag is partly packed",
    "I got the bag",
    "The books are collected but the bottle is not filled",
  ]) {
    const result = localInterpret(statement, store.read());
    assert.ok(result.clarification, statement);
    assert.equal(result.name, undefined, statement);
  }
  assert.deepEqual(store.read(), before);
  assert.equal(
    localInterpret("The books are collected", store.read()).arguments.taskId,
    "books",
  );
  assert.equal(
    localInterpret("I filled the bottle", store.read()).arguments.taskId,
    "bottle",
  );
  assert.equal(
    localInterpret("The bag is packed", store.read()).arguments.taskId,
    "bag",
  );
});

test("optional-model completion proposals need a direct task-specific user report", () => {
  const store = new HouseholdStore();
  plan(store);
  const proposal = {
    name: "complete_task",
    arguments: { taskId: "books", confirmedBy: "User" },
  };
  for (const statement of [
    "The books aren't collected",
    "Please collect the books",
    "The bottle is filled",
  ]) {
    const checked = requireCompletionReport(statement, store.read(), proposal);
    assert.ok(checked.clarification, statement);
    assert.equal(checked.name, undefined, statement);
  }
  assert.deepEqual(
    requireCompletionReport("The books are collected", store.read(), proposal),
    proposal,
  );
  const cue = { name: "set_departure_cue", arguments: { mode: "warm" } };
  assert.deepEqual(
    requireCompletionReport("Turn on a quiet cue", store.read(), cue),
    cue,
  );
});
