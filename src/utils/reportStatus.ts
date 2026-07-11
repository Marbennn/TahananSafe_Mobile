export type ReportStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MEDIATION_SCHEDULED"
  | "ONGOING_ASSISTANCE"
  | "RESOLVED"
  | "CERTIFICATION_ISSUED"
  | "ARCHIVED";

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
  if (s === "under review" || s === "in review" || s === "reviewing") return "UNDER_REVIEW";
  if (s === "mediation scheduled" || s === "mediation") return "MEDIATION_SCHEDULED";
  if (
    s === "ongoing assistance" ||
    s === "ongoing" ||
    s === "on going" ||
    s === "in progress" ||
    s === "processing"
  ) {
    return "ONGOING_ASSISTANCE";
  }
  if (s === "resolved" || s === "done" || s === "completed") return "RESOLVED";
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
