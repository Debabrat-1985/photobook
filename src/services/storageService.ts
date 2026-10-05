export interface UploadResult {
  success: boolean;
  public_url: string;
  r2_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage: 'cloudflare_r2' | 'local_fallback' | 'memory_fallback' | 'local_storage';
  error?: string;
}

export const StorageService = {
  MAX_WIDTH: 1600,
  QUALITY: 0.82,

  async compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read photo file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > StorageService.MAX_WIDTH) {
            height = Math.round((height * StorageService.MAX_WIDTH) / width);
            width = StorageService.MAX_WIDTH;
          } else if (height > StorageService.MAX_WIDTH) {
            width = Math.round((width * StorageService.MAX_WIDTH) / height);
            height = StorageService.MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Render with smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Prefer WebP if supported, fallback to JPEG
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/webp', StorageService.QUALITY);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', StorageService.QUALITY);
            }
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', StorageService.QUALITY);
          }
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  },

  async uploadPhoto(file: File, userId: string = 'anon', bookId: string = 'temp'): Promise<UploadResult> {
    try {
      const base64Data = await this.compressImage(file);

      // Call our secure backend upload endpoint
      const response = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64: base64Data,
          fileName: file.name,
          mimeType: base64Data.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
          userId,
          bookId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const result: UploadResult = await response.json();
      return result;
    } catch (err: any) {
      console.warn('Backend R2 upload failed, using local offline fallback:', err);
      // Fallback: create base64 preview so user never loses their uploaded photo
      const base64Fallback = await this.compressImage(file);
      return {
        success: true,
        public_url: base64Fallback,
        r2_key: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'image/jpeg',
        storage: 'memory_fallback',
      };
    }
  },

  async deletePhoto(r2Key: string): Promise<boolean> {
    if (!r2Key || r2Key.startsWith('offline-')) return true;

    try {
      const response = await fetch('/api/r2/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key }),
      });
      return response.ok;
    } catch (err) {
      console.warn('R2 delete request failed:', err);
      return false;
    }
  },
};
