export type ReportStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MEDIATION_SCHEDULED"
  | "ONGOING_ASSISTANCE"
  | "RESOLVED"
  | "CERTIFICATION_ISSUED"
  | "ARCHIVED";

export type CaseStatus =
  | "SUBMITTED"
  | "ACTIVE"
  | "COMPLETED"
  | "ARCHIVED";

export type CaseStatusMeta = {
  label: "Submitted" | "Active" | "Completed" | "Archived";
  color: string;
  bg: string;
};

export const CASE_STATUS_META: Record<CaseStatus, CaseStatusMeta> = {
  SUBMITTED: {
    label: "Submitted",
    color: "#94A3B8",
    bg: "#F1F5F9",
  },
  ACTIVE: {
    label: "Active",
    color: "#16A34A",
    bg: "#DCFCE7",
  },
  COMPLETED: {
    label: "Completed",
    color: "#2563EB",
    bg: "#DBEAFE",
  },
  ARCHIVED: {
    label: "Archived",
    color: "#64748B",
    bg: "#E2E8F0",
  },
};

export function normalizeCaseStatus(raw?: string, processStage?: string): CaseStatus {
  const explicit = String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");

  if (explicit === "active") return "ACTIVE";
  if (explicit === "completed" || explicit === "complete") return "COMPLETED";
  if (explicit === "archived" || explicit === "archive") return "ARCHIVED";
  if (explicit === "submitted" || explicit === "pending") return "SUBMITTED";

  const stage = String(processStage ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");

  if (stage === "archived" || stage === "archive" || stage === "closed") {
    return "ARCHIVED";
  }

  if (
    stage === "resolved" ||
    stage === "completed" ||
    stage === "barangay processing completed" ||
    stage === "barangay processing completed no settlement" ||
    stage === "certification issued" ||
    stage === "failed" ||
    stage === "cancelled" ||
    stage === "canceled"
  ) {
    return "COMPLETED";
  }

  if (!stage || stage === "submitted" || stage === "pending") {
    return "SUBMITTED";
  }

  return "ACTIVE";
}

export function getCaseStatusMeta(raw?: string, processStage?: string): CaseStatusMeta {
  return CASE_STATUS_META[normalizeCaseStatus(raw, processStage)];
}

export type ReportStatusMeta = {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
};

export const REPORT_STATUS_META: Record<ReportStatus, ReportStatusMeta> = {
  SUBMITTED: {
    label: "Submitted",
    shortLabel: "Submitted",
    color: "#2563EB",
    bg: "#DBEAFE",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    shortLabel: "In Review",
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  MEDIATION_SCHEDULED: {
    label: "Mediation Scheduled",
    shortLabel: "Mediation",
    color: "#8B5CF6",
    bg: "#E9D5FF",
  },
  ONGOING_ASSISTANCE: {
    label: "Ongoing Assistance",
    shortLabel: "On going",
    color: "#EA580C",
    bg: "#FED7AA",
  },
  RESOLVED: {
    label: "Resolved",
    shortLabel: "Resolved",
    color: "#16A34A",
    bg: "#DCFCE7",
  },
  CERTIFICATION_ISSUED: {
    label: "Certification Issued",
    shortLabel: "Certification Issued",
    color: "#DC2626",
    bg: "#FECACA",
  },
  ARCHIVED: {
    label: "Archived",
    shortLabel: "Archived",
    color: "#6B7280",
    bg: "#E5E7EB",
  },
};

export function normalizeReportStatus(raw?: string): ReportStatus {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (!s) return "SUBMITTED";

  if (s === "submitted" || s === "pending") return "SUBMITTED";
  if (
    s === "under review" ||
    s === "in review" ||
    s === "reviewing" ||
    s === "for official review"
  ) return "UNDER_REVIEW";
  if (
    s === "mediation scheduled" ||
    s === "mediation scheduling" ||
    s === "mediation conducted" ||
    s === "mediation"
  ) return "MEDIATION_SCHEDULED";
  if (
    s === "ongoing assistance" ||
    s === "ongoing" ||
    s === "on going" ||
    s === "in progress" ||
    s === "processing"
  ) {
    return "ONGOING_ASSISTANCE";
  }
  if (
    s === "resolved" ||
    s === "done" ||
    s === "completed" ||
    s === "barangay processing completed" ||
    s === "barangay processing completed no settlement"
  ) return "RESOLVED";
  if (
    s === "certification issued" ||
    s === "certificate issued" ||
    s === "cfa issued" ||
    s === "certification" ||
    s === "cancelled" ||
    s === "canceled"
  ) {
    return "CERTIFICATION_ISSUED";
  }
  if (s === "archived" || s === "archive" || s === "closed") return "ARCHIVED";

  return "SUBMITTED";
}

export function getReportStatusMeta(status?: string): ReportStatusMeta {
  return REPORT_STATUS_META[normalizeReportStatus(status)];
}

export function isActiveReportStatus(status?: string) {
  const normalized = normalizeReportStatus(status);
  return normalized !== "RESOLVED" && normalized !== "ARCHIVED";
}
