'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isRTL } = useLanguage();

  return (
    <div className={cn('flex min-h-screen bg-[var(--background)]', isRTL && 'flex-row-reverse')}>
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header onMobileMenuClick={() => setMobileMenuOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
