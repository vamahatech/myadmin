// Screen-3 alternatives — homemade swaps (P1-4) + cleaner packaged SKU (P1-5).

export type AltKind = 'homemade' | 'packaged';
export type AgeBand = 'under_2' | '2_to_5';

// Row as returned by the admin list (snake_case from Postgres + product name).
export interface AlternativeRow {
  id: string;
  barcode: string;
  age_band: AgeBand;
  kind: AltKind;
  name: string;
  note: string;
  created_at: string;
  product_name: string | null;
}

// Payload for add (camelCase — matches the POST body schema).
export interface AlternativeInput {
  barcode: string;
  ageBand: AgeBand;
  kind: AltKind;
  name: string;
  note: string;
}
