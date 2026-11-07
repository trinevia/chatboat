'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardView } from '@/components/dashboard/dashboard-view';

function Inner() {
  const { id } = useParams<{ id: string }>();
  return <DashboardView id={Number(id)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className='p-8 text-sm text-muted'>Loading dashboard…</div>}>
      <Inner />
    </Suspense>
  );
}
