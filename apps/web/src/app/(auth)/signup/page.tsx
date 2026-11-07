import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/forms';

export default function Page() {
  return (
    <AuthCard title="Create your account" subtitle="Get charts from your sales and finance data in seconds.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
