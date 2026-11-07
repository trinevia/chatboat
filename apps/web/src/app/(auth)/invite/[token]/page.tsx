'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { AcceptInvite } from '@/components/auth/accept-invite';

function Inner() {
  const { token } = useParams<{ token: string }>();
  return <AcceptInvite token={token} />;
}

export default function Page() {
  return (
    <AuthCard title='You’re invited' subtitle='Create your account to start asking questions about your company’s data.'>
      <Suspense>
        <Inner />
      </Suspense>
    </AuthCard>
  );
}
