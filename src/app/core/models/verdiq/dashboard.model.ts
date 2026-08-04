// Shape of GET /admin/metrics — the data-health snapshot.

export interface DashboardCounts {
  products: number;
  verdicts: number;
  doubleStandards: number;
  alternatives: number;
  additives: number;
  users: number;
  children: number;
}

export interface DataCompleteness {
  total: number;
  withBarcode: number;
  withName: number;
  withIngredients: number;
  withNutrition: number;
  distinctCategories: number;
  nutritionPct: number;
  namePct: number;
  ingredientsPct: number;
}

export interface VerdictMix {
  OK: number;
  Caution: number;
  Avoid: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DashboardMetrics {
  counts: DashboardCounts;
  completeness: DataCompleteness;
  verdicts: VerdictMix;
  categories: CategoryCount[];
}
