import { closed, todayInZone, type View } from './model';
export type Metric = [label: string, numerator: number, denominator: number];
/** Cohorts include due or already completed records; a future scheduled record
 * is not evidence that a management review has taken place. */
export function operationalMetrics(v: View, today: string): Metric[] {
  const local = (stamp: string) => stamp ? todayInZone(v.organization.timezone, new Date(stamp)) : '';
  const people = v.members.filter(m => m.active);
  const plans = v.plans.filter(p => p.status !== 'completed');
  const planIds = new Set(plans.map(p => p.id));
  const commitments = v.actions.filter(a => !closed(a.status));
  const goals = v.expectations.filter(e => e.kind === 'goal' && planIds.has(e.planId));
  const reviews = v.reviews.filter(r => r.status !== 'cancelled' && (r.scheduledFor <= today || r.status === 'completed'));
  const followUps = v.followUps.filter(f => f.status !== 'cancelled' && (f.dueDate <= today || f.status === 'completed'));
  const feedback = v.feedback.filter(f => f.responseRequired && (f.responseDue <= today || Boolean(f.respondedAt)));
  const complete = v.actions.filter(a => a.status === 'completed');
  return [
    ['Current plans', people.filter(m => plans.some(p => p.scope === 'individual' && p.ownerId === m.id)).length, people.length],
    ['Named ownership', commitments.filter(a => a.ownerId).length, commitments.length],
    ['Measured goals', goals.filter(g => g.measure && g.target).length, goals.length],
    ['Reviews on time', reviews.filter(r => r.status === 'completed' && r.completedAt && local(r.completedAt) <= r.scheduledFor).length, reviews.length],
    ['Follow-ups on time', followUps.filter(f => f.status === 'completed' && f.completedAt && local(f.completedAt) <= f.dueDate).length, followUps.length],
    ['Responses on time', feedback.filter(f => f.respondedAt && local(f.respondedAt) <= f.responseDue).length, feedback.length],
    ['Reviewed & current plans', plans.filter(p => p.nextReview >= today && v.reviews.some(r => r.planId === p.id && r.status === 'completed') && !v.reviews.some(r => r.planId === p.id && r.status === 'scheduled' && r.scheduledFor < today)).length, plans.length],
    ['Completion evidence', complete.filter(a => a.evidence && a.verifiedAt).length, complete.length],
  ];
}
