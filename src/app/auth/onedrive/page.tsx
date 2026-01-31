'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * OneDrive OAuth Redirect Page
 * This page handles the OAuth redirect from Microsoft OneDrive
 * It will automatically close after processing the authentication
 */
export default function OneDriveAuthPage() {
  useEffect(() => {
    // The OneDrive SDK handles the response automatically
    // This page just needs to exist as a valid redirect target

    // Check if this is a popup window
    if (window.opener) {
      // This is handled by OneDrive SDK automatically
      // The popup will close itself
    } else {
      // If not a popup (direct navigation), redirect to home
      const timer = setTimeout(() => {
        window.location.href = '/';
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
        <p className="text-[var(--foreground-secondary)]">
          جاري معالجة تسجيل الدخول...
        </p>
        <p className="text-sm text-[var(--foreground-secondary)]">
          Processing authentication...
        </p>
      </div>
    </div>
  );
}
