import { eq } from 'drizzle-orm';
import { db, schema } from '@chatboat/db';

const { setting } = schema;

export interface Branding {
  companyName: string;
  /** data: URL of a small logo image, or null for the default mark. */
  logo: string | null;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(setting).where(eq(setting.key, key));
  return (row?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  await db
    .insert(setting)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date() } });
}

export async function getBranding(): Promise<Branding> {
  return (await getSetting<Branding>('branding')) ?? { companyName: 'Chatboat', logo: null };
}
