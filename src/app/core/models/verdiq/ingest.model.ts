// E-commerce-sourced SKU leads awaiting review — shapes for /admin/ingest.
// Written by the offline `ingredient-ingest` scraper into ingest_staging.
// Nothing here is trusted until an admin approves it into `products`.

export type IngestStatus = 'pending_review' | 'approved' | 'rejected' | 'duplicate';
export type IngestSite = 'amazon_in' | 'blinkit' | 'zepto' | 'other';

export interface IngestRow {
  id: string;
  source_site: IngestSite;
  source_url: string; // the citation the admin verifies against
  source_ref: string | null;
  barcode: string | null; // usually null from e-commerce; admin attaches on approve
  name: string | null;
  brand: string | null;
  category: string | null;
  ingredients_raw: string | null; // verbatim scraped string
  ingredients: string[] | null; // parsed list
  status: IngestStatus;
  review_note: string | null;
  reviewed_at: string | null;
  fetched_at: string;
  created_at: string;
  barcode_in_catalog: boolean; // true if this barcode already exists in products
}

export interface IngestList {
  rows: IngestRow[];
  counts: { pending_review: number; approved: number; rejected: number; duplicate: number };
}
