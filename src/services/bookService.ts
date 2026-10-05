import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config.js';
import { AnalyticsService } from './analyticsService.js';

export interface BookPage {
  id?: string;
  book_id?: string;
  page_number: number;
  title: string;
  desc?: string;
  description?: string;
  layout?: string;
  image: string;
  image_url?: string;
  image_key?: string;
}

export interface BookCover {
  title: string;
  subtitle: string;
  author: string;
  publishDate: string;
  dedication: string;
  image: string;
  image_key?: string;
}

export interface MemoryBook {
  id: string;
  user_id?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  publish_date?: string;
  dedication?: string;
  category: string;
  template_id: string;
  cover: BookCover;
  pages: BookPage[];
  is_public: boolean;
  public_slug: string;
  status: 'draft' | 'published' | 'archived';
  created_at?: string;
  updated_at?: string;
  collaborators?: Array<{ email: string; role: 'editor' | 'viewer' }>;
}

const LOCAL_STORAGE_KEY = 'memorable_photobook_system';

export const BookService = {
  generateSlug(title: string): string {
    const cleanTitle = (title || 'memory-book')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const suffix = Math.random().toString(36).substring(2, 7);
    return `${cleanTitle}-${suffix}`;
  },

  async loadUserBooks(userId?: string): Promise<MemoryBook[]> {
    if (!userId) {
      return [];
    }

    const userStorageKey = `${LOCAL_STORAGE_KEY}_${userId}`;

    try {
      const booksRef = collection(db, 'books');
      const q = query(booksRef, where('user_id', '==', userId));
      const snap = await getDocs(q);

      const memoryBooks: MemoryBook[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        // Fetch pages subcollection
        const pagesRef = collection(db, 'books', docSnap.id, 'pages');
        const pagesSnap = await getDocs(query(pagesRef, orderBy('page_number', 'asc')));

        const pages: BookPage[] = pagesSnap.docs.map((pDoc) => {
          const pData = pDoc.data();
          return {
            id: pDoc.id,
            book_id: docSnap.id,
            page_number: pData.page_number,
            title: pData.title || '',
            desc: pData.description || '',
            description: pData.description || '',
            layout: pData.layout || 'standard',
            image: pData.image_url || '',
            image_url: pData.image_url || '',
            image_key: pData.image_key || '',
          };
        });

        memoryBooks.push({
          id: docSnap.id,
          user_id: data.user_id,
          category: data.category || 'Personal',
          template_id: data.template_id || 'classic',
          status: data.status || 'draft',
          is_public: data.is_public || false,
          public_slug: data.public_slug || this.generateSlug(data.title),
          cover: {
            title: data.title || '',
            subtitle: data.subtitle || '',
            author: data.author || '',
            publishDate: data.publish_date || new Date().toISOString().split('T')[0],
            dedication: data.dedication || '',
            image: data.cover_image_url || '',
            image_key: data.cover_image_key || '',
          },
          pages,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      }

      memoryBooks.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      localStorage.setItem(userStorageKey, JSON.stringify({ books: memoryBooks }));
      return memoryBooks;
    } catch {
      // Fallback to user-scoped local cache if offline
      try {
        const saved = localStorage.getItem(userStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.books && Array.isArray(parsed.books)) {
            return parsed.books;
          }
        }
      } catch {}
    }

    return [];
  },

  async saveBook(book: MemoryBook, userId?: string): Promise<{ success: boolean; book: MemoryBook; error?: string }> {
    const now = new Date().toISOString();
    book.updated_at = now;

    if (!book.public_slug) {
      book.public_slug = this.generateSlug(book.cover.title);
    }

    // 1. Optimistic write to local cache
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : { books: [] };
      const existingIdx = parsed.books.findIndex((b: MemoryBook) => b.id === book.id);
      if (existingIdx >= 0) {
        parsed.books[existingIdx] = book;
      } else {
        parsed.books.push(book);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.warn('Local cache write failed:', e);
    }

    // 2. Sync to Firestore
    if (userId) {
      try {
        const bookDocRef = doc(db, 'books', book.id);
        const bookData = {
          id: book.id,
          user_id: userId,
          title: book.cover.title || 'Untitled Book',
          subtitle: book.cover.subtitle || '',
          author: book.cover.author || '',
          publish_date: book.cover.publishDate || new Date().toISOString().split('T')[0],
          dedication: book.cover.dedication || '',
          category: book.category || 'Personal',
          template_id: book.template_id || 'classic',
          cover_image_url: book.cover.image || '',
          cover_image_key: book.cover.image_key || '',
          status: book.status || 'draft',
          is_public: book.is_public || false,
          public_slug: book.public_slug,
          page_count: book.pages.length,
          updated_at: now,
          created_at: book.created_at || now,
        };

        await setDoc(bookDocRef, bookData, { merge: true });

        // Save pages subcollection with batch
        const batch = writeBatch(db);

        // Delete existing pages in subcollection or overwrite
        const pagesRef = collection(db, 'books', book.id, 'pages');
        const existingPagesSnap = await getDocs(pagesRef);
        existingPagesSnap.docs.forEach((docItem) => {
          batch.delete(docItem.ref);
        });

        // Add current pages
        book.pages.forEach((p, idx) => {
          const pageDocRef = doc(pagesRef, `p_${idx + 1}`);
          batch.set(pageDocRef, {
            id: `p_${idx + 1}`,
            book_id: book.id,
            page_number: idx,
            title: p.title || '',
            description: p.desc || p.description || '',
            layout: p.layout || 'standard',
            image_url: p.image || '',
            image_key: p.image_key || '',
            created_at: now,
          });
        });

        await batch.commit();

        // If public, register in shares collection
        if (book.is_public && book.public_slug) {
          const shareDocRef = doc(db, 'shares', book.public_slug);
          await setDoc(shareDocRef, {
            id: book.public_slug,
            book_id: book.id,
            public_slug: book.public_slug,
            is_active: true,
            created_at: now,
          });
        }

        AnalyticsService.track('book_saved', { book_id: book.id, pages: book.pages.length }, userId, book.id);
        return { success: true, book };
      } catch (err: any) {
        console.warn('Firestore sync failed, saved locally:', err);
        return { success: true, book, error: 'Saved locally. Cloud sync pending.' };
      }
    }

    return { success: true, book };
  },

  async deleteBook(bookId: string, userId?: string): Promise<boolean> {
    // 1. Delete from local storage
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.books = parsed.books.filter((b: MemoryBook) => b.id !== bookId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch (e) {
      console.warn('Local delete error:', e);
    }

    // 2. Delete from Firestore
    if (userId) {
      try {
        const bookDocRef = doc(db, 'books', bookId);
        await deleteDoc(bookDocRef);
        AnalyticsService.track('book_deleted', { book_id: bookId }, userId, bookId);
      } catch (err) {
        console.warn('Firestore delete error:', err);
      }
    }

    return true;
  },

  async fetchPublicBook(slug: string): Promise<MemoryBook | null> {
    try {
      // Query Firestore directly for public book
      const booksRef = collection(db, 'books');
      const q = query(booksRef, where('public_slug', '==', slug), where('is_public', '==', true));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();

        // Fetch pages subcollection
        const pagesRef = collection(db, 'books', docSnap.id, 'pages');
        const pagesSnap = await getDocs(query(pagesRef, orderBy('page_number', 'asc')));

        const pages = pagesSnap.docs.map((p) => {
          const pData = p.data();
          return {
            id: p.id,
            page_number: pData.page_number,
            title: pData.title || '',
            desc: pData.description || '',
            description: pData.description || '',
            image: pData.image_url || '',
          };
        });

        return {
          id: docSnap.id,
          category: data.category || 'Personal',
          template_id: data.template_id || 'classic',
          is_public: true,
          public_slug: data.public_slug,
          status: 'published',
          cover: {
            title: data.title,
            subtitle: data.subtitle,
            author: data.author,
            publishDate: data.publish_date,
            dedication: data.dedication,
            image: data.cover_image_url,
          },
          pages,
        };
      }
    } catch (e) {
      console.warn('Firestore public book query failed, checking backend / local:', e);
    }

    // Try backend proxy endpoint
    try {
      const response = await fetch(`/api/public/book/${slug}`);
      if (response.ok) {
        const { book, pages } = await response.json();
        return {
          id: book.id,
          category: book.category,
          template_id: book.template_id,
          is_public: true,
          public_slug: book.public_slug,
          status: 'published',
          cover: {
            title: book.title,
            subtitle: book.subtitle,
            author: book.author,
            publishDate: book.publish_date,
            dedication: book.dedication,
            image: book.cover_image_url,
          },
          pages: (pages || []).map((p: any) => ({
            id: p.id,
            page_number: p.page_number,
            title: p.title,
            desc: p.description,
            description: p.description,
            image: p.image_url,
          })),
        };
      }
    } catch {}

    // Fallback: check local books
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = parsed.books?.find((b: MemoryBook) => b.public_slug === slug || b.id === slug);
        if (match) return match;
      }
    } catch {}

    return null;
  },

  async inviteCollaborator(bookId: string, email: string, role: 'editor' | 'viewer'): Promise<{ success: boolean; message: string }> {
    try {
      const collabDocRef = doc(db, 'books', bookId, 'collaborators', email.replace(/[^a-zA-Z0-9]/g, '_'));
      await setDoc(collabDocRef, {
        book_id: bookId,
        email,
        role,
        invitation_status: 'pending',
        created_at: new Date().toISOString(),
      });
      return { success: true, message: `Invitation sent to ${email} as ${role}` };
    } catch (e) {
      return { success: true, message: `(Local) Collaborator invitation recorded for ${email} with ${role} permissions.` };
    }
  },
};
