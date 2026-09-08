import { emptyState, type State, type Command } from './model';
import { DomainError, ensure, member } from './policy';
import { id } from './transitions';
import { administer } from './admin-plans';
import { work } from './work';
import { review } from './reviews';
export { DomainError } from './policy';
export function bootstrap(email: string, uid: string, name: string, orgId: string, orgName: string, at: string): State { const s = emptyState(orgId, orgName); s.members.push({ id: id(), uid, email: email.toLowerCase(), name, role: 'admin', teamId: '', jobTitle: 'Organization administrator', active: true }); s.audit.push({ id: id(), at, actorId: s.members[0].id, type: 'workspace.bootstrap', targetId: orgId, summary: 'Workspace initialized by the configured verified administrator.' }); return s; }
export function execute(original: State, actorId: string, command: Command, at = new Date().toISOString()): State { const s = structuredClone(original); const a = member(s, actorId); ensure(command && typeof command.type === 'string' && command.payload && typeof command.payload === 'object' && !Array.isArray(command.payload), 'Invalid command.', 400); const targetId = administer(s, a, command, at) ?? work(s, a, command, at) ?? review(s, a, command, at); if (targetId === null) throw new DomainError('Unknown operation.'); s.revision += 1; s.audit.push({ id: id(), at, actorId: a.id, type: command.type, targetId, summary: command.type.replaceAll('.', ' ') }); for (const value of Object.values(s)) if (Array.isArray(value)) for (const row of value) ensure(Buffer.byteLength(JSON.stringify(row), 'utf8') < 850000, 'This record has reached its history limit. Export and migrate it before adding more history; nothing has been deleted.', 409); return s; }
