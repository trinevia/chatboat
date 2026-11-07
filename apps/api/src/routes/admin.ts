import { zValidator } from '@hono/zod-validator';
import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, gte, isNull, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import { brandingInput, inviteInput, memberPatch, type Member, type PendingInvite } from '@chatboat/shared';
import { requireAdmin, requireUser, type AppEnv } from '../context';
import { emailConfigured, sendEmail } from '../digest/email';
import { getBranding, setSetting } from '../settings';

const { user, session, invitation, aiUsage } = schema;
const INVITE_DAYS = 7;
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

async function adminCount() {
  const [{ n }] = await db.select({ n: count() }).from(user).where(eq(user.accessRole, 'admin'));
  return n;
}

async function sendInviteEmail(to: string, token: string, inviter: string) {
  const { companyName } = await getBranding();
  const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/invite/${token}`;
  await sendEmail({
    to,
    subject: companyName === 'Chatboat' ? `${inviter} invited you to Chatboat` : `${inviter} invited you to ${companyName} on Chatboat`,
    text: `${inviter} invited you to ask questions about ${companyName}'s data on Chatboat.\n\nAccept: ${link}\n\nThe link expires in ${INVITE_DAYS} days.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16181d">
      <h1 style="font-size:20px">Join ${esc(companyName)} on Chatboat</h1>
      <p style="font-size:14px;line-height:1.5">${esc(inviter)} invited you to ask questions about ${esc(companyName)}'s data in plain English and get charts back.</p>
      <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Accept invitation</a>
      <p style="font-size:12px;color:#6b7280;margin-top:24px">The link expires in ${INVITE_DAYS} days. If you weren't expecting this, you can ignore it.</p>
    </div>`,
    images: [],
  });
  return link;
}

/** Admin-only: team members, invitations and branding for this install. */
export const adminRoutes = new Hono<AppEnv>()
  .use('/admin/*', requireUser, requireAdmin)

  .get('/admin/members', async c => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const users = await db.select().from(user).orderBy(user.createdAt);
    const usage = await db
      .select({ userId: aiUsage.userId, n: count() })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, monthStart))
      .groupBy(aiUsage.userId);
    const byUser = new Map(usage.map(u => [u.userId, u.n]));
    const members: Member[] = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      accessRole: u.accessRole,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      questionsThisMonth: byUser.get(u.id) ?? 0,
    }));
    const invites = await db
      .select()
      .from(invitation)
      .where(and(isNull(invitation.acceptedAt), gt(invitation.expiresAt, new Date())))
      .orderBy(desc(invitation.createdAt));
    const pending: PendingInvite[] = invites.map(i => ({
      token: i.token,
      email: i.email,
      accessRole: i.accessRole,
      role: i.businessRole,
      expiresAt: i.expiresAt.toISOString(),
    }));
    return c.json({ members, pending, emailConfigured });
  })

  .post('/admin/invitations', zValidator('json', inviteInput), async c => {
    const input = c.req.valid('json');
    const email = input.email.trim().toLowerCase();
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) return c.json({ error: 'That person already has an account.' }, 409);
    // Re-inviting replaces any earlier open invitation for the same email.
    await db.delete(invitation).where(and(eq(invitation.email, email), isNull(invitation.acceptedAt)));
    const token = randomBytes(24).toString('base64url');
    await db.insert(invitation).values({
      token,
      email,
      accessRole: input.accessRole,
      businessRole: input.role,
      invitedBy: c.get('user').id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5),
    });
    let emailed = true;
    let link: string;
    try {
      link = await sendInviteEmail(email, token, c.get('user').name);
    } catch (e) {
      // Still return the link so the admin can share it another way.
      emailed = false;
      link = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/invite/${token}`;
      console.error('[admin] invite email failed:', (e as Error).message);
    }
    return c.json({ link, emailed }, 201);
  })

  .delete('/admin/invitations/:token', async c => {
    await db.delete(invitation).where(and(eq(invitation.token, c.req.param('token')), isNull(invitation.acceptedAt)));
    return c.body(null, 204);
  })

  .patch('/admin/members/:id', zValidator('json', memberPatch), async c => {
    const id = c.req.param('id');
    const patch = c.req.valid('json');
    const [target] = await db.select().from(user).where(eq(user.id, id));
    if (!target) return c.json({ error: 'Not found' }, 404);
    if (patch.accessRole === 'member' && target.accessRole === 'admin' && (await adminCount()) <= 1) {
      return c.json({ error: 'There must be at least one admin.' }, 400);
    }
    await db.update(user).set(patch).where(eq(user.id, id));
    return c.body(null, 204);
  })

  // Removes the person and everything they own (chats, dashboards, digests).
  .delete('/admin/members/:id', async c => {
    const id = c.req.param('id');
    if (id === c.get('user').id) return c.json({ error: "You can't remove yourself." }, 400);
    const [target] = await db.select().from(user).where(eq(user.id, id));
    if (!target) return c.json({ error: 'Not found' }, 404);
    if (target.accessRole === 'admin' && (await adminCount()) <= 1) {
      return c.json({ error: 'There must be at least one admin.' }, 400);
    }
    await db.delete(session).where(eq(session.userId, id));
    await db.delete(user).where(and(eq(user.id, id), ne(user.id, c.get('user').id)));
    return c.body(null, 204);
  })

  .get('/admin/branding', async c => c.json(await getBranding()))
  .put('/admin/branding', zValidator('json', brandingInput), async c => {
    await setSetting('branding', c.req.valid('json'));
    return c.json(await getBranding());
  });
