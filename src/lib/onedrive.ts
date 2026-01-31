// OneDrive File Picker Integration
// Documentation: https://docs.microsoft.com/en-us/onedrive/developer/controls/file-pickers/

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  lastModified?: string;
}

export interface OneDrivePickerOptions {
  clientId: string;
  action: 'download' | 'share' | 'query';
  multiSelect: boolean;
  viewType?: 'files' | 'folders' | 'all';
  accountSwitchEnabled?: boolean;
  advanced?: {
    redirectUri?: string;
    filter?: string; // e.g., ".pdf,.docx,.xlsx,.jpg,.png"
  };
}

// Default configuration - Replace with your Azure AD App Client ID
const DEFAULT_CLIENT_ID = process.env.NEXT_PUBLIC_ONEDRIVE_CLIENT_ID || '';

/**
 * Opens OneDrive File Picker and returns selected files
 */
export function openOneDrivePicker(options?: Partial<OneDrivePickerOptions>): Promise<OneDriveFile[]> {
  return new Promise((resolve, reject) => {
    // Check if OneDrive SDK is loaded
    if (typeof window === 'undefined') {
      reject(new Error('OneDrive picker can only be used in browser'));
      return;
    }

    const pickerOptions = {
      clientId: options?.clientId || DEFAULT_CLIENT_ID,
      action: options?.action || 'share',
      multiSelect: options?.multiSelect ?? true,
      viewType: options?.viewType || 'files',
      accountSwitchEnabled: options?.accountSwitchEnabled ?? true,
      advanced: {
        redirectUri: options?.advanced?.redirectUri || `${window.location.origin}/auth/onedrive`,
        filter: options?.advanced?.filter || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt',
        ...options?.advanced,
      },
      success: (response: any) => {
        // Transform OneDrive response to our format
        const files: OneDriveFile[] = response.value.map((item: any) => ({
          id: item.id,
          name: item.name,
          size: item.size,
          webUrl: item.webUrl,
          downloadUrl: item['@microsoft.graph.downloadUrl'] || item.webUrl,
          thumbnailUrl: item.thumbnails?.[0]?.large?.url,
          mimeType: item.file?.mimeType,
          lastModified: item.lastModifiedDateTime,
        }));
        resolve(files);
      },
      cancel: () => {
        resolve([]); // Return empty array on cancel
      },
      error: (error: any) => {
        console.error('OneDrive picker error:', error);
        reject(new Error(error.message || 'Failed to open OneDrive picker'));
      },
    };

    // Load and open OneDrive picker
    loadOneDriveSDK()
      .then(() => {
        (window as any).OneDrive.open(pickerOptions);
      })
      .catch(reject);
  });
}

/**
 * Load OneDrive JavaScript SDK dynamically
 */
function loadOneDriveSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).OneDrive) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://js.live.net/v7.2/OneDrive.js';
    script.async = true;

    script.onload = () => {
      // Wait a bit for SDK to initialize
      setTimeout(() => {
        if ((window as any).OneDrive) {
          resolve();
        } else {
          reject(new Error('OneDrive SDK failed to initialize'));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error('Failed to load OneDrive SDK'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Get file icon based on extension/mime type
 */
export function getFileIcon(fileName: string): 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'word';
    case 'xls':
    case 'xlsx':
      return 'excel';
    case 'ppt':
    case 'pptx':
      return 'powerpoint';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
      return 'image';
    default:
      return 'file';
  }
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
