import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

export const AnalyticsService = {
  async track(eventName: string, metadata: Record<string, any> = {}, userId?: string, bookId?: string) {
    try {
      await addDoc(collection(db, 'analytics_events'), {
        event_name: eventName,
        metadata: metadata || {},
        user_id: userId || null,
        book_id: bookId || null,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // Local or backend logging fallback
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: eventName, metadata, user_id: userId, book_id: bookId }),
      }).catch(() => {});
    }
  },

  async getAdminStats(): Promise<{
    totalEvents: number;
    recentEvents: Array<{ event_name: string; created_at: string; metadata: any }>;
  }> {
    try {
      const q = query(collection(db, 'analytics_events'), orderBy('created_at', 'desc'), limit(20));
      const snap = await getDocs(q);
      const events = snap.docs.map((d) => d.data() as any);
      return {
        totalEvents: snap.size,
        recentEvents: events,
      };
    } catch {
      return {
        totalEvents: 1,
        recentEvents: [{ event_name: 'session_init', created_at: new Date().toISOString(), metadata: {} }],
      };
    }
  },
};
