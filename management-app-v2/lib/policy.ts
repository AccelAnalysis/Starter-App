import type { Initiative, Member, State, View } from './model';

export class DomainError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'DomainError';
  }
}

export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}

export function cleanText(value: unknown, field: string, min = 1, max = 300): string {
  ensure(typeof value === 'string', `${field} is required.`);
  const text = value.trim();
  ensure(text.length >= min && text.length <= max, `${field} must be ${min}-${max} characters.`);
  return text;
}

export function cleanOptionalText(value: unknown, field: string, max = 300): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return cleanText(value, field, 1, max);
}

export function cleanEmail(value: unknown): string {
  const email = cleanText(value, 'Email', 3, 254).toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
  return email;
}

export function cleanPhone(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const phone = cleanText(value, 'Phone', 7, 24);
  ensure(/^\+[1-9]\d{7,14}$/.test(phone), 'Phone must use E.164 format, for example +17575551234.');
  return phone;
}

export function cleanNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  ensure(Number.isFinite(n), `${field} must be a number.`);
  ensure(Math.abs(n) <= 1_000_000_000, `${field} is outside the supported range.`);
  return n;
}

export function memberById(state: State, id: string): Member {
  const member = state.members.find(m => m.id === id && m.active);
  ensure(member, 'That person is not active in this workspace.', 404);
  return member;
}

export function initiativeById(state: State, id: string): Initiative {
  const initiative = state.initiatives.find(i => i.id === id);
  ensure(initiative, 'That initiative does not exist.', 404);
  return initiative;
}

export function directReports(state: State, managerId: string): Member[] {
  return state.members.filter(m => m.active && m.managerId === managerId);
}

export function canManageMember(state: State, actor: Member, targetId: string): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'manager') return false;
  return targetId === actor.id || state.members.some(m => m.id === targetId && m.active && m.managerId === actor.id);
}

export function canSeeInitiative(state: State, actor: Member, initiative: Initiative): boolean {
  if (actor.role === 'admin') return true;
  if (initiative.ownerId === actor.id) return true;
  return actor.role === 'manager' && state.members.some(m => m.id === initiative.ownerId && m.active && m.managerId === actor.id);
}

export function canManageInitiative(state: State, actor: Member, initiative: Initiative): boolean {
  return actor.role !== 'employee' && canManageMember(state, actor, initiative.ownerId);
}

function directoryFor(state: State, actor: Member): Member[] {
  if (actor.role === 'admin') return state.members.filter(m => m.active);
  if (actor.role === 'manager') {
    const ids = new Set([actor.id, ...directReports(state, actor.id).map(m => m.id)]);
    if (actor.managerId) ids.add(actor.managerId);
    return state.members.filter(m => m.active && ids.has(m.id));
  }
  const ids = new Set([actor.id]);
  if (actor.managerId) ids.add(actor.managerId);
  return state.members.filter(m => m.active && ids.has(m.id));
}

export function viewFor(state: State, actor: Member): View {
  const visibleInitiatives = state.initiatives.filter(i => canSeeInitiative(state, actor, i));
  const initiativeIds = new Set(visibleInitiatives.map(i => i.id));
  const kpis = state.kpis.filter(k => initiativeIds.has(k.initiativeId));
  const kpiIds = new Set(kpis.map(k => k.id));
  const visibleMemberIds = new Set(directoryFor(state, actor).map(m => m.id));
  const directory = directoryFor(state, actor).map(({ id, name, email, role, managerId, phone, active, notifyEmail, notifySms }) => ({
    id, name, email, role, managerId, phone, active, notifyEmail, notifySms
  }));
  return {
    revision: state.revision,
    organization: state.organization,
    me: directory.find(m => m.id === actor.id)!,
    directory,
    initiatives: visibleInitiatives,
    kpis,
    updates: state.updates.filter(u => initiativeIds.has(u.initiativeId) && kpiIds.has(u.kpiId)),
    messages: state.messages.filter(m => initiativeIds.has(m.initiativeId)),
    notifications: state.notifications.filter(n => initiativeIds.has(n.initiativeId) && (actor.role === 'admin' || n.memberId === actor.id || visibleMemberIds.has(n.memberId)))
  };
}
