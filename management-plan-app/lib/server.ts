import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import { bootstrap, execute } from './domain';
import { DomainError, ensure, viewFor } from './policy';
import { emptyState, type State, type Command, type View } from './model';
export const tables = ['members', 'teams', 'plans', 'expectations', 'results', 'versions', 'actions', 'followUps', 'feedback', 'meetings', 'reviews', 'decisions', 'acknowledgements', 'notifications', 'audit'] as const;
export function services() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  ensure(projectId, 'The workspace backend is not configured.', 503);
  const emulator = process.env.MANAGEMENT_EMULATOR === 'true';
  const emulatorHosts = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator || emulatorHosts) ensure(emulator && process.env.NODE_ENV !== 'production' && projectId.startsWith('demo-') && process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099' && process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080', 'Unsafe emulator configuration refused.', 503);
  let app = getApps().find(a => a.name === 'management-server');
  if (!app) { const secret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON; app = initializeApp({ projectId, ...(emulator ? {} : { credential: secret ? cert(JSON.parse(secret)) : applicationDefault() }) }, 'management-server'); }
  return { auth: getAuth(app), db: getFirestore(app) };
}
export interface Identity { uid: string; email: string; name: string }
export async function authenticate(authorization: string | null): Promise<Identity> {
  if (!authorization?.startsWith('Bearer ')) throw new DomainError('Sign in to continue.', 401);
  const token = authorization.slice(7); ensure(token.length > 0 && token.length < 10000, 'Invalid session.', 401);
  try { const decoded = await services().auth.verifyIdToken(token, true); ensure(decoded.email && decoded.email_verified === true, 'Verify your email before entering the workspace.', 403); return { uid: decoded.uid, email: decoded.email.toLowerCase(), name: typeof decoded.name === 'string' ? decoded.name : decoded.email.split('@')[0] }; }
  catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('Your session expired or was revoked. Please sign in again.', 401); }
}
function persist(tx: Transaction, ref: DocumentReference, before: State, after: State) { tx.set(ref, { schema: after.schema, revision: after.revision, organization: after.organization }); for (const table of tables) { const old = new Map<string, string>(before[table].map(row => [row.id, JSON.stringify(row)])); for (const row of after[table]) if (old.get(row.id) !== JSON.stringify(row)) tx.set(ref.collection('records').doc(`${table}__${row.id}`), { kind: table, value: row }); } }
export async function workspace(identity: Identity, command?: Command, expectedRevision?: number): Promise<View> {
  const orgId = process.env.WORKSPACE_ID || 'management'; ensure(/^[A-Za-z0-9_-]{1,80}$/.test(orgId), 'Invalid workspace configuration.', 503);
  const ref = services().db.doc(`managementWorkspaces/${orgId}`);
  return services().db.runTransaction(async tx => {
    // All reads precede all writes. The metadata revision serializes concurrent
    // commands; canonical records have their own documents, not one size-capped blob.
    const [snapshot, records] = await Promise.all([tx.get(ref), tx.get(ref.collection('records'))]); const now = new Date().toISOString(); let s: State; let changed = false;
    if (!snapshot.exists) { ensure(records.empty, 'Workspace metadata is missing. Restore it before continuing.', 503); ensure(identity.email === process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(), 'Your account has not been invited to this workspace.', 403); s = bootstrap(identity.email, identity.uid, identity.name, orgId, process.env.BOOTSTRAP_ORG_NAME || 'My organization', now); changed = true; }
    else { const metadata = snapshot.data()!; ensure(metadata.schema === 1, 'Workspace migration is required.', 503); s = { ...emptyState(orgId, metadata.organization.name), ...metadata }; for (const doc of records.docs) { const data = doc.data(); const table = data.kind as typeof tables[number]; ensure(tables.includes(table) && data.value?.id, 'A workspace record needs repair.', 503); (s[table] as { id: string }[]).push(data.value); } }
    const before = snapshot.exists ? structuredClone(s) : emptyState(orgId, s.organization.name);
    const me = s.members.find(m => m.email === identity.email && m.active && (!m.uid || m.uid === identity.uid)); ensure(me, 'Your account has not been invited, or access has been disabled.', 403);
    if (!me.uid) { me.uid = identity.uid; s.revision += 1; s.audit.push({ id: crypto.randomUUID(), at: now, actorId: me.id, type: 'member.activated', targetId: me.id, summary: 'Invitation claimed by the verified email owner.' }); changed = true; }
    if (command) { ensure(Number.isInteger(expectedRevision) && expectedRevision === s.revision, 'The workspace changed while you were editing. Refresh, review the latest state, and submit again.', 409); s = execute(s, me.id, command, now); changed = true; }
    if (changed) persist(tx, ref, before, s);
    return viewFor(s, s.members.find(m => m.id === me.id)!);
  });
}
