export interface BookTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isPremium: boolean;
  coverStyle: {
    background: string;
    textColor: string;
    subtitleColor: string;
    borderStyle: string;
    fontFamily: string;
    vignette?: boolean;
    headerBanner?: string;
  };
  pageStyle: {
    background: string;
    textColor: string;
    fontFamily: string;
    photoBorder: string;
    photoShadow: string;
    photoRadius: string;
    accentColor: string;
    watermark?: string;
  };
}

export const BOOK_TEMPLATES: Record<string, BookTemplate> = {
  classic: {
    id: 'classic',
    name: 'Classic Heritage',
    description: 'Timeless editorial layout with serif typography and clean borders',
    category: 'General',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      textColor: '#111827',
      subtitleColor: '#4f46e5',
      borderStyle: '1px solid #e5e7eb',
      fontFamily: 'serif',
    },
    pageStyle: {
      background: '#ffffff',
      textColor: '#1f2937',
      fontFamily: 'serif',
      photoBorder: '1px solid #e5e7eb',
      photoShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
      photoRadius: '12px',
      accentColor: '#4f46e5',
    },
  },
  elegant: {
    id: 'elegant',
    name: 'Modern Elegance',
    description: 'Minimalist luxury aesthetic with refined margins and gold accents',
    category: 'General',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
      textColor: '#f4f4f5',
      subtitleColor: '#eab308',
      borderStyle: '2px solid #eab308',
      fontFamily: 'system-ui, sans-serif',
    },
    pageStyle: {
      background: '#fafafa',
      textColor: '#18181b',
      fontFamily: 'system-ui, sans-serif',
      photoBorder: '2px solid #f4f4f5',
      photoShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.12)',
      photoRadius: '16px',
      accentColor: '#ca8a04',
    },
  },
  wedding: {
    id: 'wedding',
    name: 'Romantic Wedding',
    description: 'Delicate blush tones, floral vignette aesthetic, and script titles',
    category: 'Wedding',
    isPremium: true,
    coverStyle: {
      background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
      textColor: '#881337',
      subtitleColor: '#be123c',
      borderStyle: '2px solid #fecdd3',
      fontFamily: 'Georgia, serif',
      vignette: true,
      headerBanner: '💍 Newlyweds & Eternal Love',
    },
    pageStyle: {
      background: '#fffafb',
      textColor: '#4c0519',
      fontFamily: 'Georgia, serif',
      photoBorder: '3px solid #ffe4e6',
      photoShadow: '0 10px 25px -5px rgba(225, 29, 72, 0.1)',
      photoRadius: '20px',
      accentColor: '#e11d48',
    },
  },
  birthday: {
    id: 'birthday',
    name: 'Joyful Birthday',
    description: 'Vibrant celebratory theme with festive banners and playful typography',
    category: 'Birthday',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #fef08a 0%, #fdba74 100%)',
      textColor: '#7c2d12',
      subtitleColor: '#ea580c',
      borderStyle: '2px dashed #f97316',
      fontFamily: 'system-ui, sans-serif',
      headerBanner: '🎂 Birthday Milestones',
    },
    pageStyle: {
      background: '#fffbeb',
      textColor: '#451a03',
      fontFamily: 'system-ui, sans-serif',
      photoBorder: '3px solid #fde68a',
      photoShadow: '0 6px 16px rgba(249, 115, 22, 0.15)',
      photoRadius: '16px',
      accentColor: '#f97316',
    },
  },
  travel: {
    id: 'travel',
    name: 'Wanderlust Explorer',
    description: 'Expedition passport aesthetic with coordinate stamps and rich tones',
    category: 'Travel',
    isPremium: true,
    coverStyle: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      textColor: '#f8fafc',
      subtitleColor: '#38bdf8',
      borderStyle: '2px solid #0284c7',
      fontFamily: 'system-ui, sans-serif',
      headerBanner: '✈️ Expedition & Travels',
    },
    pageStyle: {
      background: '#f8fafc',
      textColor: '#0f172a',
      fontFamily: 'system-ui, sans-serif',
      photoBorder: '2px solid #cbd5e1',
      photoShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
      photoRadius: '14px',
      accentColor: '#0284c7',
    },
  },
  baby: {
    id: 'baby',
    name: 'Little Miracle (Baby)',
    description: 'Soft pastel cloud tones with gentle rounded frames and milestone dates',
    category: 'Baby',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)',
      textColor: '#0369a1',
      subtitleColor: '#0284c7',
      borderStyle: '2px solid #bae6fd',
      fontFamily: 'system-ui, sans-serif',
      headerBanner: '🍼 Baby First Steps & Milestones',
    },
    pageStyle: {
      background: '#f0f9ff',
      textColor: '#0c4a6e',
      fontFamily: 'system-ui, sans-serif',
      photoBorder: '3px solid #e0f2fe',
      photoShadow: '0 6px 14px rgba(2, 132, 199, 0.1)',
      photoRadius: '24px',
      accentColor: '#0284c7',
    },
  },
  family: {
    id: 'family',
    name: 'Family Heritage',
    description: 'Warm archival tones celebrating generations, reunions, and family legacy',
    category: 'Family',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fae8ff 100%)',
      textColor: '#4a044e',
      subtitleColor: '#86198f',
      borderStyle: '2px solid #f0abfc',
      fontFamily: 'serif',
      headerBanner: '🏡 Family Forever',
    },
    pageStyle: {
      background: '#fdf4ff',
      textColor: '#3b0764',
      fontFamily: 'serif',
      photoBorder: '2px solid #f5d0fe',
      photoShadow: '0 8px 16px rgba(134, 25, 143, 0.1)',
      photoRadius: '14px',
      accentColor: '#a21caf',
    },
  },
  anniversary: {
    id: 'anniversary',
    name: 'Golden Anniversary',
    description: 'Gold & silver duo-tone aesthetic honoring years of companionship',
    category: 'Anniversary',
    isPremium: true,
    coverStyle: {
      background: 'linear-gradient(135deg, #292524 0%, #44403c 100%)',
      textColor: '#fef08a',
      subtitleColor: '#facc15',
      borderStyle: '2px solid #ca8a04',
      fontFamily: 'Georgia, serif',
      headerBanner: '🥂 Milestone Anniversary',
    },
    pageStyle: {
      background: '#fffdf5',
      textColor: '#292524',
      fontFamily: 'Georgia, serif',
      photoBorder: '2px solid #fef08a',
      photoShadow: '0 10px 24px rgba(202, 138, 4, 0.15)',
      photoRadius: '12px',
      accentColor: '#ca8a04',
    },
  },
  school: {
    id: 'school',
    name: 'School & Graduation',
    description: 'Yearbook editorial style with student quotes, badges, and school spirit',
    category: 'School',
    isPremium: false,
    coverStyle: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      textColor: '#ffffff',
      subtitleColor: '#818cf8',
      borderStyle: '2px solid #6366f1',
      fontFamily: 'system-ui, sans-serif',
      headerBanner: '🎓 Graduation & Alma Mater',
    },
    pageStyle: {
      background: '#f5f3ff',
      textColor: '#1e1b4b',
      fontFamily: 'system-ui, sans-serif',
      photoBorder: '2px solid #ddd6fe',
      photoShadow: '0 8px 18px rgba(99, 102, 241, 0.12)',
      photoRadius: '12px',
      accentColor: '#4f46e5',
    },
  },
  memorial: {
    id: 'memorial',
    name: 'Tribute & Memorial',
    description: 'Peaceful, dignified monochrome & warm sepia tribute honoring loved ones',
    category: 'Memorial',
    isPremium: true,
    coverStyle: {
      background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
      textColor: '#e7e5e4',
      subtitleColor: '#a8a29e',
      borderStyle: '1px solid #78716c',
      fontFamily: 'Georgia, serif',
      headerBanner: '🕊️ In Loving Remembrance',
    },
    pageStyle: {
      background: '#fafaf9',
      textColor: '#1c1917',
      fontFamily: 'Georgia, serif',
      photoBorder: '1px solid #d6d3d1',
      photoShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      photoRadius: '10px',
      accentColor: '#57534e',
    },
  },
};

export const CATEGORIES = [
  'Wedding',
  'Birthday',
  'Anniversary',
  'Baby',
  'Family',
  'Travel',
  'School',
  'Friendship',
  'Memorial',
  'Festival',
  'Personal',
  'Other',
];

export function getTemplate(templateId?: string): BookTemplate {
  return BOOK_TEMPLATES[templateId || 'classic'] || BOOK_TEMPLATES.classic;
}
