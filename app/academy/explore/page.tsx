// app/commodity-map/page.tsx
// Drop this file into your Next.js app at this path.
// Works with the App Router (Next.js 13+).

import type { Metadata } from "next";
import Link from "next/link";
import CommodityMap from "@/components/academy/CommodityMapClient";

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
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#BA7517",
            marginBottom: "12px",
          }}
        >
          Better Vice Club &nbsp;·&nbsp; A Learn.WitUS Curriculum &amp; Podcast
        </p>
        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 52px)",
            fontWeight: 700,
            color: "#f3f4f6",
            margin: "0 0 14px",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          Every commodity. Every episode.
        </h1>
        <p
          style={{
            fontSize: "17px",
            color: "#e5e7eb",
            lineHeight: 1.6,
            maxWidth: "640px",
            margin: "0 0 14px",
          }}
        >
          <strong style={{ color: "#f9fafb", fontWeight: 600 }}>
            A 21-episode podcast curriculum
          </strong>{" "}
          that teaches geography, history, economics, and ELA through the
          world&apos;s most culturally loaded substances — coffee, chocolate,
          whiskey, tobacco, kava, khat, and more.
        </p>
        <p
          style={{
            fontSize: "15px",
            color: "#d1d5db",
            lineHeight: 1.6,
            maxWidth: "640px",
            margin: 0,
          }}
        >
          The maps below plot every episode two ways:{" "}
          <strong style={{ color: "#f3f4f6", fontWeight: 600 }}>
            Episode Origins
          </strong>{" "}
          pins each commodity where its story starts, and{" "}
          <strong style={{ color: "#f3f4f6", fontWeight: 600 }}>
            Growing Belts
          </strong>{" "}
          shows the latitude bands and production regions where each one
          actually grows. Click any pin or region to open its episode.
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
        <Link
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
        </Link>

        {/* TODO: once the BVC Season 1 course is imported into the Academy
            (plan 33 is content-loaded but not yet published as a course),
            update this href to the actual course detail route, e.g.
            /academy/{courseId}. For now both CTAs land on the catalog. */}
        <Link
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
        </Link>
      </div>
    </main>
  );
}
