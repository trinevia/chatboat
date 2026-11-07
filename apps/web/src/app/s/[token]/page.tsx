'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { SharedView } from '@/components/share/shared-view';

function Inner() {
  const { token } = useParams<{ token: string }>();
  return <SharedView token={token} />;
}

export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
