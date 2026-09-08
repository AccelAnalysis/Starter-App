import type { Member, Notification } from './model';

export interface DeliveryResult {
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

export function notificationDestination(member: Member, notification: Notification): string | undefined {
  return notification.channel === 'email' ? member.email : member.phone;
}

export function notificationLink(initiativeId: string): string {
  const base = (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/#initiative=${encodeURIComponent(initiativeId)}` : '';
}

function messageWithLink(notification: Notification): string {
  const link = notificationLink(notification.initiativeId);
  return link ? `${notification.body}\n\nOpen the initiative: ${link}` : notification.body;
}

async function sendEmail(member: Member, notification: Notification): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!key || !from) return { status: 'failed', error: 'Email provider is not configured.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [member.email],
      subject: notification.subject,
      text: messageWithLink(notification)
    })
  });
  if (!response.ok) return { status: 'failed', error: `Email provider returned ${response.status}.` };
  return { status: 'sent' };
}

async function sendSms(member: Member, notification: Notification): Promise<DeliveryResult> {
  if (!member.phone) return { status: 'skipped', error: 'No phone number is configured.' };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { status: 'failed', error: 'SMS provider is not configured.' };
  const body = new URLSearchParams({
    To: member.phone,
    From: from,
    Body: messageWithLink(notification)
  });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!response.ok) return { status: 'failed', error: `SMS provider returned ${response.status}.` };
  return { status: 'sent' };
}

export async function deliverNotification(member: Member, notification: Notification): Promise<DeliveryResult> {
  if (process.env.NOTIFICATIONS_DISABLED === 'true') {
    return { status: 'skipped', error: 'Notifications are disabled in this environment.' };
  }
  try {
    return notification.channel === 'email'
      ? await sendEmail(member, notification)
      : await sendSms(member, notification);
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 180) : 'Notification delivery failed.'
    };
  }
}
