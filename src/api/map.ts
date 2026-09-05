import { requestJson } from "./http";

export type MapOverviewRange = "days" | "all";

export type MapOverviewReportDto = {
  id: string;
  caseId: string;
  incidentType: string;
  status: string;
  mode: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  updatedAt?: string;
};

export type MapOverviewAlertDto = {
  id: string;
  title: string;
  message: string;
  senderName: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

export type MapOverviewResponse = {
  generatedAt: string;
  rangeDays: number;
  allTime: boolean;
  reports: MapOverviewReportDto[];
  alerts: MapOverviewAlertDto[];
  reportsTruncated?: boolean;
  alertsTruncated?: boolean;
};

export async function fetchMapOverview(
  days = 90,
  limit = 320,
  range: MapOverviewRange = "days",
  signal?: AbortSignal
) {
  const query = [`limit=${encodeURIComponent(String(limit))}`];
  if (range === "all") {
    query.push("range=all");
  } else {
    query.push(`days=${encodeURIComponent(String(days))}`);
  }

  return requestJson<MapOverviewResponse>({
    path: `/api/web/v1/map/overview?${query.join("&")}`,
    auth: true,
    signal,
  });
}
