import { zValidator } from '@hono/zod-validator';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import { acceptInviteInput } from '@chatboat/shared';
import { auth, withSignupAllowed } from '../auth';
import { getBranding } from '../settings';

const { invitation, user } = schema;

export async function openInvitation(token: string) {
  const [row] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.token, token), isNull(invitation.acceptedAt), gt(invitation.expiresAt, new Date())));
  return row;
}

/** Public: look at and accept an invitation link. */
export const invitationRoutes = new Hono()
  .get('/invitations/:token', async c => {
    const inv = await openInvitation(c.req.param('token'));
    if (!inv) return c.json({ error: 'This invitation is invalid, expired or already used.' }, 404);
    const { companyName } = await getBranding();
    return c.json({ email: inv.email, companyName });
  })

  .post('/invitations/:token/accept', zValidator('json', acceptInviteInput), async c => {
    const inv = await openInvitation(c.req.param('token'));
    if (!inv) return c.json({ error: 'This invitation is invalid, expired or already used.' }, 404);
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, inv.email));
    if (existing) return c.json({ error: 'An account with this email already exists. Sign in instead.' }, 409);

    const { name, password } = c.req.valid('json');
    const res = await withSignupAllowed(inv.email, () =>
      auth.api.signUpEmail({
        body: { name, email: inv.email, password },
        headers: c.req.raw.headers,
        asResponse: true,
      })
    );
    if (!res.ok) return res;
    await db.update(user).set({ accessRole: inv.accessRole, role: inv.businessRole }).where(eq(user.email, inv.email));
    await db.update(invitation).set({ acceptedAt: new Date() }).where(eq(invitation.token, inv.token));
    return res;
  });
