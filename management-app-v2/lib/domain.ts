import type {
  Cadence,
  Command,
  Direction,
  KPI,
  KPIStatus,
  Member,
  Notification,
  NotificationChannel,
  State
} from './model';
import {
  canManageInitiative,
  canManageMember,
  canSeeInitiative,
  cleanEmail,
  cleanNumber,
  cleanOptionalText,
  cleanPhone,
  cleanText,
  DomainError,
  ensure,
  initiativeById,
  memberById
} from './policy';

const roles = ['admin', 'manager', 'employee'] as const;
const statuses: KPIStatus[] = ['on_track', 'at_risk', 'blocked', 'complete'];
const cadences: Cadence[] = ['weekly', 'monthly', 'quarterly'];
const directions: Direction[] = ['at_least', 'at_most'];

function id() {
  return crypto.randomUUID();
}

function date(value: unknown, field: string): string | undefined {
  const text = cleanOptionalText(value, field, 10);
  if (!text) return undefined;
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(text), `${field} must use YYYY-MM-DD.`);
  return text;
}

function channelNotifications(
  state: State,
  recipient: Member | undefined,
  initiativeId: string,
  sourceType: Notification['sourceType'],
  sourceId: string,
  subject: string,
  body: string,
  now: string
) {
  if (!recipient?.active) return;
  const add = (channel: NotificationChannel) => state.notifications.push({
    id: id(),
    memberId: recipient.id,
    initiativeId,
    sourceType,
    sourceId,
    channel,
    subject,
    body,
    status: 'queued',
    createdAt: now
  });
  if (recipient.notifyEmail) add('email');
  if (recipient.notifySms && recipient.phone) add('sms');
}

function counterpart(state: State, actor: Member, owner: Member): Member | undefined {
  if (actor.id !== owner.id) return owner;
  if (owner.managerId) return state.members.find(m => m.id === owner.managerId && m.active);
  return state.members.find(m => m.role === 'admin' && m.active && m.id !== owner.id);
}

function makeKpi(initiativeId: string, raw: {
  name: string;
  unit: string;
  target: number;
  current?: number;
  direction?: Direction;
  cadence?: Cadence;
}, now: string): KPI {
  const direction = raw.direction || 'at_least';
  const cadence = raw.cadence || 'weekly';
  ensure(directions.includes(direction), 'Choose a valid KPI direction.');
  ensure(cadences.includes(cadence), 'Choose a valid KPI cadence.');
  return {
    id: id(),
    initiativeId,
    name: cleanText(raw.name, 'KPI name', 2, 120),
    unit: cleanText(raw.unit, 'KPI unit', 1, 40),
    target: cleanNumber(raw.target, 'KPI target'),
    current: cleanNumber(raw.current ?? 0, 'Current KPI value'),
    direction,
    cadence,
    status: 'on_track',
    updatedAt: now
  };
}

export function bootstrap(email: string, uid: string, name: string, workspaceId: string, orgName: string, now: string): State {
  const memberId = id();
  return {
    schema: 2,
    revision: 1,
    organization: { id: workspaceId, name: cleanText(orgName, 'Organization name', 2, 120) },
    members: [{
      id: memberId,
      uid,
      email: cleanEmail(email),
      name: cleanText(name || email.split('@')[0], 'Name', 1, 100),
      role: 'admin',
      active: true,
      notifyEmail: true,
      notifySms: false,
      createdAt: now
    }],
    initiatives: [],
    kpis: [],
    updates: [],
    messages: [],
    notifications: []
  };
}

