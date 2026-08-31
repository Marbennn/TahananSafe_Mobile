import { queryOptions } from "@tanstack/react-query";

import { fetchMyReports, fetchReportDetail } from "../../api/reports";

export const reportKeys = {
  all: ["reports"] as const,
  mine: (userId: string) => ["reports", "mine", userId] as const,
  detail: (reportId: string) => ["reports", "detail", reportId] as const,
};

export function myReportsQuery(userId: string) {
  return queryOptions({
    queryKey: reportKeys.mine(userId),
    queryFn: ({ signal }) => fetchMyReports(signal),
    staleTime: 30_000,
  });
}

export function reportDetailQuery(reportId: string) {
  return queryOptions({
    queryKey: reportKeys.detail(reportId),
    queryFn: ({ signal }) => fetchReportDetail(reportId, signal),
    staleTime: 15_000,
  });
}
