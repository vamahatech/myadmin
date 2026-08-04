// INS additive decode entry — shapes for /admin/additives.

export interface Additive {
  ins: string;
  name: string;
  risk: string;
  controversial: boolean;
}

export interface AdditiveList {
  rows: Additive[];
}

export interface SeedResult {
  seeded: number;
  total: number;
}
