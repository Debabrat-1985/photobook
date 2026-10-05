import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// ==========================================
// 1. Firebase Configuration from .env.example
// ==========================================
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAauzPze1BE-LnuTUCR8AUUU7RS1y2wBHQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "edurunner-saas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "edurunner-saas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "edurunner-saas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "537016048374",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:537016048374:web:137ada1ecd837fcd342ad7",
};

// ==========================================
// 2. Firebase App & Auth SDK Initialization
// ==========================================
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Guarantee session state persistence across browser refreshes & mobile tabs
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase setPersistence notice:', err);
});

const LOCAL_USER_KEY = 'photobook_local_user';

// ==========================================
// 3. AuthService Implementation
// ==========================================
export const AuthService = {
  /**
   * Retrieves the currently authenticated user from Firebase Auth & Firestore profile.
   */
  async getCurrentUser() {
    const user = auth.currentUser;
    if (!user) {
      const local = localStorage.getItem(LOCAL_USER_KEY);
      return local ? JSON.parse(local) : null;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        return {
          id: user.uid,
          email: user.email || '',
          full_name: data.full_name || user.displayName || 'Book Creator',
          avatar_url: data.avatar_url || user.photoURL || '',
          plan: data.plan || 'free',
          role: data.role || 'user',
        };
      } else {
        // Create initial profile in Firestore
        const newProfile = {
          id: user.uid,
          email: user.email || '',
          full_name: user.displayName || user.email?.split('@')[0] || 'Book Creator',
          avatar_url: user.photoURL || '',
          plan: 'free',
          role: 'user',
        };
        await setDoc(userDocRef, {
          ...newProfile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return newProfile;
      }
    } catch (error) {
      console.warn('Failed to fetch user profile from Firestore:', error);
      return {
        id: user.uid,
        email: user.email || '',
        full_name: user.displayName || 'Book Creator',
        avatar_url: user.photoURL || '',
        plan: 'free',
        role: 'user',
      };
    }
  },

  /**
   * Handles user signup using Firebase Auth createUserWithEmailAndPassword.
   */
  async signUp(fullName, email, password) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (cred.user) {
        await fbUpdateProfile(cred.user, { displayName: fullName });

        const profile = {
          id: cred.user.uid,
          email: cred.user.email || email,
          full_name: fullName,
          plan: 'free',
          role: 'user',
        };

        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            ...profile,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Firestore profile write notice:', e);
        }

        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
        return { success: true, user: profile };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err) {
      console.error('Sign up error:', err);
      let errorMsg = err.message || 'Signup failed';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      }
      return { success: false, error: errorMsg, code: err.code };
    }
  },

  /**
   * Handles user login using Firebase Auth signInWithEmailAndPassword.
   */
  async signIn(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user) {
        const profile = await this.getCurrentUser();
        if (profile) {
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          return { success: true, user: profile };
        }
      }
      return { success: false, error: 'Invalid login response' };
    } catch (err) {
      console.error('Sign in error:', err);
      let msg = err.message || 'Invalid email or password';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No user found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      return { success: false, error: msg, code: err.code };
    }
  },

  /**
   * Handles 1-click Google Sign-In using Firebase Auth signInWithPopup.
   */
  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      if (cred.user) {
        const profile = await this.getCurrentUser();
        if (profile) {
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          return { success: true, user: profile };
        }
      }
      return { success: false, error: 'Google sign-in cancelled' };
    } catch (err) {
      console.error('Google sign in error:', err);
      let errorMsg = err.message || 'Google sign in failed';
      if (err.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        errorMsg = `The domain "${hostname}" is not authorized for Google OAuth in your Firebase project. Please add "${hostname}" to Firebase Console -> Authentication -> Settings -> Authorized domains, or use Email & Password sign-in!`;
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'Sign-in window was closed before completing.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMsg = 'Sign-in popup was blocked by browser. Please allow popups for this site.';
      }
      return { success: false, error: errorMsg, code: err.code };
    }
  },

  /**
   * Sends password reset email using Firebase Auth.
   */
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'Password reset link sent to your email.' };
    } catch (err) {
      console.error('Password reset error:', err);
      return { success: false, message: err.message || 'Reset password failed', error: err.message };
    }
  },

  /**
   * Signs the user out from Firebase Auth and clears local session.
   */
  async signOut() {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    localStorage.removeItem(LOCAL_USER_KEY);
  },

  /**
   * Updates user profile in Firestore.
   */
  async updateProfile(updates) {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      const updated = await this.getCurrentUser();
      if (updated) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
      }
      return updated;
    } catch (e) {
      console.warn('Profile update notice:', e);
      return null;
    }
  },

  /**
   * Listens to Firebase Auth session state changes with onAuthStateChanged.
   * Ensures session persists across page reloads and tab navigations.
   */
  onAuthStateChange(callback) {
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const user = await AuthService.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  },
};
