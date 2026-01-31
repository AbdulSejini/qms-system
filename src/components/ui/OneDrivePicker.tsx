'use client';

import React, { useState } from 'react';
import {
  Cloud,
  FileText,
  Image as ImageIcon,
  File,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Info
} from 'lucide-react';
import { Button } from './Button';
import { openOneDrivePicker, OneDriveFile, getFileIcon, formatFileSize } from '@/lib/onedrive';

interface OneDrivePickerProps {
  onFilesSelected: (files: OneDriveFile[]) => void;
  selectedFiles?: OneDriveFile[];
  onRemoveFile?: (fileId: string) => void;
  maxFiles?: number;
  language?: 'ar' | 'en';
  disabled?: boolean;
  className?: string;
  showSelectedFiles?: boolean; // Whether to show selected files list (default: true)
}

// File type icons mapping
const FileIconComponent: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'pdf':
      return <FileText className={`${className} text-red-500`} />;
    case 'word':
      return <FileText className={`${className} text-blue-600`} />;
    case 'excel':
      return <FileText className={`${className} text-green-600`} />;
    case 'powerpoint':
      return <FileText className={`${className} text-orange-500`} />;
    case 'image':
      return <ImageIcon className={`${className} text-purple-500`} />;
    default:
      return <File className={`${className} text-gray-500`} />;
  }
};

export const OneDrivePicker: React.FC<OneDrivePickerProps> = ({
  onFilesSelected,
  selectedFiles = [],
  onRemoveFile,
  maxFiles = 5,
  language = 'ar',
  disabled = false,
  className = '',
  showSelectedFiles = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPicker = async () => {
    if (disabled || selectedFiles.length >= maxFiles) return;

    setIsLoading(true);
    setError(null);

    try {
      const files = await openOneDrivePicker({
        multiSelect: maxFiles > 1,
        action: 'share',
      });

      if (files.length > 0) {
        // Limit to remaining slots
        const remainingSlots = maxFiles - selectedFiles.length;
        const filesToAdd = files.slice(0, remainingSlots);
        onFilesSelected(filesToAdd);
      }
    } catch (err: any) {
      console.error('OneDrive picker error:', err);
      setError(
        language === 'ar'
          ? 'فشل في فتح OneDrive. تأكد من تسجيل الدخول.'
          : 'Failed to open OneDrive. Make sure you are signed in.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const texts = {
    ar: {
      selectFromOneDrive: 'اختر من OneDrive',
      loading: 'جاري الفتح...',
      maxFilesReached: `تم الوصول للحد الأقصى (${maxFiles} ملفات)`,
      openInOneDrive: 'فتح في OneDrive',
      remove: 'حذف',
      attachedFiles: 'الملفات المرفقة',
      noClientId: 'يجب إعداد NEXT_PUBLIC_ONEDRIVE_CLIENT_ID',
      sharingNotice: 'تأكد من مشاركة الملف مع جميع موظفي saudicable.com ليتمكن الجميع من الاطلاع عليه',
    },
    en: {
      selectFromOneDrive: 'Select from OneDrive',
      loading: 'Opening...',
      maxFilesReached: `Maximum files reached (${maxFiles})`,
      openInOneDrive: 'Open in OneDrive',
      remove: 'Remove',
      attachedFiles: 'Attached Files',
      noClientId: 'NEXT_PUBLIC_ONEDRIVE_CLIENT_ID must be configured',
      sharingNotice: 'Make sure to share the file with all saudicable.com employees so everyone can access it',
    },
  };

  const t = texts[language];
  const isMaxReached = selectedFiles.length >= maxFiles;

  // Check if OneDrive is configured
  const isConfigured = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ONEDRIVE_CLIENT_ID;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Sharing Notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {t.sharingNotice}
        </p>
      </div>

      {/* OneDrive Button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleOpenPicker}
          disabled={disabled || isLoading || isMaxReached}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4 text-blue-500" />
          )}
          {isLoading ? t.loading : t.selectFromOneDrive}
        </Button>

        {isMaxReached && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {t.maxFilesReached}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration Warning (Development only) */}
      {!isConfigured && process.env.NODE_ENV === 'development' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{t.noClientId}</span>
        </div>
      )}

      {/* Selected Files List */}
      {showSelectedFiles && selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground-secondary)]">
            {t.attachedFiles} ({selectedFiles.length}/{maxFiles})
          </p>
          <div className="space-y-2">
            {selectedFiles.map((file) => {
              const fileType = getFileIcon(file.name);
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileIconComponent type={fileType} className="h-5 w-5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-[var(--foreground-secondary)]">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Open in OneDrive */}
                    <a
                      href={file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      title={t.openInOneDrive}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    {/* Remove */}
                    {onRemoveFile && (
                      <button
                        type="button"
                        onClick={() => onRemoveFile(file.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--foreground-secondary)] hover:text-red-500"
                        title={t.remove}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OneDrivePicker;
