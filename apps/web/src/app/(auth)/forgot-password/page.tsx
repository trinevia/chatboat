import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forms';

export default function Page() {
  return (
    <AuthCard title="Reset your password" subtitle="We will email you a reset link.">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
