"use client";

// Client boundary that owns the dynamic import of the map tree.
// Next.js 15 disallows `ssr: false` on `next/dynamic` inside Server
// Components, so the page component imports this wrapper instead of
// calling dynamic() directly.
//
// Renders MapTabs, which holds both the Episode Origins and Growing
// Belts views.

import dynamic from "next/dynamic";

const MapTabs = dynamic(() => import("@/components/academy/MapTabs"), {
  ssr: false,
  loading: () => (
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
  ),
});

export default function CommodityMapClient() {
  return <MapTabs />;
}
