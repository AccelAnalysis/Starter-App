import type { State } from '../lib/model';

const at = '2026-09-01T12:00:00.000Z';

export function fixture(): State {
  return {
    schema: 2,
    revision: 7,
    organization: { id: 'management-v2', name: 'Example Organization' },
    members: [
      { id: 'admin', uid: 'admin-uid', email: 'admin@example.test', name: 'Avery Admin', role: 'admin', active: true, notifyEmail: true, notifySms: false, createdAt: at },
      { id: 'manager', uid: 'manager-uid', email: 'manager@example.test', name: 'Morgan Manager', role: 'manager', managerId: 'admin', phone: '+17575550101', active: true, notifyEmail: true, notifySms: true, createdAt: at },
      { id: 'manager2', uid: 'manager2-uid', email: 'manager2@example.test', name: 'Riley Manager', role: 'manager', managerId: 'admin', active: true, notifyEmail: true, notifySms: false, createdAt: at },
      { id: 'alice', uid: 'alice-uid', email: 'alice@example.test', name: 'Alice Employee', role: 'employee', managerId: 'manager', phone: '+17575550102', active: true, notifyEmail: true, notifySms: true, createdAt: at },
      { id: 'bob', uid: 'bob-uid', email: 'bob@example.test', name: 'Bob Employee', role: 'employee', managerId: 'manager', active: true, notifyEmail: true, notifySms: false, createdAt: at },
      { id: 'charlie', uid: 'charlie-uid', email: 'charlie@example.test', name: 'Charlie Employee', role: 'employee', managerId: 'manager2', active: true, notifyEmail: true, notifySms: false, createdAt: at }
    ],
    initiatives: [
      {
        id: 'initiative-alice',
        ownerId: 'alice',
        createdBy: 'manager',
        title: 'Grow qualified pipeline',
        description: 'Build a repeatable flow of qualified opportunities and improve conversion.',
        dueDate: '2026-10-31',
        state: 'active',
        createdAt: at,
        updatedAt: at
      }
    ],
    kpis: [
      { id: 'kpi-opportunities', initiativeId: 'initiative-alice', name: 'Qualified opportunities', unit: 'per week', target: 10, current: 7, direction: 'at_least', cadence: 'weekly', status: 'at_risk', updatedAt: at },
      { id: 'kpi-conversion', initiativeId: 'initiative-alice', name: 'Lead conversion', unit: '%', target: 25, current: 27, direction: 'at_least', cadence: 'monthly', status: 'on_track', updatedAt: at }
    ],
    updates: [],
    messages: [
      { id: 'message-one', initiativeId: 'initiative-alice', authorId: 'manager', text: 'Let’s keep this focused on qualified opportunities, not raw lead volume.', createdAt: at }
    ],
    notifications: []
  };
}

export function member(state: State, id: string) {
  return state.members.find(m => m.id === id)!;
}