export function execute(state: State, actorId: string, command: Command, now: string): State {
  const s = structuredClone(state);
  const actor = memberById(s, actorId);

  switch (command.type) {
    case 'member.save': {
      ensure(actor.role === 'admin', 'Only an administrator can manage people.', 403);
      const p = command.payload;
      const role = p.role;
      ensure(roles.includes(role), 'Choose a valid role.');
      const email = cleanEmail(p.email);
      const name = cleanText(p.name, 'Name', 1, 100);
      const phone = cleanPhone(p.phone);
      const existing = p.id ? s.members.find(m => m.id === p.id) : undefined;
      ensure(!p.id || existing, 'That person no longer exists.', 404);
      ensure(!s.members.some(m => m.email === email && m.id !== existing?.id), 'That email is already in the workspace.', 409);
      if (existing?.id === actor.id) ensure(p.active !== false && role === 'admin', 'The active administrator cannot disable or demote their own account.');
      if (existing?.role === 'manager' && role !== 'manager') ensure(!s.members.some(m => m.active && m.managerId === existing.id), 'Reassign this manager’s employees before changing their role.', 409);

      let managerId: string | undefined;
      if (role === 'employee') {
        ensure(p.managerId, 'Employees must be assigned to a manager.');
        const manager = memberById(s, p.managerId);
        ensure(manager.role === 'manager', 'Employees must report to a manager.');
        managerId = manager.id;
      } else if (role === 'manager') {
        const requested = p.managerId || actor.id;
        const manager = memberById(s, requested);
        ensure(manager.role === 'admin', 'Managers must report to an administrator.');
        managerId = manager.id;
      }

      const record: Member = {
        id: existing?.id || id(),
        uid: existing?.uid,
        email,
        name,
        role,
        managerId,
        phone,
        active: p.active ?? existing?.active ?? true,
        notifyEmail: p.notifyEmail ?? existing?.notifyEmail ?? true,
        notifySms: p.notifySms ?? existing?.notifySms ?? Boolean(phone),
        createdAt: existing?.createdAt || now
      };
      if (record.notifySms) ensure(record.phone, 'A phone number is required for SMS notifications.');
      if (existing) Object.assign(existing, record);
      else s.members.push(record);
      break;
    }

    case 'initiative.create': {
      ensure(actor.role !== 'employee', 'Only managers and administrators can create initiatives.', 403);
      const p = command.payload;
      const owner = memberById(s, p.ownerId);
      ensure(canManageMember(s, actor, owner.id), 'You cannot assign work to that person.', 403);
      ensure(Array.isArray(p.kpis) && p.kpis.length >= 1 && p.kpis.length <= 12, 'Every initiative must start with 1-12 KPIs.');
      const initiativeId = id();
      const initiative = {
        id: initiativeId,
        ownerId: owner.id,
        createdBy: actor.id,
        title: cleanText(p.title, 'Initiative title', 2, 160),
        description: cleanText(p.description, 'Initiative description', 2, 1200),
        dueDate: date(p.dueDate, 'Due date'),
        state: 'active' as const,
        createdAt: now,
        updatedAt: now
      };
      s.initiatives.push(initiative);
      for (const raw of p.kpis) s.kpis.push(makeKpi(initiativeId, raw, now));
      if (owner.id !== actor.id) channelNotifications(
        s, owner, initiative.id, 'initiative', initiative.id,
        `New initiative: ${initiative.title}`,
        `${actor.name} assigned "${initiative.title}" with ${p.kpis.length} KPI${p.kpis.length === 1 ? '' : 's'}.`,
        now
      );
      break;
    }

    case 'initiative.update': {
      const initiative = initiativeById(s, command.payload.id);
      ensure(canManageInitiative(s, actor, initiative), 'You cannot manage this initiative.', 403);
      if (command.payload.title !== undefined) initiative.title = cleanText(command.payload.title, 'Initiative title', 2, 160);
      if (command.payload.description !== undefined) initiative.description = cleanText(command.payload.description, 'Initiative description', 2, 1200);
      if (command.payload.dueDate !== undefined) initiative.dueDate = date(command.payload.dueDate, 'Due date');
      if (command.payload.state !== undefined) {
        ensure(['active', 'completed'].includes(command.payload.state), 'Choose a valid initiative state.');
        if (command.payload.state === 'completed') {
          const related = s.kpis.filter(k => k.initiativeId === initiative.id);
          ensure(related.length > 0 && related.every(k => k.status === 'complete'), 'Complete every KPI before closing the initiative.', 409);
        }
        initiative.state = command.payload.state;
      }
      initiative.updatedAt = now;
      break;
    }

    case 'kpi.add': {
      const initiative = initiativeById(s, command.payload.initiativeId);
      ensure(initiative.state === 'active', 'Completed initiatives cannot receive new KPIs.', 409);
      ensure(canManageInitiative(s, actor, initiative), 'You cannot manage this initiative.', 403);
      const count = s.kpis.filter(k => k.initiativeId === initiative.id).length;
      ensure(count < 12, 'An initiative supports at most 12 KPIs in this version.');
      s.kpis.push(makeKpi(initiative.id, command.payload, now));
      initiative.updatedAt = now;
      break;
    }

    case 'kpi.update': {
      const kpi = s.kpis.find(k => k.id === command.payload.id);
      ensure(kpi, 'That KPI does not exist.', 404);
      const initiative = initiativeById(s, kpi.initiativeId);
      ensure(initiative.state === 'active', 'This initiative is already completed.', 409);
      ensure(canSeeInitiative(s, actor, initiative), 'You cannot update this KPI.', 403);
      const owner = memberById(s, initiative.ownerId);
      if (actor.role === 'employee') ensure(owner.id === actor.id, 'Employees can update only their own KPIs.', 403);
      ensure(statuses.includes(command.payload.status), 'Choose a valid KPI status.');
      const value = cleanNumber(command.payload.current, 'Current KPI value');
      const note = cleanOptionalText(command.payload.note, 'Update note', 1000) || '';
      kpi.current = value;
      kpi.status = command.payload.status;
      kpi.updatedAt = now;
      const update = {
        id: id(),
        kpiId: kpi.id,
        initiativeId: initiative.id,
        authorId: actor.id,
        value,
        status: kpi.status,
        note,
        createdAt: now
      };
      s.updates.push(update);
      initiative.updatedAt = now;
      const recipient = counterpart(s, actor, owner);
      channelNotifications(
        s, recipient, initiative.id, 'kpi_update', update.id,
        `KPI update: ${kpi.name}`,
        `${actor.name} updated ${kpi.name} to ${value} ${kpi.unit}${note ? ` — ${note}` : ''}.`,
        now
      );
      break;
    }

    case 'message.create': {
      const initiative = initiativeById(s, command.payload.initiativeId);
      ensure(canSeeInitiative(s, actor, initiative), 'You cannot access this conversation.', 403);
      if (command.payload.kpiId) {
        const kpi = s.kpis.find(k => k.id === command.payload.kpiId && k.initiativeId === initiative.id);
        ensure(kpi, 'That KPI is not part of this initiative.', 404);
      }
      const message = {
        id: id(),
        initiativeId: initiative.id,
        kpiId: command.payload.kpiId,
        authorId: actor.id,
        text: cleanText(command.payload.text, 'Message', 1, 2000),
        createdAt: now
      };
      s.messages.push(message);
      const owner = memberById(s, initiative.ownerId);
      const recipient = counterpart(s, actor, owner);
      channelNotifications(
        s, recipient, initiative.id, 'message', message.id,
        `Message: ${initiative.title}`,
        `${actor.name}: ${message.text}`,
        now
      );
      break;
    }

    case 'notification.retry': {
      const n = s.notifications.find(n => n.id === command.payload.id);
      ensure(n, 'That notification does not exist.', 404);
      ensure(actor.role === 'admin' || n.memberId === actor.id, 'You cannot retry that notification.', 403);
      ensure(['failed', 'skipped'].includes(n.status), 'Only failed or skipped notifications can be retried.');
      n.status = 'queued';
      n.error = undefined;
      n.sentAt = undefined;
      break;
    }

    default:
      throw new DomainError('Unknown command.');
  }

  s.revision += 1;
  return s;
}
