import { services, tables } from '../lib/server';
import type { State } from '../lib/model';

export const password = 'demo-only-management-v2-123456';

export function emulatorEnvironment() {
  process.env.FIREBASE_PROJECT_ID = 'demo-management-v2';
  process.env.MANAGEMENT_EMULATOR = 'true';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.WORKSPACE_ID = 'management-v2';
  process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.test';
  process.env.BOOTSTRAP_ORG_NAME = 'Example Organization';
  process.env.NOTIFICATIONS_DISABLED = 'true';
  delete process.env.FIRESTORE_DATABASE_ID;
}

export async function clearWorkspace() {
  emulatorEnvironment();
  const { db, auth } = services();
  await db.recursiveDelete(db.doc('managementV2Workspaces/management-v2'));
  const listed = await auth.listUsers(1000);
  if (listed.users.length) await auth.deleteUsers(listed.users.map(u => u.uid));
}

export async function seed(state: State) {
  await clearWorkspace();
  const { db, auth } = services();
  const ref = db.doc('managementV2Workspaces/management-v2');
  const batch = db.batch();
  batch.set(ref, { schema: state.schema, revision: state.revision, organization: state.organization });
  for (const table of tables) {
    for (const row of state[table]) {
      batch.set(ref.collection('records').doc(`${table}__${row.id}`), { kind: table, value: row });
    }
  }
  await batch.commit();
  for (const m of state.members) {
    await auth.createUser({ uid: m.uid, email: m.email, displayName: m.name, password, emailVerified: true });
  }
}

export async function token(email: string) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result.idToken as string;
}
