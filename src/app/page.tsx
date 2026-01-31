'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--foreground-secondary)]">جاري التحميل...</p>
      </div>
    </div>
  );
}
