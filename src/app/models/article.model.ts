/** A finance-update article served by the backend /content API (Phase 2). */
export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  /** Optional Telugu translations for the EMI Planner app's bilingual feed. */
  titleTe?: string | null;
  excerptTe?: string | null;
  bodyMdTe?: string | null;
  author: string;
  sources: string[];
  category: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  publishedAt: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  faq?: { question: string; answer: string }[] | null;
  createdAt: string;
  updatedAt: string;
}
