// app/commodity-map/page.tsx
// Drop this file into your Next.js app at this path.
// Works with the App Router (Next.js 13+).

import type { Metadata } from "next";
import dynamic from "next/dynamic";

// CommodityMap uses D3 and browser APIs — import it dynamically
// so it only runs on the client. This prevents SSR errors.
const CommodityMap = dynamic(
  () => import("@/components/academy/CommodityMap"),
  {
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
  }
);

export const metadata: Metadata = {
  title: "Explore All Episodes | Better Vice Club",
  description:
    "21 global commodities. 3 seasons. Geography, Social Studies, Economics, and ELA through coffee, chocolate, whiskey, khat, and more.",
  openGraph: {
    title: "BVC Commodity Map | Learn.WitUS",
    description:
      "Explore all 21 Better Vice Club episodes on an interactive world map.",
  },
};

export default function CommodityMapPage() {
  return (
    <main
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "40px 24px 64px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#BA7517",
            marginBottom: "8px",
          }}
        >
          Better Vice Club &nbsp;·&nbsp; Learn.WitUS
        </p>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 500,
            color: "#111827",
            margin: "0 0 8px",
            lineHeight: 1.2,
          }}
        >
          Every commodity. Every episode.
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#6b7280",
            lineHeight: 1.6,
            maxWidth: "600px",
            margin: 0,
          }}
        >
          21 episodes across 3 seasons, plotted by geographic origin. Each
          pin is a substance — and a story about geography, history,
          economics, and culture that starts where it grows.
        </p>
      </div>

      {/* Map */}
      <CommodityMap />

      {/* Below the map: two calls to action */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
          marginTop: "40px",
        }}
      >
        <a
          href="/academy"
          style={{
            display: "block",
            padding: "18px 20px",
            borderRadius: "10px",
            border: "0.5px solid #e5e7eb",
            background: "#fff",
            textDecoration: "none",
            transition: "border-color 0.15s",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#BA7517",
              marginBottom: "6px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Start learning
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 500,
              color: "#111827",
              marginBottom: "6px",
            }}
          >
            Browse all courses
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>
            Each episode has subject-specific teacher packets for Geography,
            Social Studies, Economics, and ELA.
          </div>
        </a>

        {/* TODO: once the BVC Season 1 course is imported into the Academy
            (plan 33 is content-loaded but not yet published as a course),
            update this href to the actual course detail route, e.g.
            /academy/{courseId}. For now both CTAs land on the catalog. */}
        <a
          href="/academy"
          style={{
            display: "block",
            padding: "18px 20px",
            borderRadius: "10px",
            border: "0.5px solid #e5e7eb",
            background: "#fff",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#185FA5",
              marginBottom: "6px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Start at the beginning
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 500,
              color: "#111827",
              marginBottom: "6px",
            }}
          >
            Season 1: Daily Rituals
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>
            Coffee, Tea, Chocolate, Sugar, Guayusa, Kola Nut, and Kava.
            Seven episodes. All four subjects. Free to start.
          </div>
        </a>
      </div>
    </main>
  );
}
