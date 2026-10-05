export type PlanTier = 'free' | 'pro' | 'premium' | 'lifetime';

export interface PlanLimits {
  name: string;
  maxBooks: number;
  maxPagesPerBook: number;
  maxStorageMB: number;
  allowPremiumTemplates: boolean;
  allowCollaboration: boolean;
  allowHDExport: boolean;
  allowCustomDomain: boolean;
  pricePerYearINR: number;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanLimits> = {
  free: {
    name: 'Free Starter',
    maxBooks: 3,
    maxPagesPerBook: 15,
    maxStorageMB: 100,
    allowPremiumTemplates: false,
    allowCollaboration: false,
    allowHDExport: false,
    allowCustomDomain: false,
    pricePerYearINR: 0,
  },
  pro: {
    name: 'Pro Creator',
    maxBooks: 25,
    maxPagesPerBook: 60,
    maxStorageMB: 2000,
    allowPremiumTemplates: true,
    allowCollaboration: true,
    allowHDExport: true,
    allowCustomDomain: false,
    pricePerYearINR: 1499,
  },
  premium: {
    name: 'Family & Studio',
    maxBooks: 100,
    maxPagesPerBook: 150,
    maxStorageMB: 10000,
    allowPremiumTemplates: true,
    allowCollaboration: true,
    allowHDExport: true,
    allowCustomDomain: true,
    pricePerYearINR: 3499,
  },
  lifetime: {
    name: 'Lifetime Founder',
    maxBooks: 9999,
    maxPagesPerBook: 300,
    maxStorageMB: 50000,
    allowPremiumTemplates: true,
    allowCollaboration: true,
    allowHDExport: true,
    allowCustomDomain: true,
    pricePerYearINR: 6999,
  },
};

export const SubscriptionService = {
  getPlan(tier: PlanTier = 'free'): PlanLimits {
    return PLAN_CONFIGS[tier] || PLAN_CONFIGS.free;
  },

  canCreateBook(currentBookCount: number, plan: PlanTier = 'free'): { allowed: boolean; message?: string } {
    const limits = this.getPlan(plan);
    if (currentBookCount >= limits.maxBooks) {
      return {
        allowed: false,
        message: `You have reached the ${limits.maxBooks} book limit on the ${limits.name}. Upgrade to create more books!`,
      };
    }
    return { allowed: true };
  },

  canAddPage(currentPageCount: number, plan: PlanTier = 'free'): { allowed: boolean; message?: string } {
    const limits = this.getPlan(plan);
    if (currentPageCount >= limits.maxPagesPerBook) {
      return {
        allowed: false,
        message: `This book has reached the ${limits.maxPagesPerBook} page limit on ${limits.name}. Upgrade for up to 150 pages.`,
      };
    }
    return { allowed: true };
  },

  canUseTemplate(isPremiumTemplate: boolean, plan: PlanTier = 'free'): { allowed: boolean; message?: string } {
    if (!isPremiumTemplate) return { allowed: true };
    const limits = this.getPlan(plan);
    if (!limits.allowPremiumTemplates) {
      return {
        allowed: false,
        message: `This handcrafted theme template requires a Pro or Premium plan. Upgrade to unlock all 10 luxury templates!`,
      };
    }
    return { allowed: true };
  },

  canExportHD(plan: PlanTier = 'free'): { allowed: boolean; message?: string } {
    const limits = this.getPlan(plan);
    if (!limits.allowHDExport) {
      return {
        allowed: false,
        message: `High-definition uncompressed PDF printing requires a Pro plan. Free plan uses standard web print.`,
      };
    }
    return { allowed: true };
  },

  canCollaborate(plan: PlanTier = 'free'): { allowed: boolean; message?: string } {
    const limits = this.getPlan(plan);
    if (!limits.allowCollaboration) {
      return {
        allowed: false,
        message: `Collaborative memory building (inviting editors & family) is a Pro feature.`,
      };
    }
    return { allowed: true };
  },
};
