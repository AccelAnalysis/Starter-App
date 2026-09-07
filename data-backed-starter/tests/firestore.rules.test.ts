import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let testEnv: RulesTestEnvironment;
const projectId = "accel-starter-rules-test";

function validRecord(title = "Private record") {
  const now = Timestamp.now();
  return {
    title,
    content: "Only the owner should be able to read this.",
    createdAt: now,
    updatedAt: now,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore owner-only records", () => {
  it("allows an authenticated owner to create and read their record", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const recordRef = doc(alice, "users", "alice", "records", "one");

    await assertSucceeds(setDoc(recordRef, validRecord()));
    const snapshot = await assertSucceeds(getDoc(recordRef));

    expect(snapshot.data()?.title).toBe("Private record");
  });

  it("blocks another authenticated user from reading the owner record", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(setDoc(doc(alice, "users", "alice", "records", "one"), validRecord()));
    await assertFails(getDoc(doc(bob, "users", "alice", "records", "one")));
  });

  it("blocks unauthenticated access", async () => {
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, "users", "alice", "records", "one")));
  });

  it("rejects records outside the allowed shape", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const recordRef = doc(alice, "users", "alice", "records", "one");

    await assertFails(setDoc(recordRef, { ...validRecord(), admin: true }));
  });

  it("prevents createdAt from being changed during an update", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const recordRef = doc(alice, "users", "alice", "records", "one");

    await assertSucceeds(setDoc(recordRef, validRecord()));
    await assertFails(updateDoc(recordRef, { createdAt: Timestamp.fromMillis(1) }));
  });
});
