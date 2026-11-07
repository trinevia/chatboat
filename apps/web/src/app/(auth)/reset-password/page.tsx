import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/forms';

export default function Page() {
  return (
    <AuthCard title="Choose a new password" subtitle="Enter a new password for your account.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
