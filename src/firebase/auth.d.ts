import { Auth, User } from 'firebase/auth';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  plan: 'free' | 'pro' | 'premium' | 'lifetime';
  role: 'user' | 'admin';
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  code?: string;
}

export declare const firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export declare const app: FirebaseApp;
export declare const auth: Auth;
export declare const db: Firestore;

export declare const AuthService: {
  getCurrentUser(): Promise<UserProfile | null>;
  signUp(fullName: string, email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  resetPassword(email: string): Promise<{ success: boolean; message: string; error?: string }>;
  signOut(): Promise<void>;
  updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null>;
  onAuthStateChange(callback: (user: UserProfile | null) => void): void;
};
