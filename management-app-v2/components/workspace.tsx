'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { initiativeHealth, progressPercent, type Initiative, type KPI, type KPIStatus, type Member, type View } from '@/lib/model';
import AuthPanel from './auth-panel';
import { Badge, dateLabel, Empty, Modal, Panel, prettyStatus } from './ui';

type Page = 'overview' | 'team' | 'initiatives' | 'messages' | 'admin';
type ModalState =
  | { kind: 'member'; memberId?: string }
  | { kind: 'initiative' }
  | { kind: 'kpi-add'; initiativeId: string }
  | { kind: 'kpi-update'; kpiId: string }
  | { kind: 'initiative-close'; initiativeId: string }
  | null;

function tone(status: string) {
  if (['blocked', 'failed'].includes(status)) return 'danger';
  if (['at_risk', 'queued', 'sending', 'skipped'].includes(status)) return 'warning';
  if (['on_track', 'complete', 'completed', 'sent', 'active'].includes(status)) return 'good';
  return '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState<Page>('overview');
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (u: User | null) => {
    if (!u) return;
    setLoading(true);
    try {
      const response = await fetch('/api/workspace', {
        headers: { Authorization: `Bearer ${await u.getIdToken()}` },
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The workspace could not load.');
      if (auth?.currentUser?.uid === u.uid) {
        setView(data);
        setError('');
      }
    } catch (e) {
      if (auth?.currentUser?.uid === u.uid) {
        setView(null);
        setError(e instanceof Error ? e.message : 'The workspace could not load.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, current => {
      setUser(current);
      setView(null);
      setModal(null);
      setError('');
      setReady(true);
      if (current) void load(current);
    });
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (auth?.currentUser && document.visibilityState === 'visible') void load(auth.currentUser);
    };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [load]);

  async function send(type: string, payload: Record<string, unknown>) {
    if (!auth?.currentUser || !view) throw new Error('Sign in again.');
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
      },
      body: JSON.stringify({ revision: view.revision, command: { type, payload } })
    });
    const data = await response.json();
    if (!response.ok) {
      if ([401, 403, 409].includes(response.status)) await load(auth.currentUser);
      throw new Error(data.error || 'The change was not saved.');
    }
    setView(data);
    setNotice('Saved.');
    return data as View;
  }

  if (!ready) return <main className="loading"><span className="brand-mark">M</span><p>Opening management workspace…</p></main>;
  if (!view) return <AuthPanel user={user} error={error || (loading ? 'Checking access…' : '')} retry={() => load(auth?.currentUser || null)} />;

  const me = view.me;
  const memberName = (id: string) => view.directory.find(m => m.id === id)?.name || 'Team member';
  const myReports = view.directory.filter(m => m.managerId === me.id && m.active);
  const managers = view.directory.filter(m => m.role === 'manager' && m.active);
  const activeInitiatives = view.initiatives.filter(i => i.state === 'active');
  const atRisk = activeInitiatives.filter(i => ['at_risk', 'blocked'].includes(initiativeHealth(view.kpis.filter(k => k.initiativeId === i.id))));
  const dueSoon = activeInitiatives.filter(i => i.dueDate && i.dueDate >= today() && i.dueDate <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const failedNotifications = view.notifications.filter(n => ['failed', 'skipped'].includes(n.status));
  const selected = view.initiatives.find(i => i.id === selectedId);

  const visibleInitiatives = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return view.initiatives;
    return view.initiatives.filter(i => `${i.title} ${i.description} ${memberName(i.ownerId)}`.toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.initiatives, view.directory, search]);

  function navigate(next: Page) {
    setPage(next);
    setSelectedId('');
    setSearch('');
    setNotice('');
  }

  function openInitiative(id: string) {
    setPage('initiatives');
    setSelectedId(id);
    setNotice('');
  }

  const nav: Array<{ page: Page; label: string; symbol: string; count?: number }> = [
    { page: 'overview', label: 'Overview', symbol: '◫' },
    ...(me.role !== 'employee' ? [{ page: 'team' as Page, label: 'My team', symbol: '♧' }] : []),
    { page: 'initiatives', label: 'Initiatives', symbol: '◎', count: atRisk.length },
    { page: 'messages', label: 'Messages', symbol: '↔' },
    ...(me.role === 'admin' ? [{ page: 'admin' as Page, label: 'Administration', symbol: '⚙', count: failedNotifications.length }] : [])
  ];

  function heading(kicker: string, title: string, description: string, actions?: ReactNode) {
    return <div className="page-heading"><div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{actions}</div></div>;
  }

  function kpiCard(kpi: KPI, compact = false) {
    const initiative = view.initiatives.find(i => i.id === kpi.initiativeId)!;
    const updates = view.updates.filter(u => u.kpiId === kpi.id).slice(-3).reverse();
    return <article className={`kpi-card ${compact ? 'compact' : ''}`} key={kpi.id}>
      <div className="item-heading"><Badge tone={tone(kpi.status)}>{prettyStatus(kpi.status)}</Badge><small>{prettyStatus(kpi.cadence)}</small></div>
      <h3>{kpi.name}</h3>
      <div className="kpi-values"><div><small>Current</small><strong>{kpi.current} <em>{kpi.unit}</em></strong></div><div><small>Target</small><strong>{kpi.direction === 'at_most' ? '≤' : '≥'} {kpi.target} <em>{kpi.unit}</em></strong></div></div>
      <div className="progress"><span style={{ width: `${progressPercent(kpi)}%` }} /></div>
      <div className="kpi-footer"><span>{progressPercent(kpi)}% to target</span>{initiative.state === 'active' && <button className="text-button" onClick={() => setModal({ kind: 'kpi-update', kpiId: kpi.id })}>Update KPI</button>}</div>
      {!compact && updates.length > 0 && <div className="mini-history">{updates.map(u => <p key={u.id}><strong>{memberName(u.authorId)}</strong> · {u.value} {kpi.unit}{u.note ? ` — ${u.note}` : ''}<small>{dateLabel(u.createdAt)}</small></p>)}</div>}
    </article>;
  }

  function initiativeCard(initiative: Initiative) {
    const kpis = view.kpis.filter(k => k.initiativeId === initiative.id);
    const health = initiativeHealth(kpis);
    return <button className="initiative-card" key={initiative.id} onClick={() => openInitiative(initiative.id)}>
      <div className="item-heading"><Badge tone={tone(health)}>{prettyStatus(health)}</Badge><span className="owner-pill">{memberName(initiative.ownerId)}</span></div>
      <h3>{initiative.title}</h3>
      <p>{initiative.description}</p>
      <div className="initiative-stats"><span><strong>{kpis.length}</strong> KPIs</span><span><strong>{view.messages.filter(m => m.initiativeId === initiative.id).length}</strong> messages</span><span>{dateLabel(initiative.dueDate)}</span></div>
    </button>;
  }

  function Overview() {
    const own = activeInitiatives.filter(i => i.ownerId === me.id);
    const team = activeInitiatives.filter(i => i.ownerId !== me.id);
    return <>
      {heading('Today', me.role === 'employee' ? `Your work, ${me.name.split(' ')[0]}.` : `What needs attention, ${me.name.split(' ')[0]}?`, me.role === 'employee' ? 'Update your KPIs and keep the conversation moving.' : 'See the initiatives that are moving, slipping, or waiting for a response.', me.role !== 'employee' && <button onClick={() => setModal({ kind: 'initiative' })}>+ New initiative</button>)}
      <div className="metric-grid">
        <Panel><small>Active initiatives</small><strong>{activeInitiatives.length}</strong><span>Across your visible scope</span></Panel>
        <Panel><small>At risk / blocked</small><strong className={atRisk.length ? 'danger-text' : ''}>{atRisk.length}</strong><span>Needs management attention</span></Panel>
        <Panel><small>Due in 14 days</small><strong>{dueSoon.length}</strong><span>Upcoming commitments</span></Panel>
        <Panel><small>Messages</small><strong>{view.messages.length}</strong><span>Conversation attached to work</span></Panel>
      </div>
      {atRisk.length > 0 && <section className="section-block"><div className="section-title"><div><p className="eyebrow">Attention queue</p><h2>At risk or blocked</h2></div></div><div className="initiative-grid">{atRisk.map(initiativeCard)}</div></section>}
      <section className="section-block"><div className="section-title"><div><p className="eyebrow">Your responsibility</p><h2>{me.role === 'employee' ? 'My initiatives' : 'Owned by me'}</h2></div></div>{own.length ? <div className="initiative-grid">{own.map(initiativeCard)}</div> : <Empty title="Nothing assigned to you" detail="Your own initiatives will appear here." />}</section>
      {me.role !== 'employee' && <section className="section-block"><div className="section-title"><div><p className="eyebrow">Management scope</p><h2>Team initiatives</h2></div></div>{team.length ? <div className="initiative-grid">{team.map(initiativeCard)}</div> : <Empty title="No team initiatives yet" detail="Create an initiative with at least one measurable KPI." />}</section>}
    </>;
  }

  function Team() {
    const people = me.role === 'admin' ? managers : myReports;
    return <>
      {heading('People', me.role === 'admin' ? 'Your managers.' : 'Your direct reports.', me.role === 'admin' ? 'Manage the managers who own the employee layer.' : 'See each person’s initiatives, KPI health, and current attention needs.', me.role === 'admin' && <button onClick={() => setModal({ kind: 'member' })}>+ Add person</button>)}
      {people.length ? <div className="people-grid">{people.map(person => {
        const reports = view.directory.filter(m => m.managerId === person.id && m.active);
        const initiatives = activeInitiatives.filter(i => i.ownerId === person.id || reports.some(r => r.id === i.ownerId));
        const risk = initiatives.filter(i => ['at_risk', 'blocked'].includes(initiativeHealth(view.kpis.filter(k => k.initiativeId === i.id)))).length;
        return <article className="person-card" key={person.id}>
          <div className="person-head"><span className="avatar">{person.name.slice(0, 1).toUpperCase()}</span><div><h3>{person.name}</h3><p>{prettyStatus(person.role)} · {person.email}</p></div></div>
          <div className="person-numbers"><div><strong>{initiatives.length}</strong><small>initiatives</small></div><div><strong>{risk}</strong><small>at risk</small></div><div><strong>{reports.length}</strong><small>reports</small></div></div>
          {me.role === 'admin' && reports.length > 0 && <div className="report-list">{reports.map(r => <span key={r.id}>{r.name}</span>)}</div>}
          <div className="row-actions">{me.role === 'admin' && <button className="secondary small" onClick={() => setModal({ kind: 'member', memberId: person.id })}>Edit</button>}<button className="text-button" onClick={() => { setSearch(person.name); navigate('initiatives'); setSearch(person.name); }}>View initiatives →</button></div>
        </article>;
      })}</div> : <Empty title="No people yet" detail="Add the first manager and assign employees beneath that manager." />}
      {me.role === 'admin' && managers.length > 0 && <section className="section-block"><div className="section-title"><div><p className="eyebrow">Reporting structure</p><h2>Manager → employees</h2></div><button className="secondary" onClick={() => setModal({ kind: 'member' })}>+ Add person</button></div><div className="hierarchy">{managers.map(manager => <div className="hierarchy-row" key={manager.id}><div className="manager-node"><span className="avatar">{manager.name.slice(0, 1)}</span><div><strong>{manager.name}</strong><small>Manager</small></div></div><span className="tree-line">→</span><div className="employee-nodes">{view.directory.filter(m => m.managerId === manager.id && m.active).map(employee => <button key={employee.id} onClick={() => setModal({ kind: 'member', memberId: employee.id })}>{employee.name}</button>)}{view.directory.filter(m => m.managerId === manager.id && m.active).length === 0 && <span>No employees assigned</span>}</div></div>)}</div></section>}
    </>;
  }

  function Initiatives() {
    if (selected) return <InitiativeDetail initiative={selected} />;
    return <>
      {heading('Execution', 'Initiatives & KPIs', 'Every initiative has an owner, measurable KPIs, and one conversation thread.', me.role !== 'employee' && <button onClick={() => setModal({ kind: 'initiative' })}>+ New initiative</button>)}
      <div className="toolbar"><input aria-label="Search initiatives" placeholder="Search by initiative or owner" value={search} onChange={e => setSearch(e.target.value)} /><div className="toolbar-count">{visibleInitiatives.length} visible</div></div>
      {visibleInitiatives.length ? <div className="initiative-grid">{visibleInitiatives.map(initiativeCard)}</div> : <Empty title="No initiatives found" detail="Create an initiative or clear the current search." />}
    </>;
  }

  function InitiativeDetail({ initiative }: { initiative: Initiative }) {
    const kpis = view.kpis.filter(k => k.initiativeId === initiative.id);
    const messages = view.messages.filter(m => m.initiativeId === initiative.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const canManage = me.role === 'admin' || (me.role === 'manager' && (initiative.ownerId === me.id || myReports.some(r => r.id === initiative.ownerId)));
    const health = initiativeHealth(kpis);
    return <>
      <button className="back-link" onClick={() => setSelectedId('')}>← All initiatives</button>
      {heading(memberName(initiative.ownerId), initiative.title, initiative.description, <div className="inline-actions"><Badge tone={tone(health)}>{prettyStatus(health)}</Badge>{canManage && initiative.state === 'active' && <button className="secondary" onClick={() => setModal({ kind: 'kpi-add', initiativeId: initiative.id })}>+ Add KPI</button>}{canManage && initiative.state === 'active' && <button onClick={() => setModal({ kind: 'initiative-close', initiativeId: initiative.id })}>Complete initiative</button>}</div>)}
      <div className="detail-meta"><span>Owner <strong>{memberName(initiative.ownerId)}</strong></span><span>Due <strong>{dateLabel(initiative.dueDate)}</strong></span><span>Status <strong>{prettyStatus(initiative.state)}</strong></span></div>
      <div className="detail-grid">
        <section><div className="section-title"><div><p className="eyebrow">Measures</p><h2>KPIs</h2></div></div><div className="kpi-grid">{kpis.map(k => kpiCard(k))}</div></section>
        <section><div className="section-title"><div><p className="eyebrow">Two-way communication</p><h2>Conversation</h2></div></div><Panel className="thread"><div className="messages">{messages.length ? messages.map(message => <article className={`message ${message.authorId === me.id ? 'mine' : ''}`} key={message.id}><div><strong>{memberName(message.authorId)}</strong><small>{dateLabel(message.createdAt)}</small></div><p>{message.text}</p>{message.kpiId && <span className="context-chip">KPI: {view.kpis.find(k => k.id === message.kpiId)?.name}</span>}</article>) : <Empty title="Start the conversation" detail="Updates, questions, decisions, and support requests stay attached to this initiative." />}</div>{initiative.state === 'active' && <MessageComposer initiativeId={initiative.id} kpis={kpis} />}</Panel></section>
      </div>
    </>;
  }

  function MessageComposer({ initiativeId, kpis }: { initiativeId: string; kpis: KPI[] }) {
    const [text, setText] = useState('');
    const [kpiId, setKpiId] = useState('');
    const [busy, setBusy] = useState(false);
    return <form className="composer" onSubmit={async e => {
      e.preventDefault();
      if (!text.trim()) return;
      setBusy(true);
      try {
        await send('message.create', { initiativeId, ...(kpiId ? { kpiId } : {}), text });
        setText('');
        setKpiId('');
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Message was not sent.');
      } finally { setBusy(false); }
    }}><select aria-label="Message context" value={kpiId} onChange={e => setKpiId(e.target.value)}><option value="">Whole initiative</option>{kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select><textarea aria-label="Message" placeholder="Ask a question, share context, or respond…" value={text} onChange={e => setText(e.target.value)} required maxLength={2000} /><button disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button></form>;
  }

  function Messages() {
    const threads = [...view.initiatives].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return <>
      {heading('Communication', 'Messages', 'Conversation stays attached to the initiative instead of disappearing into separate inboxes.')}
      {threads.length ? <div className="thread-list">{threads.map(i => {
        const messages = view.messages.filter(m => m.initiativeId === i.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const last = messages[0];
        return <button key={i.id} onClick={() => openInitiative(i.id)}><div><strong>{i.title}</strong><span>{memberName(i.ownerId)}</span></div><p>{last ? `${memberName(last.authorId)}: ${last.text}` : 'No messages yet.'}</p><small>{last ? dateLabel(last.createdAt) : 'Open initiative'}</small></button>;
      })}</div> : <Empty title="No initiative threads yet" detail="Messages appear automatically with the work they discuss." />}
    </>;
  }

  function Admin() {
    return <>
      {heading('Administration', 'People & notifications', 'Maintain reporting relationships, contact channels, and failed notification deliveries.', <button onClick={() => setModal({ kind: 'member' })}>+ Add person</button>)}
      <Panel className="admin-table"><div className="table-row table-head"><span>Person</span><span>Role / reports to</span><span>Notifications</span><span></span></div>{view.directory.map(person => <div className="table-row" key={person.id}><span><strong>{person.name}</strong><small>{person.email}</small></span><span>{prettyStatus(person.role)}{person.managerId ? ` → ${memberName(person.managerId)}` : ''}</span><span><Badge tone={person.notifyEmail ? 'good' : ''}>Email {person.notifyEmail ? 'on' : 'off'}</Badge> <Badge tone={person.notifySms ? 'good' : ''}>SMS {person.notifySms ? 'on' : 'off'}</Badge></span><span>{person.id !== me.id && <button className="text-button" onClick={() => setModal({ kind: 'member', memberId: person.id })}>Edit</button>}</span></div>)}</Panel>
      <section className="section-block"><div className="section-title"><div><p className="eyebrow">Delivery exceptions</p><h2>Failed / skipped notifications</h2></div></div>{failedNotifications.length ? <Panel className="notification-list">{failedNotifications.slice().reverse().map(n => <div className="notification-row" key={n.id}><div><Badge tone="warning">{n.channel.toUpperCase()}</Badge><strong>{n.subject}</strong><p>{n.error}</p><small>{memberName(n.memberId)} · {dateLabel(n.createdAt)}</small></div><button className="secondary small" onClick={async () => { try { await send('notification.retry', { id: n.id }); } catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to retry.'); } }}>Retry</button></div>)}</Panel> : <Empty title="No delivery exceptions" detail="Email and SMS provider failures will appear here for retry." />}</section>
    </>;
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-lockup"><span className="brand-mark">M</span><strong>Management</strong></div><nav aria-label="Main navigation">{nav.map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}><span>{item.symbol}</span>{item.label}{Boolean(item.count) && <b>{item.count}</b>}</button>)}</nav><div className="session"><div className="avatar small">{me.name.slice(0, 1)}</div><div><strong>{me.name}</strong><small>{prettyStatus(me.role)}</small></div><button aria-label="Sign out" onClick={() => auth && signOut(auth)}>↗</button></div></aside>
    <header className="mobile-header"><div className="brand-lockup"><span className="brand-mark">M</span><strong>Management</strong></div><button aria-label="Sign out" onClick={() => auth && signOut(auth)}>Sign out</button></header>
    <main className="workspace"><div className="content">{notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}{page === 'overview' && <Overview />}{page === 'team' && <Team />}{page === 'initiatives' && <Initiatives />}{page === 'messages' && <Messages />}{page === 'admin' && <Admin />}</div></main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.slice(0, 5).map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}><span>{item.symbol}</span><small>{item.label.replace('Administration', 'Admin')}</small></button>)}</nav>
    {modal?.kind === 'member' && <MemberModal memberId={modal.memberId} onClose={() => setModal(null)} />}
    {modal?.kind === 'initiative' && <InitiativeModal onClose={() => setModal(null)} />}
    {modal?.kind === 'kpi-add' && <AddKpiModal initiativeId={modal.initiativeId} onClose={() => setModal(null)} />}
    {modal?.kind === 'kpi-update' && <UpdateKpiModal kpiId={modal.kpiId} onClose={() => setModal(null)} />}
    {modal?.kind === 'initiative-close' && <CloseInitiativeModal initiativeId={modal.initiativeId} onClose={() => setModal(null)} />}
  </div>;

  function MemberModal({ memberId, onClose }: { memberId?: string; onClose: () => void }) {
    const existing = view.directory.find(m => m.id === memberId);
    const availableManagers = view.directory.filter(m => m.role === 'manager' && m.active);
    const [role, setRole] = useState<'manager' | 'employee'>(existing?.role === 'employee' ? 'employee' : 'manager');
    const [sms, setSms] = useState(existing?.notifySms || false);
    return <Modal title={existing ? `Edit ${existing.name}` : 'Add a person'} description="Managers own employee relationships. Employees must be assigned to one manager." onClose={onClose}><form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      try {
        await send('member.save', { ...(existing ? { id: existing.id } : {}), name: data.get('name'), email: data.get('email'), role, ...(role === 'employee' ? { managerId: data.get('managerId') } : {}), phone: data.get('phone'), notifyEmail: data.get('notifyEmail') === 'on', notifySms: sms, active: true });
        onClose();
      } catch (err) { setNotice(err instanceof Error ? err.message : 'Person was not saved.'); }
    }}><label>Name<input name="name" defaultValue={existing?.name || ''} required /></label><label>Email<input name="email" type="email" defaultValue={existing?.email || ''} required /></label><label>Role<select value={role} onChange={e => setRole(e.target.value as 'manager' | 'employee')}><option value="manager">Manager</option><option value="employee">Employee</option></select></label>{role === 'employee' && <label>Reports to<select name="managerId" defaultValue={existing?.managerId || ''} required><option value="" disabled>Select manager</option>{availableManagers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}<label>Mobile number <small>E.164, e.g. +17575551234</small><input name="phone" defaultValue={existing?.phone || ''} placeholder="+17575551234" /></label><div className="check-row"><label><input name="notifyEmail" type="checkbox" defaultChecked={existing?.notifyEmail ?? true} /> Email notifications</label><label><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> SMS notifications</label></div><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button>Save person</button></div></form></Modal>;
  }

  function InitiativeModal({ onClose }: { onClose: () => void }) {
    const owners = me.role === 'admin' ? view.directory.filter(m => m.active && m.role !== 'admin') : [me, ...myReports];
    return <Modal title="Create initiative" description="Start with an owner and at least one measurable KPI." onClose={onClose}><form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      try {
        const updated = await send('initiative.create', { ownerId: data.get('ownerId'), title: data.get('title'), description: data.get('description'), dueDate: data.get('dueDate'), kpis: [{ name: data.get('kpiName'), unit: data.get('unit'), target: Number(data.get('target')), current: Number(data.get('current') || 0), direction: data.get('direction'), cadence: data.get('cadence') }] });
        const created = [...updated.initiatives].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        onClose();
        if (created) openInitiative(created.id);
      } catch (err) { setNotice(err instanceof Error ? err.message : 'Initiative was not created.'); }
    }}><label>Owner<select name="ownerId" required defaultValue=""><option value="" disabled>Select person</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label><label>Initiative<input name="title" required maxLength={160} placeholder="Improve customer experience" /></label><label>What outcome are we trying to achieve?<textarea name="description" required maxLength={1200} /></label><label>Due date<input name="dueDate" type="date" /></label><div className="form-divider"><span>First KPI</span></div><label>KPI name<input name="kpiName" required placeholder="Follow-ups within 24 hours" /></label><div className="form-grid"><label>Current<input name="current" type="number" step="any" defaultValue="0" /></label><label>Target<input name="target" type="number" step="any" required /></label><label>Unit<input name="unit" required placeholder="%" /></label><label>Direction<select name="direction"><option value="at_least">At least</option><option value="at_most">At most</option></select></label><label>Cadence<select name="cadence"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label></div><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button>Create initiative</button></div></form></Modal>;
  }

  function AddKpiModal({ initiativeId, onClose }: { initiativeId: string; onClose: () => void }) {
    return <Modal title="Add KPI" description="Add another measurable outcome to this initiative." onClose={onClose}><form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      try { await send('kpi.add', { initiativeId, name: data.get('name'), unit: data.get('unit'), target: Number(data.get('target')), current: Number(data.get('current') || 0), direction: data.get('direction'), cadence: data.get('cadence') }); onClose(); } catch (err) { setNotice(err instanceof Error ? err.message : 'KPI was not added.'); }
    }}><label>KPI name<input name="name" required /></label><div className="form-grid"><label>Current<input name="current" type="number" step="any" defaultValue="0" /></label><label>Target<input name="target" type="number" step="any" required /></label><label>Unit<input name="unit" required /></label><label>Direction<select name="direction"><option value="at_least">At least</option><option value="at_most">At most</option></select></label><label>Cadence<select name="cadence"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label></div><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button>Add KPI</button></div></form></Modal>;
  }

  function UpdateKpiModal({ kpiId, onClose }: { kpiId: string; onClose: () => void }) {
    const kpi = view.kpis.find(k => k.id === kpiId)!;
    return <Modal title={`Update ${kpi.name}`} description={`Target ${kpi.direction === 'at_most' ? '≤' : '≥'} ${kpi.target} ${kpi.unit}`} onClose={onClose}><form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      try { await send('kpi.update', { id: kpi.id, current: Number(data.get('current')), status: data.get('status'), note: data.get('note') }); onClose(); } catch (err) { setNotice(err instanceof Error ? err.message : 'KPI was not updated.'); }
    }}><label>Current value<input name="current" type="number" step="any" defaultValue={kpi.current} required /></label><label>Status<select name="status" defaultValue={kpi.status}><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select></label><label>Update note<textarea name="note" placeholder="What changed, what is needed, or what happens next?" maxLength={1000} /></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button>Save update</button></div></form></Modal>;
  }

  function CloseInitiativeModal({ initiativeId, onClose }: { initiativeId: string; onClose: () => void }) {
    const initiative = view.initiatives.find(i => i.id === initiativeId)!;
    const kpis = view.kpis.filter(k => k.initiativeId === initiative.id);
    const incomplete = kpis.filter(k => k.status !== 'complete');
    return <Modal title="Complete initiative" description={initiative.title} onClose={onClose}>{incomplete.length ? <><p className="notice">Every KPI must be complete first.</p><div className="mini-list">{incomplete.map(k => <span key={k.id}>{k.name} · {prettyStatus(k.status)}</span>)}</div><div className="form-actions"><button className="secondary" onClick={onClose}>Return to KPIs</button></div></> : <><p>All {kpis.length} KPIs are complete. This will preserve the initiative, KPI history, and conversation as completed management evidence.</p><div className="form-actions"><button className="secondary" onClick={onClose}>Cancel</button><button onClick={async () => { try { await send('initiative.update', { id: initiative.id, state: 'completed' }); onClose(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Initiative could not be completed.'); } }}>Complete initiative</button></div></>}</Modal>;
  }
}
