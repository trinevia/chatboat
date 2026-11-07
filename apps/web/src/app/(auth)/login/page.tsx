import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/forms';

export default function Page() {
  return (
    <AuthCard title="Sign in" subtitle="Ask questions about your company data.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
