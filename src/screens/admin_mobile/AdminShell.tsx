// src/screens/admin_mobile/AdminShell.tsx
// Orchestrates all admin sub-screens (Home, Community, Reports, ReportDetail, Users, Hotlines, Analytics)
import React, { useCallback, useState } from "react";

import AdminBotNav from "../../components/AdminComponents/AdminBotNav";
import CommunityScreen from "../CommunityScreen";
import AdminHomeScreen from "./AdminHomeScreen";
import AdminReportsScreen from "./AdminReportsScreen";
import AdminReportDetailScreen from "./AdminReportDetailScreen";
import AdminUsersScreen from "./AdminUsersScreen";
import AdminHotlinesScreen from "./AdminHotlinesScreen";
import AdminAnalyticsScreen from "./AdminAnalyticsScreen";
import AdminAlertsScreen from "./AdminAlertsScreen";
import AdminSettingsScreen from "./AdminSettingsScreen";

type AdminView =
  | { type: "home" }
  | { type: "community" }
  | { type: "reports" }
  | { type: "reportDetail"; reportId: string }
  | { type: "users" }
  | { type: "hotlines" }
  | { type: "alerts" }
  | { type: "analytics" }
  | { type: "settings" };

type Props = {
  onOpenNotifications: () => void;
  onLogout: () => Promise<void> | void;
};

export default function AdminShell({ onOpenNotifications, onLogout }: Props) {
  const [view, setView] = useState<AdminView>({ type: "home" });

  const goHome = useCallback(() => setView({ type: "home" }), []);
  const openCommunity = useCallback(() => setView({ type: "community" }), []);
  const openReports = useCallback(() => setView({ type: "reports" }), []);
  const openReportDetail = useCallback((reportId: string) => {
    setView({ type: "reportDetail", reportId });
  }, []);
  const openUsers = useCallback(() => setView({ type: "users" }), []);
  const openHotlines = useCallback(() => setView({ type: "hotlines" }), []);
  const openAlerts = useCallback(() => setView({ type: "alerts" }), []);
  const openSettings = useCallback(() => setView({ type: "settings" }), []);
  const openAnalytics = useCallback(() => setView({ type: "analytics" }), []);

  if (view.type === "home") {
    return (
      <AdminHomeScreen
        onOpenNotifications={onOpenNotifications}
        onOpenHelp={() => {
          // No-op placeholder; implement help screen later.
        }}
        onOpenReports={openReports}
        onOpenCommunity={openCommunity}
        onOpenUsers={openUsers}
        onOpenHotlines={openHotlines}
        onOpenAlerts={openAlerts}
        onOpenSettings={openSettings}
        onOpenAnalytics={openAnalytics}
        onOpenPendingReports={openReports}
        onOpenVerifiedUsers={openUsers}
        onOpenEscalatedCases={openReports}
        onOpenReportDetail={openReportDetail}
        onLogout={onLogout}
      />
    );
  }

  if (view.type === "community") {
    return (
      <CommunityScreen
        initialTab="Community"
        onTabChange={(tab) => {
          if (tab === "Home") goHome();
          else if (tab === "Inbox") setView({ type: "alerts" });
          else if (tab === "Reports") setView({ type: "reports" });
          else if (tab === "Settings") setView({ type: "settings" });
        }}
        renderNav={({ activeTab, onTabPress, navHeight, paddingBottom, chevronBottom }) => (
          <AdminBotNav
            activeTab={activeTab}
            onTabPress={onTabPress}
            navHeight={navHeight}
            paddingBottom={paddingBottom}
            chevronBottom={chevronBottom}
          />
        )}
      />
    );
  }

  if (view.type === "reports") {
    return (
      <AdminReportsScreen
        onBack={goHome}
        onOpenReportDetail={openReportDetail}
        onTabChange={(tab) => {
          if (tab === "Home") goHome();
          else if (tab === "Inbox") setView({ type: "alerts" });
          else if (tab === "Community") openCommunity();
          else if (tab === "Settings") setView({ type: "settings" });
        }}
      />
    );
  }

  if (view.type === "reportDetail") {
    return (
      <AdminReportDetailScreen
        reportId={view.reportId}
        onBack={() => setView({ type: "reports" })}
      />
    );
  }

  if (view.type === "users") {
    return <AdminUsersScreen onBack={goHome} />;
  }

  if (view.type === "hotlines") {
    return <AdminHotlinesScreen onBack={goHome} />;
  }

  if (view.type === "alerts") {
    return (
      <AdminAlertsScreen
        onTabChange={(tab) => {
          if (tab === "Home") goHome();
          else if (tab === "Community") openCommunity();
          else if (tab === "Reports") setView({ type: "reports" });
          else if (tab === "Settings") setView({ type: "settings" });
        }}
        initialTab="Inbox"
        onFabPress={() => {}}
      />
    );
  }

  if (view.type === "analytics") {
    return <AdminAnalyticsScreen onBack={goHome} />;
  }

  if (view.type === "settings") {
    return (
      <AdminSettingsScreen
        onTabChange={(tab) => {
          if (tab === "Home") goHome();
          else if (tab === "Community") openCommunity();
          else if (tab === "Reports") setView({ type: "reports" });
          else if (tab === "Inbox") setView({ type: "alerts" });
        }}
        initialTab="Settings"
        onFabPress={() => {}}
        onLogout={onLogout}
      />
    );
  }

  return null;
}
