export type Role = 'admin' | 'manager' | 'employee';
export type KPIStatus = 'on_track' | 'at_risk' | 'blocked' | 'complete';
export type InitiativeState = 'active' | 'completed';
export type Cadence = 'weekly' | 'monthly' | 'quarterly';
export type Direction = 'at_least' | 'at_most';
export type NotificationChannel = 'email' | 'sms';
export type NotificationStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface Organization {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: Role;
  managerId?: string;
  phone?: string;
  active: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  createdAt: string;
}

export interface Initiative {
  id: string;
  ownerId: string;
  createdBy: string;
  title: string;
  description: string;
  dueDate?: string;
  state: InitiativeState;
  createdAt: string;
  updatedAt: string;
}

export interface KPI {
  id: string;
  initiativeId: string;
  name: string;
  unit: string;
  target: number;
  current: number;
  direction: Direction;
  cadence: Cadence;
  status: KPIStatus;
  updatedAt: string;
}

export interface KPIUpdate {
  id: string;
  kpiId: string;
  initiativeId: string;
  authorId: string;
  value: number;
  status: KPIStatus;
  note: string;
  createdAt: string;
}

export interface Message {
  id: string;
  initiativeId: string;
  kpiId?: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  memberId: string;
  initiativeId: string;
  sourceType: 'initiative' | 'message' | 'kpi_update';
  sourceId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export interface State {
  schema: 2;
  revision: number;
  organization: Organization;
  members: Member[];
  initiatives: Initiative[];
  kpis: KPI[];
  updates: KPIUpdate[];
  messages: Message[];
  notifications: Notification[];
}

export interface DirectoryMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId?: string;
  phone?: string;
  active: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

export interface View {
  revision: number;
  organization: Organization;
  me: DirectoryMember;
  directory: DirectoryMember[];
  initiatives: Initiative[];
  kpis: KPI[];
  updates: KPIUpdate[];
  messages: Message[];
  notifications: Notification[];
}

export type Command =
  | { type: 'member.save'; payload: {
      id?: string;
      email: string;
      name: string;
      role: Role;
      managerId?: string;
      phone?: string;
      notifyEmail?: boolean;
      notifySms?: boolean;
      active?: boolean;
    } }
  | { type: 'initiative.create'; payload: {
      ownerId: string;
      title: string;
      description: string;
      dueDate?: string;
      kpis: Array<{
        name: string;
        unit: string;
        target: number;
        current?: number;
        direction?: Direction;
        cadence?: Cadence;
      }>;
    } }
  | { type: 'initiative.update'; payload: {
      id: string;
      title?: string;
      description?: string;
      dueDate?: string;
      state?: InitiativeState;
    } }
  | { type: 'kpi.add'; payload: {
      initiativeId: string;
      name: string;
      unit: string;
      target: number;
      current?: number;
      direction?: Direction;
      cadence?: Cadence;
    } }
  | { type: 'kpi.update'; payload: {
      id: string;
      current: number;
      status: KPIStatus;
      note?: string;
    } }
  | { type: 'message.create'; payload: {
      initiativeId: string;
      kpiId?: string;
      text: string;
    } }
  | { type: 'notification.retry'; payload: { id: string } };

export function emptyState(id: string, name: string): State {
  return {
    schema: 2,
    revision: 0,
    organization: { id, name },
    members: [],
    initiatives: [],
    kpis: [],
    updates: [],
    messages: [],
    notifications: []
  };
}

export function progressPercent(kpi: KPI): number {
  if (!Number.isFinite(kpi.target) || !Number.isFinite(kpi.current)) return 0;
  if (kpi.target === 0) return kpi.current === 0 ? 100 : 0;
  const raw = kpi.direction === 'at_most'
    ? (kpi.current <= kpi.target ? 100 : (kpi.target / kpi.current) * 100)
    : (kpi.current / kpi.target) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function initiativeHealth(kpis: KPI[]): KPIStatus {
  if (kpis.length === 0) return 'blocked';
  if (kpis.every(k => k.status === 'complete')) return 'complete';
  if (kpis.some(k => k.status === 'blocked')) return 'blocked';
  if (kpis.some(k => k.status === 'at_risk')) return 'at_risk';
  return 'on_track';
}
