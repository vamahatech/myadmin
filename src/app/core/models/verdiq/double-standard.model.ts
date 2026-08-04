// India-vs-foreign double-standard pair — shapes for /admin/double-standards.

// Row as returned by the admin list (snake_case from Postgres + product name).
export interface DoubleStandardRow {
  barcode: string;
  nutrient: string;
  india_value: string;
  foreign_market: string;
  foreign_value: string;
  source: string;
  verified: boolean;
  updated_at: string;
  product_name: string | null;
}

// Payload for create/edit (camelCase — matches the POST body schema).
export interface DoubleStandardInput {
  barcode: string;
  nutrient: string;
  indiaValue: string;
  foreignMarket: string;
  foreignValue: string;
  source: string;
  verified?: boolean;
}
