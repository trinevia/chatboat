/**
 * WEB_ORIGIN may list several comma-separated addresses, e.g. the Vercel site and
 * localhost. All are trusted for sign-in and CORS; the first is the public address
 * used in links (invitations, digests).
 */
export function webOrigins(): string[] {
  const list = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return list.length ? list : ['http://localhost:3000'];
}

export const publicWebUrl = () => webOrigins()[0];
