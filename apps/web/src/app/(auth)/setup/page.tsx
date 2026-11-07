import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { SetupWizard } from '@/components/auth/setup-wizard';

export default function Page() {
  return (
    <AuthCard title='Set up Chatboat' subtitle='Create the admin account for your company. This only happens once.'>
      <Suspense>
        <SetupWizard />
      </Suspense>
    </AuthCard>
  );
}
