// Shape of GET /admin/gaps — the "what needs to be added" view.

export interface GapSummary {
  totalProducts: number;
  missingNutrition: number;
  missingName: number;
  missingIngredients: number;
  scoredBarcodes: number;
  additives: number;
  missingDoubleStandard: number;
  verdictsMissingAlternatives: number;
}

export interface CategoryCoverage {
  category: string;
  products: number;
  withNutrition: number;
  coveragePct: number;
}

export interface IncompleteProduct {
  id: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  category: string | null;
}

export interface GapsReport {
  summary: GapSummary;
  byCategory: CategoryCoverage[];
  missingNutritionSample: IncompleteProduct[];
}
