export type Cycle = {
  id: number;
  name: string;
  applications_open_at: string;
  applications_close_at: string;
  letter_cutoff_at: string;
  default_period_start: string;
  default_period_end: string;
  is_open: boolean;
  past_cutoff: boolean;
};

export type Choice = { rank: number; organisation_id: number; name: string; status: string; rejection_reason: string | null };

export type PlacementSummary = {
  id: number;
  status: string;
  organisation: string;
  letter: { reference_no: string; pdf_file_id: number | null; sent_at: string | null } | null;
  acceptance_file_id: number | null;
  report_file_id: number | null;
};

export type Application = {
  id: number;
  cycle_id: number;
  status: "draft" | "submitted" | "passed" | "not_recommended";
  motivation: string | null;
  submitted_at: string | null;
  late_admitted: boolean;
  interview_date: string | null;
  matched_organisation: { id: number; name: string } | null;
  choices: Choice[];
  placements: PlacementSummary[];
};

export type StudentApplicationResponse = {
  cycle: Cycle | null;
  application: Application | null;
  stage: string;
  profile_complete: boolean;
  profile_gaps: string[];
};

export type Organisation = {
  id: number;
  name: string;
  status: string;
  sector: string | null;
  address: string | null;
  rejection_reason: string | null;
  email?: string | null;
  contact_person?: string | null;
  contact_title?: string | null;
  phone?: string | null;
};
