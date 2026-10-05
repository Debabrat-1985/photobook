import { BookService, MemoryBook } from './bookService.js';
import { StorageService } from './storageService.js';
import { AnalyticsService } from './analyticsService.js';

const MIGRATION_DONE_KEY = 'photobook_migration_completed_v1';
const LEGACY_STORAGE_KEY = 'memorable_photobook_system';

export interface MigrationStatus {
  hasLegacyData: boolean;
  booksCount: number;
  isCompleted: boolean;
}

export const MigrationService = {
  checkStatus(): MigrationStatus {
    const isCompleted = localStorage.getItem(MIGRATION_DONE_KEY) === 'true';
    if (isCompleted) {
      return { hasLegacyData: false, booksCount: 0, isCompleted: true };
    }

    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return { hasLegacyData: false, booksCount: 0, isCompleted: false };

      const parsed = JSON.parse(raw);
      if (parsed.books && Array.isArray(parsed.books) && parsed.books.length > 0) {
        // Check if any book has base64 images that haven't been migrated to R2 or has no user_id
        const needsMigration = parsed.books.some(
          (b: any) =>
            !b.user_id ||
            (b.cover?.image && b.cover.image.startsWith('data:image')) ||
            b.pages?.some((p: any) => p.image && p.image.startsWith('data:image'))
        );

        return {
          hasLegacyData: needsMigration,
          booksCount: parsed.books.length,
          isCompleted: false,
        };
      }
    } catch (e) {
      console.warn('Migration status check error:', e);
    }

    return { hasLegacyData: false, booksCount: 0, isCompleted: false };
  },

  dismissMigration(): void {
    localStorage.setItem(MIGRATION_DONE_KEY, 'dismissed');
  },

  async migrateToCloud(
    userId: string,
    onProgress?: (current: number, total: number, statusText: string) => void
  ): Promise<{ success: boolean; migratedCount: number; error?: string }> {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return { success: true, migratedCount: 0 };

      const parsed = JSON.parse(raw);
      const books: MemoryBook[] = parsed.books || [];
      if (!books.length) return { success: true, migratedCount: 0 };

      let migratedCount = 0;
      const totalBooks = books.length;

      for (let i = 0; i < totalBooks; i++) {
        const book = books[i];
        onProgress?.(i + 1, totalBooks, `Migrating "${book.cover.title || 'Memory Book'}"...`);

        // If cover is base64, convert and upload to R2
        if (book.cover.image && book.cover.image.startsWith('data:image')) {
          try {
            const blob = await (await fetch(book.cover.image)).blob();
            const file = new File([blob], `cover-${book.id || 'book'}.jpg`, { type: 'image/jpeg' });
            const uploadRes = await StorageService.uploadPhoto(file, userId, book.id);
            if (uploadRes.success) {
              book.cover.image = uploadRes.public_url;
              book.cover.image_key = uploadRes.r2_key;
            }
          } catch (e) {
            console.warn('Cover upload during migration failed, preserving base64:', e);
          }
        }

        // Migrate pages
        for (let pIdx = 0; pIdx < book.pages.length; pIdx++) {
          const page = book.pages[pIdx];
          if (page.image && page.image.startsWith('data:image')) {
            try {
              const blob = await (await fetch(page.image)).blob();
              const file = new File([blob], `page-${pIdx + 1}.jpg`, { type: 'image/jpeg' });
              const uploadRes = await StorageService.uploadPhoto(file, userId, book.id);
              if (uploadRes.success) {
                page.image = uploadRes.public_url;
                page.image_url = uploadRes.public_url;
                page.image_key = uploadRes.r2_key;
              }
            } catch (e) {
              console.warn(`Page ${pIdx + 1} upload failed during migration:`, e);
            }
          }
        }

        // Save to Supabase and update local
        book.user_id = userId;
        await BookService.saveBook(book, userId);
        migratedCount++;
      }

      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
      AnalyticsService.track('legacy_migration_completed', { migrated_books: migratedCount }, userId);

      return { success: true, migratedCount };
    } catch (err: any) {
      console.error('Migration failed:', err);
      return { success: false, migratedCount: 0, error: err.message };
    }
  },
};
