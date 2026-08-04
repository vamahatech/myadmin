// Shapes for GET /admin/products (grid rows + paged envelope).

export interface ProductRow {
  id: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  category: string | null;
  market: string | null;
  has_ingredients: boolean;
  has_nutrition: boolean;
  created_at: string;
}

export interface ProductPage {
  page: number;
  pageSize: number;
  total: number;
  rows: ProductRow[];
}

export type SearchField = 'name' | 'brand' | 'barcode' | 'category';

export interface ProductQuery {
  q?: string;
  field?: SearchField; // scope the search to one column; omit → all columns
  category?: string;
  incomplete?: boolean;
  page?: number;
  pageSize?: number;
}

// GET /admin/products/:id — the edit form's shape. ingredients is unwrapped
// to plain text; nutrition is raw JSON (no fixed schema in the backend).
export interface ProductDetail {
  id: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  category: string | null;
  market: string | null;
  ingredients_text: string | null;
  nutrition: unknown;
  created_at?: string;
}

// PATCH /admin/products/:id body — every field optional; only fields present
// are updated. nutritionJson is a raw JSON string (or null to clear it).
export interface ProductUpdate {
  name?: string;
  brand?: string;
  category?: string;
  market?: string;
  ingredientsText?: string;
  nutritionJson?: string | null;
}

// POST /admin/products body — name is required (a nameless row is the exact
// junk state the catalog filters out); barcode is optional but must be
// unique if given.
export interface ProductCreate {
  barcode?: string;
  name: string;
  brand?: string;
  category?: string;
  market?: string;
  ingredientsText?: string;
  nutritionJson?: string | null;
}
