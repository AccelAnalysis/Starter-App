import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { bootstrap, execute } from './domain';
import { deliverNotification } from './notifications';
import { emptyState, type Command, type Notification, type State, type View } from './model';
import { DomainError, ensure, viewFor } from './policy';

export const tables = ['members', 'initiatives', 'kpis', 'updates', 'messages', 'notifications'] as const;
type Table = typeof tables[number];

export interface Identity {
  uid: string;
  email: string;
  name: string;
}

export function services() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  ensure(projectId, 'The workspace backend is not configured.', 503);
  const emulator = process.env.MANAGEMENT_EMULATOR === 'true';
  const emulatorHosts = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator || emulatorHosts) {
    ensure(
      emulator &&
      process.env.NODE_ENV !== 'production' &&
      projectId.startsWith('demo-') &&
      process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099' &&
      process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080',
      'Unsafe emulator configuration refused.',
      503
    );
  }

  let app = getApps().find(a => a.name === 'management-v2-server');
  if (!app) {
    const secret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    app = initializeApp({
      projectId,
      ...(emulator ? {} : { credential: secret ? cert(JSON.parse(secret)) : applicationDefault() })
    }, 'management-v2-server');
  }
  const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim();
  return {
    auth: getAuth(app),
    db: databaseId ? getFirestore(app, databaseId) : getFirestore(app)
  };
}

export async function authenticate(authorization: string | null): Promise<Identity> {
  if (!authorization?.startsWith('Bearer ')) throw new DomainError('Sign in to continue.', 401);
  const token = authorization.slice(7);
  ensure(token.length > 0 && token.length < 10000, 'Invalid session.', 401);
  try {
    const decoded = await services().auth.verifyIdToken(token, true);
    ensure(decoded.email && decoded.email_verified === true, 'Verify your email before entering the workspace.', 403);
    return {
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
      name: typeof decoded.name === 'string' && decoded.name.trim()
        ? decoded.name.trim()
        : decoded.email.split('@')[0]
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('Your session expired or was revoked. Please sign in again.', 401);
  }
}

function metadataRef() {
  const workspaceId = process.env.WORKSPACE_ID || 'management-v2';
  ensure(/^[A-Za-z0-9_-]{1,80}$/.test(workspaceId), 'Invalid workspace configuration.', 503);
  return services().db.doc(`managementV2Workspaces/${workspaceId}`);
}

function recordMap(s: State): Record<Table, { id: string }[]> {
  return {
    members: s.members,
    initiatives: s.initiatives,
    kpis: s.kpis,
    updates: s.updates,
    messages: s.messages,
    notifications: s.notifications
  };
}

function persist(tx: Transaction, ref: DocumentReference, before: State, after: State) {
  tx.set(ref, {
    schema: after.schema,
    revision: after.revision,
    organization: after.organization
  });
  const oldTables = recordMap(before);
  const newTables = recordMap(after);
  for (const table of tables) {
    const old = new Map(oldTables[table].map(row => [row.id, JSON.stringify(row)]));
    for (const row of newTables[table]) {
      if (old.get(row.id) !== JSON.stringify(row)) {
        tx.set(ref.collection('records').doc(`${table}__${row.id}`), { kind: table, value: row });
      }
    }
  }
}

export async function workspace(identity: Identity, command?: Command, expectedRevision?: number): Promise<View> {
  const ref = metadataRef();
  return services().db.runTransaction(async tx => {
    const [snapshot, records] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection('records'))
    ]);
    const now = new Date().toISOString();
    let state: State;
    let changed = false;

    if (!snapshot.exists) {
      ensure(records.empty, 'Workspace metadata is missing. Restore it before continuing.', 503);
      ensure(
        identity.email === process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
        'Your account has not been invited to this workspace.',
        403
      );
      state = bootstrap(
        identity.email,
        identity.uid,
        identity.name,
        process.env.WORKSPACE_ID || 'management-v2',
        process.env.BOOTSTRAP_ORG_NAME || 'My organization',
        now
      );
      changed = true;
    } else {
      const metadata = snapshot.data()!;
      ensure(metadata.schema === 2, 'Workspace migration is required.', 503);
      state = {
        ...emptyState(metadata.organization.id, metadata.organization.name),
        ...metadata,
        members: [],
        initiatives: [],
        kpis: [],
        updates: [],
        messages: [],
        notifications: []
      };
      for (const doc of records.docs) {
        const data = doc.data();
        const table = data.kind as Table;
        ensure(tables.includes(table) && data.value?.id, 'A workspace record needs repair.', 503);
        (state[table] as { id: string }[]).push(data.value);
      }
    }

    const before = snapshot.exists ? structuredClone(state) : emptyState(state.organization.id, state.organization.name);
    const me = state.members.find(m =>
      m.email === identity.email &&
      m.active &&
      (!m.uid || m.uid === identity.uid)
    );
    ensure(me, 'Your account has not been invited, or access has been disabled.', 403);

    if (!me.uid) {
      me.uid = identity.uid;
      state.revision += 1;
      changed = true;
    }

    if (command) {
      ensure(
        Number.isInteger(expectedRevision) && expectedRevision === state.revision,
        'The workspace changed while you were editing. Refresh and try again.',
        409
      );
      state = execute(state, me.id, command, now);
      changed = true;
    }

    if (changed) persist(tx, ref, before, state);
    return viewFor(state, state.members.find(m => m.id === me.id)!);
  });
}

export async function flushNotifications(limit = 12): Promise<void> {
  const ref = metadataRef();
  const db = services().db;
  const records = await ref.collection('records').get();
  const members = new Map<string, State['members'][number]>();
  const queued: Array<{ ref: DocumentReference; value: Notification }> = [];

  for (const doc of records.docs) {
    const data = doc.data();
    if (data.kind === 'members') members.set(data.value.id, data.value);
    if (data.kind === 'notifications' && data.value?.status === 'queued') {
      queued.push({ ref: doc.ref, value: data.value });
    }
  }

  for (const candidate of queued.slice(0, limit)) {
    const claimed = await db.runTransaction(async tx => {
      const snap = await tx.get(candidate.ref);
      const data = snap.data();
      if (!snap.exists || data?.kind !== 'notifications' || data.value?.status !== 'queued') return null;
      const notification = { ...data.value, status: 'sending' } as Notification;
      tx.set(candidate.ref, { kind: 'notifications', value: notification });
      return notification;
    });
    if (!claimed) continue;

    const member = members.get(claimed.memberId);
    const result = member
      ? await deliverNotification(member, claimed)
      : { status: 'failed' as const, error: 'Notification recipient no longer exists.' };

    await db.runTransaction(async tx => {
      const snap = await tx.get(candidate.ref);
      const data = snap.data();
      if (!snap.exists || data?.kind !== 'notifications' || data.value?.status !== 'sending') return;
      const notification: Notification = {
        ...data.value,
        status: result.status,
        ...(result.status === 'sent' ? { sentAt: new Date().toISOString(), error: undefined } : { error: result.error })
      };
      tx.set(candidate.ref, { kind: 'notifications', value: notification });
    });
  }
}
