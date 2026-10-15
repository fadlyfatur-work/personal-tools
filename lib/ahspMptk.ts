import type { AhspItem } from './ahsp'

export const mptkGroups = { tenaga: 'Tenaga kerja', bahan: 'Material', alat: 'Peralatan' } as const
export type MptkGroup = keyof typeof mptkGroups
export type MptkCoefficientSummary = {
  variant_count: number; numeric_count: number; formula_count: number; missing_count: number;
  samples: { coefficient: number | null; expression: string; output_quantity: number;
    item_unit: string; item_id: string; item_code: string; item_name: string; regulation: string }[];
}
export type MptkComponent = {
  key: string; group: MptkGroup; name: string; unit: string; codes: string[] | null;
  occurrence_count: number; job_count: number; review_count: number; fields: string[]; regulations: string[];
  coefficient_summary: MptkCoefficientSummary;
}
export type MptkUsage = {
  component_key: string; component_group: MptkGroup; name: string; code: string; unit: string;
  coefficient: number | null; expression: string; position: number; item_id: string;
  item_code: string; item_name: string; item_unit: string; output_quantity: number;
  field: string; division: string; regulation: string; analysis_status: AhspItem['analysis_status'];
  source_id: string | null; page_from: number | null; page_to: number | null;
  source_title: string | null; source_url: string | null; annex: string | null;
  original_group: MptkGroup; original_name: string; category_corrected: boolean;
}
export type MptkResponse = {
  total: number; page_size: number; items: MptkComponent[]; component: MptkComponent | null;
  usages: MptkUsage[]; usage_total: number; groups: { group: MptkGroup; count: number }[];
  fields: string[]; units: string[]; coverage: { jobs: number; with_components: number };
  validation: { validated: true; excluded: number; corrected: number };
}
