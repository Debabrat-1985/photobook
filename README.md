# 📖 Memorable Photo Book — Digital Memory Book Platform (SaaS)

A mobile-first, funding-ready Digital Memory Book SaaS built with Vite, TypeScript/Vanilla JS, **Firebase Auth & Firestore**, **Cloudflare R2 Object Storage**, and **Vercel Serverless Architecture**.

---

## 🌟 Key Features

- **3D Page Turn Animation**: Smooth mobile-first 3D book flip physics with touch swipe gestures (left/right) on Android and iOS devices.
- **Firebase Authentication**: Full name registration, secure email/password login, Google 1-click Sign-In, password resets, session persistence, and Firestore user profile synchronization.
- **Cloudflare R2 Object Storage**: Real S3-compatible cloud photo storage via secure server-side signed uploads. Client-side canvas compression ensures low bandwidth and lightning-fast uploads without storing huge base64 strings in Firestore.
- **Cloud Firestore Database**:
  - `users`: User profile documents with subscription plans and quotas.
  - `books`: Complete book metadata, templates, categories, and public slugs.
  - `books/{bookId}/pages`: Ordered subcollections with story text and Cloudflare R2 image keys.
  - `shares`: Public book lookup index.
  - `analytics_events`: First-party usage and investor metrics tracking.
- **10 Data-Driven Themes & Templates**:
  1. *Classic Heritage* (Clean serif typography, balanced margins)
  2. *Modern Elegance* (Minimalist luxury with gold accents)
  3. *Romantic Wedding* (Blush floral vignette & delicate script)
  4. *Joyful Birthday* (Celebratory theme with festive banners)
  5. *Wanderlust Explorer* (Travel passport theme with coordinates)
  6. *Little Miracle* (Baby pastels with milestone dates)
  7. *Family Heritage* (Warm archival tones for reunions)
  8. *Golden Anniversary* (Gold & silver duo-tone aesthetic)
  9. *School & Graduation* (Yearbook editorial styling)
  10. *Tribute & Memorial* (Peaceful monochrome & warm sepia)
- **Public & Private Sharing**:
  - Unique public URLs (`https://yourdomain.com/?share=slug` or `/book/:slug`).
  - Native Web Share API integration (opens native Android/iOS share sheet with WhatsApp, Messages, etc.).
  - 1-click Link copy with toast feedback.
- **Family Collaboration**: Invite collaborators by email as **Editor** (add photos, edit stories) or **Viewer**.
- **Action Center**: Rule-based intelligence alerting users to unfinished draft books, pages without photos, or inactive projects.
- **Search & Categorization**: Real-time search by title/author/category with single-tap category filter pills (Wedding, Birthday, Travel, Family, etc.).
- **SaaS Monetization Model**: Centralized subscription checks (`canCreateBook`, `canAddPage`, `canUseTemplate`, `canExportHD`, `canCollaborate`) supporting Free, Pro, and Studio tiers.
- **High-Resolution Print & PDF**: Browser print stylesheet with print-page-break rules for physical photo book generation.
- **JSON Backup & Restore**: Full JSON project export and restore with schema validation.
- **Legacy Migration Engine**: Automatically detects old browser `localStorage` books, prompts user to move them to their cloud account, and migrates base64 images into Cloudflare R2!
- **Multilingual Support**: English, Hindi (हिन्दी), and Odia (ଓଡ଼ିଆ).
- **Dark & Light Mode**: Seamless theme toggling persisted to localStorage.
- **PWA & Offline Resilience**: Installable on Android and desktop with service worker offline shell and offline warning banner.

---

## 🏗️ Architecture

```
[ Mobile Browser / Android / Tablet / Desktop ]
                       │
             Vite Frontend (SPA)
             (Touch Gestures, 3D CSS)
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
Firebase Auth & Firestore       Vercel / Express Backend
(Profiles, Books, Pages, Rules)   (Uploads to Cloudflare R2)
                                       │
                                       ▼
                                Cloudflare R2
                           (S3-Compatible Storage)
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/photobook-saas.git
cd photobook-saas
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Your Firebase configuration is already embedded into `src/firebase/config.ts`, but you can also configure via `.env`:
```env
# Firebase Credentials (edurunner-saas)
VITE_FIREBASE_API_KEY=AIzaSyAauzPze1BE-LnuTUCR8AUUU7RS1y2wBHQ
VITE_FIREBASE_AUTH_DOMAIN=edurunner-saas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=edurunner-saas
VITE_FIREBASE_STORAGE_BUCKET=edurunner-saas.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=537016048374
VITE_FIREBASE_APP_ID=1:537016048374:web:2837db4a9d180aa7342ad7

# Cloudflare R2 Credentials
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-cloudflare-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-cloudflare-r2-secret-access-key
R2_BUCKET_NAME=photobook-media
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your mobile browser or emulator.

---

## 🔥 Firebase Setup Guide (Steps)

1. **Open Firebase Console**:
   Go to [https://console.firebase.google.com/project/edurunner-saas](https://console.firebase.google.com/project/edurunner-saas).

2. **Enable Authentication Providers**:
   - Go to **Build** -> **Authentication** -> **Sign-in method**.
   - Enable **Email/Password**.
   - (Optional) Enable **Google** provider and save.

3. **Enable Cloud Firestore**:
   - Go to **Build** -> **Firestore Database** -> Click **Create database**.
   - Choose production mode or start in test mode.
   - Select your nearest region (e.g. `asia-south1` or `us-central1`).

4. **Deploy Security Rules**:
   - In Firestore Database, go to the **Rules** tab.
   - Copy the contents of the `firestore.rules` file in this repository and paste it into the editor.
   - Click **Publish**.

---

## ☁️ Cloudflare R2 Setup Guide (Steps)

1. **Open Cloudflare Dashboard**:
   - Log in at [https://dash.cloudflare.com/](https://dash.cloudflare.com/).
   - Click **R2** in the left sidebar.

2. **Create a Bucket**:
   - Click **Create bucket**.
   - Name: `photobook-media` (or your preferred name).
   - Location: Automatic (or closest region).
   - Click **Create Bucket**.

3. **Configure Bucket CORS**:
   - Click on your bucket -> **Settings** tab -> scroll down to **CORS Policy**.
   - Click **Add CORS policy** and paste:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

4. **Enable Public Access / Custom Domain**:
   - In bucket **Settings** -> **Public Access** -> click **Connect Domain** (or enable the free `r2.dev` public subdomain).
   - Set this URL as `R2_PUBLIC_URL` in your `.env`.

5. **Generate S3 API Credentials**:
   - Go back to **R2 Overview** -> Click **Manage R2 API Tokens** on the right side.
   - Click **Create API token**.
   - Permissions: **Object Read & Write**.
   - Bucket: select your bucket (or all buckets).
   - Click **Create API Token**.
   - Copy the following values into your `.env` or Vercel:
     - `Account ID` -> `R2_ACCOUNT_ID`
     - `Access Key ID` -> `R2_ACCESS_KEY_ID`
     - `Secret Access Key` -> `R2_SECRET_ACCESS_KEY`
     - Bucket name -> `R2_BUCKET_NAME`

---

## 🌐 Vercel Deployment

1. Import your project into Vercel.
2. In **Settings -> Environment Variables**, add your R2 and Firebase credentials.
3. Deploy! Vercel runs `npm run build` and uses `vercel.json` for routing `/api/r2/upload` and public books.
