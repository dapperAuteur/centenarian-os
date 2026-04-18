"use client";

/**
 * MapTabs.tsx
 *
 * Tab wrapper that holds both map views:
 *   Tab 1 — Episode Origins (CommodityMap, Natural Earth projection, pin-based)
 *   Tab 2 — Growing Belts (CommodityBeltMap, Equal Earth projection, belt-based)
 *
 * Tabs sit above the map, below the page title.
 * Each tab has its own filters, controls, and info panel.
 * Switching tabs does not reset the state of either map.
 */

import { useState, type FC } from "react";
import dynamic from "next/dynamic";

// Both maps use browser APIs — import dynamically with ssr:false
const CommodityMap = dynamic(() => import("@/components/academy/CommodityMap"), {
  ssr: false,
  loading: () => <MapLoader />,
});

const CommodityBeltMap = dynamic(
  () => import("@/components/academy/CommodityBeltMap"),
  { ssr: false, loading: () => <MapLoader /> }
);

function MapLoader() {
  return (
    <div
      style={{
        height: "460px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize: "14px",
        border: "0.5px solid #e5e7eb",
        borderRadius: "10px",
      }}
    >
      Loading map data...
    </div>
  );
}

type TabId = "origins" | "belts";

const TABS: Array<{ id: TabId; label: string; sublabel: string }> = [
  {
    id: "origins",
    label: "Episode Origins",
    sublabel: "Where each commodity comes from",
  },
  {
    id: "belts",
    label: "Growing Belts",
    sublabel: "Where each commodity can grow",
  },
];

const MapTabs: FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("origins");

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0",
          marginBottom: "24px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 20px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: isActive
                  ? "2px solid #BA7517"
                  : "2px solid transparent",
                marginBottom: "-1px",
                transition: "border-color 0.15s",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "#111827" : "#6b7280",
                  marginBottom: "2px",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: isActive ? "#6b7280" : "#9ca3af",
                  transition: "color 0.15s",
                }}
              >
                {tab.sublabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* Map panels — both mounted, only one visible */}
      {/* Keeping both mounted avoids re-fetching topology on tab switch */}
      <div style={{ display: activeTab === "origins" ? "block" : "none" }}>
        <CommodityMap />
      </div>
      <div style={{ display: activeTab === "belts" ? "block" : "none" }}>
        <CommodityBeltMap />
      </div>
    </div>
  );
};

export default MapTabs;
