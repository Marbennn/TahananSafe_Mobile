// src/screens/admin_mobile/AdminShell.tsx
// Orchestrates all admin sub-screens (Home, Reports, ReportDetail, Users, Hotlines, Analytics)
import React, { useCallback, useState } from "react";

import AdminHomeScreen from "./AdminHomeScreen";
import AdminReportsScreen from "./AdminReportsScreen";
import AdminReportDetailScreen from "./AdminReportDetailScreen";
import AdminUsersScreen from "./AdminUsersScreen";
import AdminHotlinesScreen from "./AdminHotlinesScreen";
import AdminAnalyticsScreen from "./AdminAnalyticsScreen";

type AdminView =
  | { type: "home" }
  | { type: "reports" }
  | { type: "reportDetail"; reportId: string }
  | { type: "users" }
  | { type: "hotlines" }
  | { type: "analytics" };

type Props = {
  onOpenNotifications: () => void;
  onLogout: () => Promise<void> | void;
};

export default function AdminShell({ onOpenNotifications, onLogout }: Props) {
  const [view, setView] = useState<AdminView>({ type: "home" });

  const goHome = useCallback(() => setView({ type: "home" }), []);

  const openReports = useCallback(() => setView({ type: "reports" }), []);

  const openReportDetail = useCallback((reportId: string) => {
    setView({ type: "reportDetail", reportId });
  }, []);

  const openUsers = useCallback(() => setView({ type: "users" }), []);

  const openHotlines = useCallback(() => setView({ type: "hotlines" }), []);

  const openAnalytics = useCallback(() => setView({ type: "analytics" }), []);

  // ── Home ──
  if (view.type === "home") {
    return (
      <AdminHomeScreen
        onOpenNotifications={onOpenNotifications}
        onOpenHelp={() => {
          // No-op placeholder – implement help screen later
        }}
        onOpenReports={openReports}
        onOpenUsers={openUsers}
        onOpenHotlines={openHotlines}
        onOpenAnalytics={openAnalytics}
        onOpenPendingReports={openReports}
        onOpenVerifiedUsers={openUsers}
        onOpenEscalatedCases={openReports}
        onOpenReportDetail={openReportDetail}
        onLogout={onLogout}
      />
    );
  }

  // ── Reports list ──
  if (view.type === "reports") {
    return (
      <AdminReportsScreen
        onBack={goHome}
        onOpenReportDetail={openReportDetail}
      />
    );
  }

  // ── Report detail ──
  if (view.type === "reportDetail") {
    return (
      <AdminReportDetailScreen
        reportId={view.reportId}
        onBack={() => setView({ type: "reports" })}
      />
    );
  }

  // ── Users ──
  if (view.type === "users") {
    return <AdminUsersScreen onBack={goHome} />;
  }

  // ── Hotlines ──
  if (view.type === "hotlines") {
    return <AdminHotlinesScreen onBack={goHome} />;
  }

  // ── Analytics ──
  if (view.type === "analytics") {
    return <AdminAnalyticsScreen onBack={goHome} />;
  }

  return null;
}
