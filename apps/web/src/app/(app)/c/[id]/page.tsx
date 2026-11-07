'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ConversationLoader } from '@/components/chat/conversation';

function Inner() {
  const { id } = useParams<{ id: string }>();
  return <ConversationLoader chatId={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className='p-8 text-sm text-muted'>Loading conversation…</div>}>
      <Inner />
    </Suspense>
  );
}
