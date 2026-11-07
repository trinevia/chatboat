import { redirect } from 'next/navigation';

// Accounts are created by invitation only (or by the setup wizard on a new install).
export default function Page() {
  redirect('/login');
}
