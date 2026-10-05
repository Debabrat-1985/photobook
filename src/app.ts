import { translations, SupportedLang } from './i18n/translations.js';
import { AuthService, UserProfile } from './firebase/auth.js';
import { BookService, MemoryBook } from './services/bookService.js';
import { StorageService } from './services/storageService.js';
import { SubscriptionService, PlanTier } from './services/subscriptionService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { MigrationService } from './services/migrationService.js';
import { BOOK_TEMPLATES, CATEGORIES, getTemplate } from './templates/templates.js';

export interface AppState {
  books: MemoryBook[];
  activeBookIndex: number;
  currentIndex: number;
  currentView: string;
  theme: 'light' | 'dark';
  lang: SupportedLang;
  isFlipping: boolean;
  user: UserProfile | null;
  searchQuery: string;
  categoryFilter: string;
  sortBy: 'recent' | 'newest' | 'oldest';
  cloudStatus: 'saved' | 'saving' | 'offline' | 'failed';
  touchStartX: number;
  touchStartY: number;
  isPublicViewOnly: boolean;
}

export const App = {
  state: {
    books: [] as MemoryBook[],
    activeBookIndex: -1,
    currentIndex: -1,
    currentView: 'view-home',
    theme: 'light' as 'light' | 'dark',
    lang: 'en' as SupportedLang,
    isFlipping: false,
    user: null as UserProfile | null,
    searchQuery: '',
    categoryFilter: 'All',
    sortBy: 'recent' as 'recent' | 'newest' | 'oldest',
    cloudStatus: 'saved' as 'saved' | 'saving' | 'offline' | 'failed',
    touchStartX: 0,
    touchStartY: 0,
    isPublicViewOnly: false,
  },

  deferredPrompt: null as any,
  saveDebounceTimer: null as any,

  async init() {
    this.initNetworkListeners();
    this.initSwipeGestures();
    this.setupPWA();
    this.bindEvents();

    // Check for direct public share slug in URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareSlug = urlParams.get('share') || this.extractSlugFromPath();

    if (shareSlug) {
      await this.loadPublicBookMode(shareSlug);
      return;
    }

    // Normal app initialization
    this.applyTheme();
    this.updateLanguageUI();
    await this.initAuth();
  },

  extractSlugFromPath(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/book\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  },

  async loadPublicBookMode(slug: string) {
    this.state.isPublicViewOnly = true;
    const publicBook = await BookService.fetchPublicBook(slug);
    if (publicBook) {
      this.state.books = [publicBook];
      this.state.activeBookIndex = 0;
      this.state.currentIndex = -1;
      this.applyTheme();
      this.updateLanguageUI();

      // Show preview only, hide bottom nav
      const bottomNav = document.getElementById('bottom-nav');
      if (bottomNav) bottomNav.style.display = 'none';
      const backBtn = document.getElementById('btn-back');
      if (backBtn) backBtn.style.display = 'none';

      this.switchView('view-preview');
      AnalyticsService.track('public_book_viewed', { slug }, undefined, publicBook.id);
    } else {
      this.showToast('Public memory book was not found or is private.');
      this.state.isPublicViewOnly = false;
      this.init();
    }
  },

  // ==========================================
  // Auth & Session (Native Mobile Gating)
  // ==========================================
  async initAuth() {
    this.state.user = await AuthService.getCurrentUser();

    if (this.state.user) {
      this.updateUserUI();
      await this.loadState();
      this.switchView('view-home');
    } else {
      this.state.books = [];
      this.updateUserUI();
      this.switchView('view-auth-gate');
    }

    AuthService.onAuthStateChange(async (user) => {
      this.state.user = user;
      this.updateUserUI();
      if (user) {
        await this.loadState();
        if (this.state.currentView === 'view-auth-gate') {
          this.switchView('view-home');
        } else {
          this.render();
        }
      } else {
        this.state.books = [];
        this.switchView('view-auth-gate');
      }
    });
  },

  updateUserUI() {
    const userBar = document.getElementById('dashboard-user-bar');
    const headerAvatar = document.getElementById('btn-header-profile');
    const bottomNav = document.getElementById('bottom-nav');

    if (this.state.user) {
      if (headerAvatar) {
        headerAvatar.style.display = 'flex';
        headerAvatar.textContent = (this.state.user.full_name || 'U').charAt(0).toUpperCase();
      }
      if (bottomNav && this.state.currentView !== 'view-auth-gate') {
        bottomNav.style.display = 'flex';
      }
      if (userBar) {
        const planBadge = (this.state.user.plan || 'free').toUpperCase();
        userBar.innerHTML = `
          <div>
            <div class="dashboard-greeting">${this.t('welcome_back')}, ${this.esc(this.state.user.full_name)}!</div>
            <div class="dashboard-sub">${this.esc(this.state.user.email)} · <span class="badge-tag">${planBadge}</span></div>
          </div>
          <button class="header-avatar-btn" onclick="App.openAccountModal()" title="Account Profile">
            ${(this.state.user.full_name || 'U').charAt(0).toUpperCase()}
          </button>
        `;
      }
    } else {
      if (headerAvatar) headerAvatar.style.display = 'none';
      if (bottomNav) bottomNav.style.display = 'none';
      if (userBar) userBar.innerHTML = '';
    }
  },

  // ==========================================
  // Translations & Theming
  // ==========================================
  t(key: string): string {
    const currentDict = translations[this.state.lang] || translations.en;
    return currentDict[key] || translations.en[key] || key;
  },

  toggleLang() {
    if (this.state.lang === 'en') this.state.lang = 'hi';
    else if (this.state.lang === 'hi') this.state.lang = 'or';
    else this.state.lang = 'en';

    localStorage.setItem('photobook_lang', this.state.lang);
    this.updateLanguageUI();
    this.render();
  },

  updateLanguageUI() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
      langBtn.innerText = this.state.lang === 'en' ? 'अ/A' : this.state.lang === 'hi' ? 'ओ/अ' : 'A/अ';
    }
  },

  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    localStorage.setItem('photobook_theme', this.state.theme);
  },

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.textContent = this.state.theme === 'light' ? '🌙' : '☀️';
    }
  },

  // ==========================================
  // Network & Gestures
  // ==========================================
  initNetworkListeners() {
    window.addEventListener('online', () => {
      this.state.cloudStatus = 'saved';
      this.updateCloudStatusUI();
      const banner = document.getElementById('offline-banner');
      if (banner) banner.classList.remove('active');
    });

    window.addEventListener('offline', () => {
      this.state.cloudStatus = 'offline';
      this.updateCloudStatusUI();
      const banner = document.getElementById('offline-banner');
      if (banner) banner.classList.add('active');
    });
  },

  initSwipeGestures() {
    const previewContainer = document.getElementById('view-preview');
    if (!previewContainer) return;

    previewContainer.addEventListener(
      'touchstart',
      (e) => {
        this.state.touchStartX = e.changedTouches[0].screenX;
        this.state.touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true }
    );

    previewContainer.addEventListener(
      'touchend',
      (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - this.state.touchStartX;
        const diffY = touchEndY - this.state.touchStartY;

        // Horizontal swipe detected (diffX > 50px and diffX > diffY)
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) {
            // Swipe Left -> Next Page
            this.changePage(1);
          } else {
            // Swipe Right -> Prev Page
            this.changePage(-1);
          }
        }
      },
      { passive: true }
    );

    // Keyboard arrow navigation
    window.addEventListener('keydown', (e) => {
      if (this.state.currentView === 'view-preview') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') this.changePage(1);
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.changePage(-1);
      }
    });
  },

  setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const banner = document.getElementById('install-banner');
      if (banner) banner.style.display = 'flex';
    });
  },

  installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(() => {
        const banner = document.getElementById('install-banner');
        if (banner) banner.style.display = 'none';
        this.deferredPrompt = null;
      });
    }
  },

  // ==========================================
  // Migration Check
  // ==========================================
  checkMigrationPrompt() {
    const status = MigrationService.checkStatus();
    const banner = document.getElementById('migration-banner');
    if (!banner) return;

    if (status.hasLegacyData && !status.isCompleted) {
      banner.style.display = 'flex';
      const countEl = document.getElementById('migration-book-count');
      if (countEl) countEl.innerText = `${status.booksCount}`;
    } else {
      banner.style.display = 'none';
    }
  },

  async startMigration() {
    if (!this.state.user) {
      this.openAuthModal();
      this.showAlert(this.t('alert'), 'Please sign in first so your books can be attached to your cloud account.');
      return;
    }

    const banner = document.getElementById('migration-banner');
    if (banner) banner.style.display = 'none';

    this.showAlert(this.t('alert'), 'Starting cloud migration. Please wait while photos are uploaded to Cloudflare R2...');

    const result = await MigrationService.migrateToCloud(this.state.user.id);
    this.closeModal();

    if (result.success) {
      this.showAlert(
        this.t('alert'),
        this.t('migration_success').replace('{n}', result.migratedCount.toString())
      );
      await this.loadState();
      this.render();
    } else {
      this.showAlert(this.t('alert'), 'Migration error: ' + result.error);
    }
  },

  dismissMigration() {
    MigrationService.dismissMigration();
    const banner = document.getElementById('migration-banner');
    if (banner) banner.style.display = 'none';
  },

  // ==========================================
  // State & Cloud Sync
  // ==========================================
  async loadState() {
    this.state.theme = (localStorage.getItem('photobook_theme') as any) || 'light';
    this.state.lang = (localStorage.getItem('photobook_lang') as any) || 'en';

    const userId = this.state.user?.id;
    this.state.books = await BookService.loadUserBooks(userId);
    this.state.activeBookIndex = -1;
    this.state.isFlipping = false;
  },

  async saveState() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    this.state.cloudStatus = 'saving';
    this.updateCloudStatusUI();

    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      const res = await BookService.saveBook(activeBook, this.state.user?.id);
      if (res.success) {
        this.state.cloudStatus = 'saved';
      } else {
        this.state.cloudStatus = 'failed';
      }
      this.updateCloudStatusUI();
    }, 600);
  },

  updateCloudStatusUI() {
    const textEl = document.getElementById('cloud-status-text');
    const dotEl = document.getElementById('cloud-status-dot');
    if (!textEl || !dotEl) return;

    dotEl.className = 'status-dot';

    if (this.state.cloudStatus === 'saving') {
      textEl.innerText = this.t('cloud_status_saving');
      dotEl.classList.add('saving');
    } else if (this.state.cloudStatus === 'offline') {
      textEl.innerText = this.t('cloud_status_offline');
      dotEl.classList.add('offline');
    } else if (this.state.cloudStatus === 'failed') {
      textEl.innerText = this.t('cloud_status_failed');
    } else {
      textEl.innerText = this.t('cloud_status_saved');
    }
  },

  getActiveBook(): MemoryBook | undefined {
    return this.state.books[this.state.activeBookIndex];
  },

  // ==========================================
  // Navigation & Flow
  // ==========================================
  bindEvents() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement | null;
        const viewId = target ? target.getAttribute('data-view') : null;
        if (viewId) {
          if (viewId === 'view-preview') this.state.currentIndex = -1;
          this.switchView(viewId);
        }
      });
    });

    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
      fileUpload.addEventListener('change', (e) => this.handleUpload(e));
    }
  },

  handleBack() {
    this.state.activeBookIndex = -1;
    this.switchView('view-home');
  },

  switchView(viewId: string) {
    this.state.isFlipping = false;

    // Enforce auth gate: unauthenticated users can NEVER access book views
    if (!this.state.user && !this.state.isPublicViewOnly) {
      viewId = 'view-auth-gate';
    }

    this.state.currentView = viewId;

    const bottomNav = document.getElementById('bottom-nav');
    const backBtn = document.getElementById('btn-back');

    if (!this.state.user || viewId === 'view-auth-gate') {
      if (bottomNav) bottomNav.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
    } else {
      if (bottomNav) bottomNav.style.display = 'flex';
      if (backBtn) backBtn.style.display = viewId === 'view-home' ? 'none' : 'flex';
    }

    document.querySelectorAll('.nav-item').forEach((i) =>
      i.classList.toggle('active', i.getAttribute('data-view') === viewId)
    );
    document.querySelectorAll('.view-container').forEach((v) =>
      v.classList.toggle('active', v.id === viewId)
    );

    this.render();
  },

  // ==========================================
  // Native Mobile Toast
  // ==========================================
  showToast(message: string) {
    const toast = document.getElementById('mobile-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('active');
    clearTimeout((this as any)._toastTimer);
    (this as any)._toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 2200);
  },

  // ==========================================
  // Native Mobile Auth Gate Handlers
  // ==========================================
  switchGateTab(tab: 'signin' | 'signup' | 'forgot') {
    const signinTab = document.getElementById('gate-tab-signin');
    const signupTab = document.getElementById('gate-tab-signup');
    const signinForm = document.getElementById('gate-form-signin');
    const signupForm = document.getElementById('gate-form-signup');
    const forgotForm = document.getElementById('gate-form-forgot');
    const errBanner = document.getElementById('gate-error-banner');

    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    if (signinTab) signinTab.classList.toggle('active', tab === 'signin');
    if (signupTab) signupTab.classList.toggle('active', tab === 'signup');

    if (signinForm) signinForm.style.display = tab === 'signin' ? 'flex' : 'none';
    if (signupForm) signupForm.style.display = tab === 'signup' ? 'flex' : 'none';
    if (forgotForm) forgotForm.style.display = tab === 'forgot' ? 'flex' : 'none';
  },

  showGateError(msg: string) {
    const errBanner = document.getElementById('gate-error-banner');
    if (errBanner) {
      errBanner.textContent = msg;
      errBanner.style.display = 'block';
    }
  },

  async handleGateSignIn() {
    const email = (document.getElementById('gate-signin-email') as HTMLInputElement)?.value.trim();
    const password = (document.getElementById('gate-signin-password') as HTMLInputElement)?.value;
    const btn = document.getElementById('btn-gate-signin') as HTMLButtonElement;

    if (!email || !password) {
      this.showGateError('Please enter email and password.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Signing In...</span>';
    }

    const res = await AuthService.signIn(email, password);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span>';
    }

    if (res.success && res.user) {
      this.state.user = res.user;
      this.showToast(`Welcome, ${res.user.full_name || 'Friend'}! 👋`);
      await this.loadState();
      this.switchView('view-home');
    } else {
      this.showGateError(res.error || 'Invalid email or password.');
    }
  },

  async handleGateSignUp() {
    const name = (document.getElementById('gate-signup-name') as HTMLInputElement)?.value.trim();
    const email = (document.getElementById('gate-signup-email') as HTMLInputElement)?.value.trim();
    const password = (document.getElementById('gate-signup-password') as HTMLInputElement)?.value;
    const confirm = (document.getElementById('gate-signup-confirm') as HTMLInputElement)?.value;
    const btn = document.getElementById('btn-gate-signup') as HTMLButtonElement;

    if (!name || !email || !password) {
      this.showGateError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      this.showGateError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      this.showGateError('Password must be at least 6 characters.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Creating Account...</span>';
    }

    const res = await AuthService.signUp(name, email, password);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span>';
    }

    if (res.success && res.user) {
      this.state.user = res.user;
      this.showToast('Account created successfully! 🎉');
      await this.loadState();
      this.switchView('view-home');
    } else {
      this.showGateError(res.error || 'Failed to create account.');
    }
  },

  async handleGateForgotPassword() {
    const email = (document.getElementById('gate-forgot-email') as HTMLInputElement)?.value.trim();
    if (!email) {
      this.showGateError('Please enter your email.');
      return;
    }
    const res = await AuthService.resetPassword(email);
    this.showToast(res.message || 'Password reset link sent to your email.');
    this.switchGateTab('signin');
  },

  render() {
    this.updateUserUI();
    if (this.state.currentView === 'view-home') this.renderHome();
    else if (this.state.currentView === 'view-preview') this.renderPreview();
    else if (this.state.currentView === 'view-pages') this.renderPages();
    else if (this.state.currentView === 'view-edit') this.renderEdit();
    else if (this.state.currentView === 'view-share') this.renderShareSettings();
    else if (this.state.currentView === 'view-account') this.renderAccountView();
  },

  // ==========================================
  // Home / Dashboard View
  // ==========================================
  renderHome() {
    this.renderActionCenter();
    this.renderCategoryFilterBar();

    const container = document.getElementById('home-books-list');
    if (!container) return;
    container.innerHTML = '';

    // Filter & search
    let filtered = [...this.state.books];
    if (this.state.categoryFilter !== 'All') {
      filtered = filtered.filter((b) => b.category === this.state.categoryFilter);
    }
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.cover.title.toLowerCase().includes(q) ||
          b.cover.subtitle.toLowerCase().includes(q) ||
          b.cover.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );
    }

    // Sort
    if (this.state.sortBy === 'newest') {
      filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else if (this.state.sortBy === 'oldest') {
      filtered.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    } else {
      // Recent
      filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 40px 20px; color: var(--text-secondary);">
          <div style="font-size:3.5rem; margin-bottom:12px;">📚</div>
          <h2 style="margin-bottom:8px; font-size:1.3rem;">${this.t('no_books')}</h2>
          <p style="font-size:0.9rem; max-width:320px;">${this.t('create_first')}</p>
        </div>
      `;
      return;
    }

    filtered.forEach((book) => {
      const originalIdx = this.state.books.indexOf(book);
      const c = book.cover;
      const tmpl = getTemplate(book.template_id);

      const imgHtml = c.image
        ? `<img src="${c.image}" style="width:100%; height:220px; object-fit:contain; border-radius:var(--radius-md);">`
        : `<div style="height:220px; display:flex; align-items:center; justify-content:center; font-size:3.5rem; background:var(--bg-main); border-radius:var(--radius-md); opacity:0.4;">📸</div>`;

      container.innerHTML += `
        <div class="home-book-card" onclick="App.openBook(${originalIdx})">
          <div class="book-card-badge-row">
            <span class="badge-tag">${this.esc(book.category)}</span>
            <div style="display:flex; gap:6px; align-items:center;">
              ${book.is_public ? '<span class="badge-tag public">Public Link</span>' : ''}
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${book.pages.length} Pages</span>
            </div>
          </div>
          <div class="cover-layout" style="pointer-events:none;">
            <div class="cover-img-area" style="padding:10px;">${imgHtml}</div>
            <div class="cover-content" style="padding:15px 18px;">
              <div class="cover-title" style="font-size:1.55rem;">${this.esc(c.title)}</div>
              <div class="cover-subtitle" style="font-size:0.95rem; margin-bottom:12px;">${this.esc(c.subtitle)}</div>
              <div class="cover-meta" style="margin-top:10px; padding-top:10px;">
                <div><strong>${this.t('author')}</strong> ${this.esc(c.author || 'You')}</div>
                <div><strong>${this.t('published')}</strong> ${this.esc(c.publishDate)} · <span style="opacity:0.8;">${tmpl.name}</span></div>
              </div>
            </div>
          </div>
        </div>`;
    });
  },

  renderActionCenter() {
    const actionCenter = document.getElementById('dashboard-action-center');
    if (!actionCenter) return;

    const cards: string[] = [];

    // Rule 1: Books with pages without photos
    this.state.books.forEach((b, idx) => {
      const emptyPages = b.pages.filter((p) => !p.image).length;
      if (emptyPages > 0) {
        cards.push(`
          <div class="action-card warning">
            <div class="action-card-text">
              ${this.t('action_no_photos').replace('{title}', this.esc(b.cover.title)).replace('{n}', emptyPages.toString())}
            </div>
            <button class="action-card-btn" onclick="App.openBook(${idx}); App.switchView('view-pages');">${this.t('action_btn_fix')}</button>
          </div>
        `);
      }
    });

    // Rule 2: Unfinished draft books
    const drafts = this.state.books.filter((b) => b.pages.length === 0);
    if (drafts.length > 0) {
      const firstDraftIdx = this.state.books.indexOf(drafts[0]);
      cards.push(`
        <div class="action-card">
          <div class="action-card-text">
            ${this.t('action_unfinished').replace('{n}', drafts.length.toString())}
          </div>
          <button class="action-card-btn" onclick="App.openBook(${firstDraftIdx}); App.switchView('view-edit');">${this.t('action_btn_fix')}</button>
        </div>
      `);
    }

    // Rule 3: Ready to share
    const readyBooks = this.state.books.filter((b) => b.pages.length >= 3 && !b.is_public);
    if (readyBooks.length > 0) {
      const readyIdx = this.state.books.indexOf(readyBooks[0]);
      cards.push(`
        <div class="action-card success">
          <div class="action-card-text">
            ${this.t('action_ready_share').replace('{title}', this.esc(readyBooks[0].cover.title)).replace('{pages}', readyBooks[0].pages.length.toString())}
          </div>
          <button class="action-card-btn" onclick="App.openBook(${readyIdx}); App.switchView('view-share');">${this.t('action_btn_share')}</button>
        </div>
      `);
    }

    if (cards.length > 0) {
      actionCenter.innerHTML = `
        <div class="action-center-header">⚡ ${this.t('action_center_title')}</div>
        <div class="action-center-container">${cards.slice(0, 3).join('')}</div>
      `;
      actionCenter.style.display = 'block';
    } else {
      actionCenter.style.display = 'none';
    }
  },

  renderCategoryFilterBar() {
    const bar = document.getElementById('category-filter-pills');
    if (!bar) return;

    const allCategories = ['All', ...CATEGORIES];
    bar.innerHTML = allCategories
      .map(
        (cat) => `
        <button class="filter-pill ${this.state.categoryFilter === cat ? 'active' : ''}" onclick="App.setCategoryFilter('${cat}')">
          ${cat === 'All' ? this.t('filter_all') : cat}
        </button>
      `
      )
      .join('');
  },

  setCategoryFilter(cat: string) {
    this.state.categoryFilter = cat;
    this.renderHome();
  },

  handleSearch(e: Event) {
    this.state.searchQuery = (e.target as HTMLInputElement).value;
    this.renderHome();
  },

  handleSortChange(e: Event) {
    this.state.sortBy = (e.target as HTMLSelectElement).value as any;
    this.renderHome();
  },

  // ==========================================
  // Book Creation & Opening
  // ==========================================
  async createNewBook() {
    const userPlan = (this.state.user?.plan || 'free') as PlanTier;
    const check = SubscriptionService.canCreateBook(this.state.books.length, userPlan);
    if (!check.allowed) {
      this.openPricingModal(check.message);
      return;
    }

    const newBook: MemoryBook = {
      id: `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: this.state.user?.id,
      category: 'Personal',
      template_id: 'classic',
      status: 'draft',
      is_public: false,
      public_slug: BookService.generateSlug('My Beautiful Memories'),
      cover: {
        title: 'My Beautiful Journey',
        subtitle: 'Memories to cherish forever',
        author: this.state.user?.full_name || 'Me',
        publishDate: new Date().toISOString().split('T')[0],
        dedication: '',
        image: '',
      },
      pages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.state.books.unshift(newBook);
    this.state.activeBookIndex = 0;
    this.state.currentIndex = -1;

    await this.saveState();
    AnalyticsService.track('book_created', { category: newBook.category }, this.state.user?.id, newBook.id);
    this.switchView('view-edit');
  },

  openBook(index: number) {
    this.state.activeBookIndex = index;
    this.state.currentIndex = -1;
    this.switchView('view-preview');
  },

  // ==========================================
  // Book Preview & 3D Page Turning
  // ==========================================
  renderPreview() {
    const container = document.getElementById('book-frame-content');
    const navContainer = document.getElementById('book-nav-container');
    const activeBook = this.getActiveBook();
    if (!container || !navContainer || !activeBook) return;

    container.style.animation = 'none';
    const tmpl = getTemplate(activeBook.template_id);

    if (this.state.currentIndex === -1) {
      // Cover page
      const c = activeBook.cover;
      const imgHtml = c.image
        ? `<img src="${c.image}" style="max-height:100%; border-radius:${tmpl.pageStyle.photoRadius};">`
        : `<div class="cover-img-placeholder">📸</div>`;

      container.style.background = tmpl.coverStyle.background;
      container.style.color = tmpl.coverStyle.textColor;
      container.style.border = tmpl.coverStyle.borderStyle;

      container.innerHTML = `
        <div class="cover-layout">
          ${tmpl.coverStyle.headerBanner ? `<div class="cover-header-banner">${tmpl.coverStyle.headerBanner}</div>` : ''}
          <div class="cover-img-area" onclick="${this.state.isPublicViewOnly ? '' : "App.switchView('view-edit')"}" style="cursor:pointer; background:transparent;">
            ${imgHtml}
          </div>
          <div class="cover-content">
            <div class="cover-title" style="font-family:${tmpl.coverStyle.fontFamily};">${this.esc(c.title)}</div>
            <div class="cover-subtitle" style="color:${tmpl.coverStyle.subtitleColor};">${this.esc(c.subtitle)}</div>
            <div class="cover-meta" style="border-top-color: rgba(128,128,128,0.25);">
              <div><strong>${this.t('author')}</strong> ${this.esc(c.author)}</div>
              <div><strong>${this.t('published')}</strong> ${this.esc(c.publishDate)}</div>
              ${c.dedication ? `<div class="cover-dedication">"${this.esc(c.dedication)}"</div>` : ''}
            </div>
          </div>
        </div>`;
    } else if (activeBook.pages.length > 0) {
      // Interior page
      const p = activeBook.pages[this.state.currentIndex];
      container.style.background = tmpl.pageStyle.background;
      container.style.color = tmpl.pageStyle.textColor;
      container.style.border = '1px solid var(--border-color)';

      container.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column;">
          <div class="page-photo-area" style="background:transparent;">
            ${p.image ? `<img src="${p.image}" onclick="App.openFS('${p.image}')" style="border:${tmpl.pageStyle.photoBorder}; border-radius:${tmpl.pageStyle.photoRadius}; box-shadow:${tmpl.pageStyle.photoShadow};">` : '<div style="font-size:4rem; opacity:0.3;">🖼️</div>'}
          </div>
          <div class="page-text-area" onclick="${this.state.isPublicViewOnly ? '' : "App.switchView('view-edit')"}" style="cursor:pointer;">
            ${p.title ? `<div class="page-title" style="font-family:${tmpl.pageStyle.fontFamily}; color:${tmpl.pageStyle.accentColor};">${this.esc(p.title)}</div>` : ''}
            ${p.desc || p.description ? `<div class="page-desc">${this.esc(p.desc || p.description || '')}</div>` : ''}
            ${!p.title && !p.desc && !p.description && !this.state.isPublicViewOnly ? `<div style="color:var(--text-secondary); text-align:center; padding-top:20px;">${this.t('tap_edit')}</div>` : ''}
          </div>
        </div>`;
    }

    const total = activeBook.pages.length;
    navContainer.innerHTML = `
      <button class="book-nav-btn" onclick="App.changePage(-1)" ${this.state.currentIndex === -1 ? 'disabled' : ''} title="Previous Page">❮</button>
      <div class="book-page-indicator">
        ${this.state.currentIndex === -1 ? this.t('cover_page') : `${this.t('page')} ${this.state.currentIndex + 1} / ${total}`}
      </div>
      <button class="book-nav-btn" onclick="App.changePage(1)" ${this.state.currentIndex === total - 1 ? 'disabled' : ''} title="Next Page">❯</button>
    `;
  },

  changePage(dir: number) {
    if (this.state.isFlipping) return;
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const newIdx = this.state.currentIndex + dir;
    if (newIdx >= -1 && newIdx < activeBook.pages.length) {
      this.state.isFlipping = true;
      const container = document.getElementById('book-frame-content');
      if (container) {
        container.style.animation = `${dir === 1 ? 'pageTurnNextOut' : 'pageTurnPrevOut'} 280ms forwards ease-in`;
      }

      setTimeout(() => {
        this.state.currentIndex = newIdx;
        this.renderPreview();
        if (container) {
          container.style.animation = `${dir === 1 ? 'pageTurnNextIn' : 'pageTurnPrevIn'} 280ms forwards ease-out`;
        }
        setTimeout(() => {
          if (container) container.style.animation = 'none';
          this.state.isFlipping = false;
        }, 280);
      }, 280);
    }
  },

  // ==========================================
  // Pages List View
  // ==========================================
  renderPages() {
    const grid = document.getElementById('pages-grid');
    const counter = document.getElementById('pages-counter');
    const activeBook = this.getActiveBook();
    if (!grid || !activeBook) return;

    grid.innerHTML = '';
    if (counter) {
      counter.textContent = this.t('total_pages').replace('{n}', activeBook.pages.length.toString());
    }

    const coverThumb = activeBook.cover.image || '';
    grid.innerHTML += `
      <div class="thumb-card ${this.state.currentIndex === -1 ? 'active' : ''}">
        <div class="thumb-img" style="display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px;" onclick="App.goToPage(-1)">
          ${coverThumb ? `<img src="${coverThumb}" style="width:100%; height:100%; object-fit:contain;">` : '<span style="font-size:3rem;">📖</span>'}
        </div>
        <div class="thumb-info">${this.t('cover_page')}</div>
      </div>`;

    activeBook.pages.forEach((p, i) => {
      grid.innerHTML += `
        <div class="thumb-card ${this.state.currentIndex === i ? 'active' : ''}">
          <div style="position:relative;">
            <img src="${p.image || ''}" class="thumb-img" onclick="App.goToPage(${i})" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text y=\\'60\\' x=\\'20\\' font-size=\\'50\\'>📸</text></svg>'">
            <div style="position:absolute; top:8px; right:8px; display:flex; gap:4px;">
              <button class="btn-icon" style="width:32px; height:32px; background:rgba(0,0,0,0.6); color:white; border:none;" onclick="event.stopPropagation(); App.movePage(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move Up">↑</button>
              <button class="btn-icon" style="width:32px; height:32px; background:rgba(0,0,0,0.6); color:white; border:none;" onclick="event.stopPropagation(); App.movePage(${i}, 1)" ${i === activeBook.pages.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
            </div>
          </div>
          <div class="thumb-info">${this.esc(p.title) || `${this.t('page')} ${i + 1}`}</div>
        </div>`;
    });
  },

  goToPage(idx: number) {
    this.state.currentIndex = idx;
    this.switchView('view-preview');
  },

  movePage(index: number, direction: number) {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeBook.pages.length) return;

    const temp = activeBook.pages[index];
    activeBook.pages[index] = activeBook.pages[targetIndex];
    activeBook.pages[targetIndex] = temp;

    this.saveState();
    this.renderPages();
  },

  // ==========================================
  // Edit View
  // ==========================================
  renderEdit() {
    const container = document.getElementById('edit-content');
    const headerTitle = document.getElementById('edit-header-title');
    const activeBook = this.getActiveBook();
    if (!container || !activeBook) return;

    if (headerTitle) {
      headerTitle.innerText = this.state.currentIndex === -1 ? 'Edit Cover & Details' : `Edit Page ${this.state.currentIndex + 1}`;
    }

    if (this.state.currentIndex === -1) {
      const c = activeBook.cover;
      const categoryOptions = CATEGORIES.map(
        (cat) => `<option value="${cat}" ${activeBook.category === cat ? 'selected' : ''}>${cat}</option>`
      ).join('');

      const templateOptions = Object.values(BOOK_TEMPLATES).map(
        (t) => `<option value="${t.id}" ${activeBook.template_id === t.id ? 'selected' : ''}>${t.name} ${t.isPremium ? '★ (Pro)' : ''}</option>`
      ).join('');

      container.innerHTML = `
        <div class="edit-card">
          <div style="margin-bottom:15px;">
            <label>${this.t('edit_cover')}</label>
            <div style="display:flex; gap:12px; margin-top:8px; align-items:center;">
              ${c.image ? `<img src="${c.image}" style="width:70px; height:70px; object-fit:contain; background:var(--bg-main); border-radius:8px; border:1px solid var(--border-color);">` : ''}
              <button class="btn btn-outline" style="width:auto;" onclick="document.getElementById('cover-upload').click()">${c.image ? this.t('change_photo') : this.t('add_photo')}</button>
            </div>
            <input type="file" id="cover-upload" style="display:none;" accept="image/*" onchange="App.handleUpdateImage(event, 'cover')">
          </div>

          <div class="input-group">
            <label>${this.t('book_title')}</label>
            <input type="text" id="c-title" value="${this.esc(c.title)}" oninput="App.updateData()">
          </div>

          <div class="input-group">
            <label>${this.t('subtitle')}</label>
            <input type="text" id="c-sub" value="${this.esc(c.subtitle)}" oninput="App.updateData()">
          </div>

          <div class="input-group">
            <label>${this.t('author_name')}</label>
            <input type="text" id="c-auth" value="${this.esc(c.author)}" oninput="App.updateData()">
          </div>

          <div class="input-group">
            <label>${this.t('category')}</label>
            <select id="c-cat" onchange="App.handleCategoryChange(event)">
              ${categoryOptions}
            </select>
          </div>

          <div class="input-group">
            <label>${this.t('template')}</label>
            <select id="c-tmpl" onchange="App.handleTemplateChange(event)">
              ${templateOptions}
            </select>
          </div>

          <div class="input-group">
            <label>${this.t('pub_date')}</label>
            <input type="date" id="c-date" value="${this.esc(c.publishDate)}" oninput="App.updateData()">
          </div>

          <div class="input-group">
            <label>${this.t('dedication')}</label>
            <textarea id="c-ded" oninput="App.updateData()" style="min-height:60px;">${this.esc(c.dedication)}</textarea>
          </div>

          <div class="edit-actions">
            <button class="btn" onclick="App.submitEdit()">${this.t('submit_btn')}</button>
          </div>
        </div>`;
    } else {
      const p = activeBook.pages[this.state.currentIndex];
      container.innerHTML = `
        <div class="edit-card">
          <div style="position:relative; margin-bottom:15px;">
            <img src="${p.image}" class="edit-preview-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text y=\\'60\\' x=\\'20\\' font-size=\\'50\\'>📸</text></svg>'">
            <button class="btn btn-outline" style="position:absolute; bottom:25px; right:10px; background:var(--bg-card); width:auto; padding:6px 14px;" onclick="document.getElementById('page-img-upload').click()">${this.t('replace_img')}</button>
          </div>
          <input type="file" id="page-img-upload" style="display:none;" accept="image/*" onchange="App.handleUpdateImage(event, 'page')">

          <div class="input-group">
            <label>${this.t('page_title')}</label>
            <input type="text" id="p-title" value="${this.esc(p.title || '')}" oninput="App.updateData()">
          </div>

          <div class="input-group">
            <label>${this.t('desc')}</label>
            <textarea id="p-desc" oninput="App.updateData()">${this.esc(p.desc || p.description || '')}</textarea>
          </div>

          <div class="edit-actions">
            <button class="btn" onclick="App.submitEdit()">${this.t('submit_btn')}</button>
            <button class="btn btn-danger" onclick="App.askDeletePage()">${this.t('delete_page')}</button>
          </div>
        </div>`;
    }
  },

  handleCategoryChange(e: Event) {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;
    activeBook.category = (e.target as HTMLSelectElement).value;
    this.saveState();
  },

  handleTemplateChange(e: Event) {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const tmplId = (e.target as HTMLSelectElement).value;
    const tmpl = BOOK_TEMPLATES[tmplId];

    if (tmpl && tmpl.isPremium) {
      const userPlan = (this.state.user?.plan || 'free') as PlanTier;
      const check = SubscriptionService.canUseTemplate(true, userPlan);
      if (!check.allowed) {
        this.openPricingModal(check.message);
        (e.target as HTMLSelectElement).value = activeBook.template_id;
        return;
      }
    }

    activeBook.template_id = tmplId;
    this.saveState();
  },

  updateData() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    if (this.state.currentIndex === -1) {
      const c = activeBook.cover;
      c.title = (document.getElementById('c-title') as HTMLInputElement)?.value || '';
      c.subtitle = (document.getElementById('c-sub') as HTMLInputElement)?.value || '';
      c.author = (document.getElementById('c-auth') as HTMLInputElement)?.value || '';
      c.publishDate = (document.getElementById('c-date') as HTMLInputElement)?.value || '';
      c.dedication = (document.getElementById('c-ded') as HTMLTextAreaElement)?.value || '';
    } else {
      const p = activeBook.pages[this.state.currentIndex];
      p.title = (document.getElementById('p-title') as HTMLInputElement)?.value || '';
      const descVal = (document.getElementById('p-desc') as HTMLTextAreaElement)?.value || '';
      p.desc = descVal;
      p.description = descVal;
    }

    this.saveState();
  },

  submitEdit() {
    this.updateData();
    this.switchView('view-pages');
  },

  askDeletePage() {
    this.showConfirm(this.t('confirm'), this.t('prompt_del_page'), () => {
      const activeBook = this.getActiveBook();
      if (!activeBook) return;
      activeBook.pages.splice(this.state.currentIndex, 1);
      this.state.currentIndex = Math.max(-1, this.state.currentIndex - 1);
      this.saveState();
      this.switchView('view-pages');
    });
  },

  confirmDeleteBook() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const promptText = this.t('prompt_del_book').replace('{title}', activeBook.cover.title);
    this.showConfirm(this.t('confirm'), promptText, async () => {
      await BookService.deleteBook(activeBook.id, this.state.user?.id);
      this.state.books.splice(this.state.activeBookIndex, 1);
      this.state.activeBookIndex = -1;
      this.switchView('view-home');
    });
  },

  // ==========================================
  // Photo Uploads & R2 Integration
  // ==========================================
  async handleUpload(e: any) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const userPlan = (this.state.user?.plan || 'free') as PlanTier;
    const pageCheck = SubscriptionService.canAddPage(activeBook.pages.length + files.length, userPlan);
    if (!pageCheck.allowed) {
      this.openPricingModal(pageCheck.message);
      return;
    }

    this.showToast(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadRes = await StorageService.uploadPhoto(file, this.state.user?.id || 'anon', activeBook.id);
      activeBook.pages.push({
        book_id: activeBook.id,
        page_number: activeBook.pages.length,
        image: uploadRes.public_url,
        image_url: uploadRes.public_url,
        image_key: uploadRes.r2_key,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        desc: '',
        description: '',
      });
      AnalyticsService.track('photo_uploaded', { storage: uploadRes.storage }, this.state.user?.id, activeBook.id);
    }

    e.target.value = '';
    this.closeModal();
    this.state.currentIndex = activeBook.pages.length - 1;
    await this.saveState();
    this.switchView('view-edit');
    this.showToast('Photos added to your book ✨');
  },

  async handleUpdateImage(e: any, type: 'cover' | 'page') {
    const file = e.target.files[0];
    if (!file) return;
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    this.showToast('Updating image...');
    const uploadRes = await StorageService.uploadPhoto(file, this.state.user?.id || 'anon', activeBook.id);
    this.closeModal();

    if (type === 'cover') {
      activeBook.cover.image = uploadRes.public_url;
      activeBook.cover.image_key = uploadRes.r2_key;
    } else {
      activeBook.pages[this.state.currentIndex].image = uploadRes.public_url;
      activeBook.pages[this.state.currentIndex].image_url = uploadRes.public_url;
      activeBook.pages[this.state.currentIndex].image_key = uploadRes.r2_key;
    }

    await this.saveState();
    this.renderEdit();
    this.showToast('Image updated ✨');
  },

  // ==========================================
  // Share & Collaboration
  // ==========================================
  renderShareSettings() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const publicUrl = `${window.location.origin}/?share=${activeBook.public_slug}`;
    const shareInput = document.getElementById('share-link-input') as HTMLInputElement;
    if (shareInput) shareInput.value = publicUrl;

    const toggle = document.getElementById('public-share-toggle') as HTMLInputElement;
    if (toggle) toggle.checked = activeBook.is_public;
  },

  togglePublicSharing(e: Event) {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;
    activeBook.is_public = (e.target as HTMLInputElement).checked;
    activeBook.status = activeBook.is_public ? 'published' : 'draft';
    this.saveState();
    AnalyticsService.track('book_shared', { is_public: activeBook.is_public }, this.state.user?.id, activeBook.id);
  },

  copyPublicLink() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;
    const publicUrl = `${window.location.origin}/?share=${activeBook.public_slug}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      this.showAlert(this.t('alert'), this.t('link_copied'));
    });
  },

  shareBook() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;
    const publicUrl = `${window.location.origin}/?share=${activeBook.public_slug}`;

    if (navigator.share) {
      navigator
        .share({
          title: activeBook.cover.title,
          text: `Check out our digital memory book "${activeBook.cover.title}"!`,
          url: publicUrl,
        })
        .catch(console.error);
    } else {
      this.copyPublicLink();
    }
  },

  openCollaboratorModal() {
    const userPlan = (this.state.user?.plan || 'free') as PlanTier;
    const check = SubscriptionService.canCollaborate(userPlan);
    if (!check.allowed) {
      this.openPricingModal(check.message);
      return;
    }

    const modal = document.getElementById('collab-modal');
    if (modal) modal.classList.add('active');
  },

  async inviteCollaborator() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;

    const emailInput = document.getElementById('collab-email-input') as HTMLInputElement;
    const roleSelect = document.getElementById('collab-role-select') as HTMLSelectElement;
    const email = emailInput?.value.trim();
    const role = (roleSelect?.value || 'editor') as 'editor' | 'viewer';

    if (!email || !email.includes('@')) {
      this.showAlert(this.t('alert'), 'Please enter a valid email address.');
      return;
    }

    const res = await BookService.inviteCollaborator(activeBook.id, email, role);
    this.closeModal('collab-modal');
    this.showAlert(this.t('alert'), res.message);
    if (emailInput) emailInput.value = '';
  },

  // ==========================================
  // Export, Print & Backup
  // ==========================================
  printBook() {
    const activeBook = this.getActiveBook();
    if (!activeBook) return;
    AnalyticsService.track('export_started', { type: 'print' }, this.state.user?.id, activeBook.id);
    window.print();
  },

  exportProject() {
    const data =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            version: '2.0-saas',
            exported_at: new Date().toISOString(),
            books: this.state.books,
            theme: this.state.theme,
            lang: this.state.lang,
          },
          null,
          2
        )
      );

    const a = document.createElement('a');
    a.href = data;
    a.download = `Memorable_PhotoBooks_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    AnalyticsService.track('export_started', { type: 'backup_json' }, this.state.user?.id);
  },

  restoreBackup(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.books && Array.isArray(parsed.books)) {
          this.state.books = parsed.books;
          await this.saveState();
          this.showAlert(this.t('alert'), `Restored ${parsed.books.length} books successfully!`);
          this.render();
        } else {
          this.showAlert(this.t('alert'), 'Invalid backup file format.');
        }
      } catch (err) {
        this.showAlert(this.t('alert'), 'Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  // ==========================================
  // Auth Drawer & Account
  // ==========================================
  openAuthModal(mode: 'signin' | 'signup' = 'signin') {
    this.switchAuthTab(mode);
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  },

  switchAuthTab(tab: 'signin' | 'signup' | 'forgot') {
    document.querySelectorAll('.auth-tab-content').forEach((el) => ((el as HTMLElement).style.display = 'none'));
    const target = document.getElementById(`auth-tab-${tab}`);
    if (target) target.style.display = 'block';

    const signinTabBtn = document.getElementById('auth-tab-btn-signin');
    const signupTabBtn = document.getElementById('auth-tab-btn-signup');
    if (signinTabBtn) signinTabBtn.classList.toggle('active', tab === 'signin');
    if (signupTabBtn) signupTabBtn.classList.toggle('active', tab === 'signup');
  },

  async handleSignIn() {
    const email = (document.getElementById('auth-signin-email') as HTMLInputElement)?.value.trim();
    const password = (document.getElementById('auth-signin-password') as HTMLInputElement)?.value;
    const errorEl = document.getElementById('auth-error-msg');

    if (!email || !password) {
      if (errorEl) errorEl.innerText = 'Please enter email and password';
      return;
    }

    if (errorEl) errorEl.innerText = 'Signing in...';
    const res = await AuthService.signIn(email, password);
    if (res.success && res.user) {
      this.state.user = res.user;
      this.closeModal('auth-modal');
      await this.loadState();
      this.checkMigrationPrompt();
      this.render();
      AnalyticsService.track('login', { email }, res.user.id);
    } else {
      if (errorEl) errorEl.innerText = res.error || 'Sign in failed';
    }
  },

  async handleGoogleSignIn() {
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.innerText = 'Connecting to Google...';
    const res = await AuthService.signInWithGoogle();
    if (res.success && res.user) {
      this.state.user = res.user;
      this.closeModal('auth-modal');
      await this.loadState();
      this.checkMigrationPrompt();
      this.render();
      AnalyticsService.track('login_google', { email: res.user.email }, res.user.id);
    } else {
      if ((res as any).code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        if (errorEl) {
          errorEl.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); border-radius: 8px; padding: 10px; margin-bottom: 8px; font-size: 0.82rem; line-height: 1.4; color: var(--text-main);">
              <strong>Firebase Notice: Domain Authorization Needed</strong><br>
              Google OAuth requires this domain to be allowlisted in Firebase:<br>
              <code style="background:var(--bg-card); padding:2px 6px; border-radius:4px; font-weight:bold; display:inline-block; margin: 4px 0;">${domain}</code><br>
              <div style="margin-top:6px; display:flex; gap:6px;">
                <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem; width:auto;" onclick="navigator.clipboard.writeText('${domain}'); App.showAlert('Copied!', 'Domain ${domain} copied to clipboard. Paste it in Firebase Console.');">Copy Domain</button>
                <a href="https://console.firebase.google.com/project/edurunner-saas/authentication/settings" target="_blank" rel="noopener noreferrer" class="btn" style="padding:4px 10px; font-size:0.75rem; width:auto; text-decoration:none; color:white;">Firebase Settings ↗</a>
              </div>
              <div style="margin-top:6px; font-size:0.78rem; color:var(--text-secondary);">
                👉 <strong>Instant alternative:</strong> You can create an account and log in right now using <strong>Email & Password</strong> above without needing any domain authorization!
              </div>
            </div>
          `;
        }
      } else {
        if (errorEl) errorEl.innerText = res.error || 'Google sign-in cancelled';
      }
    }
  },

  async handleSignUp() {
    const fullName = (document.getElementById('auth-signup-name') as HTMLInputElement)?.value.trim();
    const email = (document.getElementById('auth-signup-email') as HTMLInputElement)?.value.trim();
    const password = (document.getElementById('auth-signup-password') as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById('auth-signup-confirm') as HTMLInputElement)?.value;
    const errorEl = document.getElementById('auth-error-msg');

    if (!fullName || !email || !password) {
      if (errorEl) errorEl.innerText = 'Please fill all required fields';
      return;
    }
    if (password !== confirmPassword) {
      if (errorEl) errorEl.innerText = 'Passwords do not match';
      return;
    }

    if (errorEl) errorEl.innerText = 'Creating account...';
    const res = await AuthService.signUp(fullName, email, password);
    if (res.success && res.user) {
      this.state.user = res.user;
      this.closeModal('auth-modal');
      await this.loadState();
      this.checkMigrationPrompt();
      this.render();
      AnalyticsService.track('signup', { email }, res.user.id);
    } else {
      if (errorEl) errorEl.innerText = res.error || 'Signup failed';
    }
  },

  async handleForgotPassword() {
    const email = (document.getElementById('auth-forgot-email') as HTMLInputElement)?.value.trim();
    if (!email) return;
    const res = await AuthService.resetPassword(email);
    this.showAlert(this.t('alert'), res.message);
    this.switchAuthTab('signin');
  },

  async handleSignOut() {
    await AuthService.signOut();
    this.state.user = null;
    this.switchView('view-home');
    this.updateUserUI();
    this.showAlert(this.t('alert'), 'You have been signed out.');
  },

  openAccountModal() {
    this.switchView('view-account');
  },

  renderAccountView() {
    const container = document.getElementById('view-account-content');
    if (!container) return;

    const user = this.state.user;
    if (!user) {
      container.innerHTML = `
        <div class="edit-card" style="text-align:center;">
          <h3 style="margin-bottom:12px;">Sign in to your Cloud Account</h3>
          <p style="color:var(--text-secondary); margin-bottom:16px;">Access your digital books from any phone, tablet, or browser.</p>
          <button class="btn" onclick="App.openAuthModal()">${this.t('sign_in')}</button>
        </div>
      `;
      return;
    }

    const plan = SubscriptionService.getPlan(user.plan as PlanTier);

    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar-wrap">
          <div class="avatar-circle">${user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}</div>
          <div>
            <div style="font-size:1.15rem; font-weight:800;">${this.esc(user.full_name)}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">${this.esc(user.email)}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg-main); border-radius:var(--radius-md);">
          <div>
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Subscription Plan</div>
            <div style="font-size:1rem; font-weight:700; color:var(--primary);">${plan.name}</div>
          </div>
          <button class="btn btn-outline" style="width:auto; padding:6px 14px; font-size:0.82rem;" onclick="App.openPricingModal()">Upgrade</button>
        </div>

        <div style="font-size:0.88rem; color:var(--text-secondary); line-height:1.7; padding: 6px 0;">
          <div>• <strong>Book Library:</strong> ${this.state.books.length} Books</div>
          <div>• <strong>Cloud Sync:</strong> Active & Permanent ☁️</div>
          <div>• <strong>Cross-Device Access:</strong> Enabled 📱💻</div>
        </div>

        <div style="margin-top:16px; display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-outline" onclick="App.exportProject()">${this.t('export_title')}</button>
          <button class="btn btn-danger" onclick="App.handleSignOut()">${this.t('logout')}</button>
        </div>
      </div>
    `;
  },

  // ==========================================
  // Pricing & Subscription Modal
  // ==========================================
  openPricingModal(reasonMessage?: string) {
    const modal = document.getElementById('pricing-modal');
    const msgEl = document.getElementById('pricing-reason-text');
    if (msgEl) {
      msgEl.innerText = reasonMessage || 'Upgrade to unlock luxury themes, unlimited books, and high-definition exporting.';
    }
    if (modal) modal.classList.add('active');
  },

  async selectPlan(tier: PlanTier) {
    if (this.state.user) {
      await AuthService.updateProfile({ plan: tier });
      this.state.user.plan = tier;
      this.closeModal('pricing-modal');
      this.showAlert(this.t('alert'), `Congratulations! You are now upgraded to the ${tier.toUpperCase()} plan.`);
      this.render();
      AnalyticsService.track('subscription_upgrade', { plan: tier }, this.state.user.id);
    } else {
      this.closeModal('pricing-modal');
      this.openAuthModal('signup');
      this.showAlert(this.t('alert'), 'Please create an account to activate your plan.');
    }
  },

  // ==========================================
  // Custom Modals & Helpers
  // ==========================================
  showAlert(title: string, desc: string) {
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const modal = document.getElementById('custom-modal');

    if (modalTitle) modalTitle.innerText = title;
    if (modalDesc) modalDesc.innerText = desc;
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (confirmBtn) confirmBtn.onclick = () => this.closeModal();
    if (modal) modal.classList.add('active');
  },

  showConfirm(title: string, desc: string, onConfirm: () => void) {
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const modal = document.getElementById('custom-modal');

    if (modalTitle) modalTitle.innerText = title;
    if (modalDesc) modalDesc.innerText = desc;
    if (cancelBtn) cancelBtn.style.display = 'block';
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.closeModal();
        onConfirm();
      };
    }
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId: string = 'custom-modal') {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  openFS(src: string) {
    const fsImg = document.getElementById('fs-img') as HTMLImageElement;
    const fsViewer = document.getElementById('fullscreen-viewer');
    if (fsImg) fsImg.src = src;
    if (fsViewer) fsViewer.classList.add('active');
  },

  closeFS() {
    const fsViewer = document.getElementById('fullscreen-viewer');
    if (fsViewer) fsViewer.classList.remove('active');
  },

  esc(s: string): string {
    return s ? s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)) : '';
  },
};

// Global Exposure for inline HTML handlers
(window as any).App = App;
