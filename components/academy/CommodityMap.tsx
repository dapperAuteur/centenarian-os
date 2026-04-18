// @ts-nocheck — REMOVE THIS LINE AFTER `npm install` RUNS LOCALLY.
// The real @types/d3 and @types/topojson-client declarations are far
// richer than the minimal shim in types/d3-topojson-shim.d.ts. Until
// those packages are installed from the registry (blocked by school
// network in dev; runs fine on Vercel / at home), we skip typecheck
// on this file. Runtime is unaffected.
"use client";

/**
 * CommodityMap.tsx
 *
 * Interactive world map showing all 21 BVC episodes by geographic origin.
 * Uses D3 + world-atlas topojson. Fully client-side (no SSR).
 *
 * Dependencies (declared in package.json devDependencies):
 *   d3, topojson-client
 *   @types/d3, @types/topojson-client, @types/topojson-specification
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FC,
} from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { COMMODITIES, getColor } from "@/lib/bvc/commodities";
import type { Commodity, Season } from "@/types/commodity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterState = "all" | Season;

interface PanelState {
  commodity: Commodity;
  color: string;
}

interface CountryFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown[];
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeasonButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        borderRadius: "6px",
        border: active ? `1.5px solid ${color}` : "1px solid #d1d5db",
        background: active ? `${color}18` : "transparent",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: active ? 500 : 400,
        color: active ? color : "#6b7280",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
}

function InfoPanel({ panel }: { panel: PanelState | null }) {
  if (!panel) {
    return (
      <div
        style={{
          marginTop: "12px",
          padding: "14px 16px",
          borderRadius: "10px",
          border: "0.5px solid #e5e7eb",
          minHeight: "72px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#fff",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#d1d5db",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "13px", color: "#9ca3af" }}>
          Click any pin to see episode details.
        </span>
      </div>
    );
  }

  const { commodity: c, color } = panel;

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "14px 16px",
        borderRadius: "10px",
        border: `0.5px solid ${color}44`,
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        background: "#fff",
        transition: "border-color 0.2s",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          marginTop: "4px",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "3px",
          }}
        >
          Season {c.season} &nbsp;·&nbsp; {c.ep}
        </div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 500,
            color: "#111827",
            marginBottom: "3px",
          }}
        >
          {c.name}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#6b7280",
            marginBottom: "6px",
          }}
        >
          {c.geo}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#374151",
            lineHeight: "1.55",
          }}
        >
          {c.body}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SEASON_FILTERS: { value: FilterState; label: string; color: string }[] =
  [
    { value: "all", label: "All 21 episodes", color: "#6b7280" },
    { value: 1, label: "Season 1: Daily Rituals", color: "#BA7517" },
    { value: 2, label: "Season 2: The Oldest Toast", color: "#185FA5" },
    { value: 3, label: "Season 3: The Forbidden Leaf", color: "#993C1D" },
  ];

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const CommodityMap: FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filter, setFilter] = useState<FilterState>("all");
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch topology once
  useEffect(() => {
    fetch(WORLD_ATLAS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load map data (${r.status})`);
        return r.json() as Promise<Topology>;
      })
      .then(setTopoData)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Draw map whenever topology or filter changes
  useEffect(() => {
    if (!svgRef.current || !topoData) return;

    const W = 900;
    const H = 460;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const proj = d3
      .geoNaturalEarth1()
      .scale(148)
      .translate([W / 2, H / 2]);

    const pathGen = d3.geoPath(proj);

    // Sphere (ocean)
    svg
      .append("path")
      .datum({ type: "Sphere" } as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "#f8fafc");

    // Graticule
    svg
      .append("path")
      .datum(d3.geoGraticule()() as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.3);

    // Countries
    const countries = topojson.feature(
      topoData,
      topoData.objects["countries"] as GeometryCollection<CountryFeature>
    );

    svg
      .append("g")
      .selectAll<SVGPathElement, unknown>("path")
      .data((countries as d3.ExtendedFeatureCollection).features)
      .join("path")
      .attr("d", pathGen)
      .attr("fill", "#e2e8f0")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.4);

    // Pins
    const visible =
      filter === "all"
        ? COMMODITIES
        : COMMODITIES.filter(
            (c) => c.season === filter || c.isHome
          );

    const pinGroup = svg.append("g");

    visible.forEach((c) => {
      const coords = proj([c.lon, c.lat]);
      if (!coords) return;
      const [px, py] = coords;

      const color = getColor(c);
      const r = c.isHome ? 6 : 5;

      // Outer ring
      pinGroup
        .append("circle")
        .attr("cx", px)
        .attr("cy", py)
        .attr("r", c.isHome ? 11 : 9)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.35);

      // Inner dot
      pinGroup
        .append("circle")
        .attr("cx", px)
        .attr("cy", py)
        .attr("r", r)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseenter", function () {
          d3.select(this).attr("r", r + 2);
        })
        .on("mouseleave", function () {
          d3.select(this).attr("r", r);
        })
        .on("click", () => {
          setPanel({ commodity: c, color });
        });

      // Tooltip label (episode number)
      pinGroup
        .append("text")
        .attr("x", px)
        .attr("y", py - (c.isHome ? 13 : 11))
        .attr("text-anchor", "middle")
        .attr("font-size", "7px")
        .attr("font-weight", "500")
        .attr("fill", color)
        .attr("pointer-events", "none")
        .text(c.isHome ? "Home" : `Ep ${c.id}`);
    });
  }, [topoData, filter]);

  const handleFilter = useCallback(
    (value: FilterState) => {
      setFilter(value);
      // Keep panel if selected commodity is still visible
      if (panel && value !== "all") {
        const season = value as Season;
        if (panel.commodity.season !== season && !panel.commodity.isHome) {
          setPanel(null);
        }
      }
    },
    [panel]
  );

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* Filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        {SEASON_FILTERS.map((f) => (
          <SeasonButton
            key={String(f.value)}
            label={f.label}
            color={f.color}
            active={filter === f.value}
            onClick={() => handleFilter(f.value)}
          />
        ))}
      </div>

      {/* Hint */}
      <p
        style={{
          fontSize: "11px",
          color: "#9ca3af",
          marginBottom: "6px",
        }}
      >
        {COMMODITIES.length} commodities across 3 seasons. Click any pin for details.
      </p>

      {/* Map */}
      <div
        style={{
          width: "100%",
          borderRadius: "10px",
          overflow: "hidden",
          border: "0.5px solid #e5e7eb",
        }}
      >
        {error ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#ef4444",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        ) : !topoData ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "14px",
            }}
          >
            Loading map data...
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 900 460"
            style={{ width: "100%", display: "block" }}
            role="img"
            aria-label="World map showing 21 BVC commodities by geographic origin, color-coded by season"
          />
        )}
      </div>

      {/* Info panel */}
      <InfoPanel panel={panel} />

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          marginTop: "14px",
          paddingTop: "12px",
          borderTop: "0.5px solid #f3f4f6",
        }}
      >
        {[
          { color: "#BA7517", label: "Season 1: Daily Rituals (Eps 1–7)" },
          { color: "#185FA5", label: "Season 2: The Oldest Toast (Eps 8–14)" },
          { color: "#993C1D", label: "Season 3: The Forbidden Leaf (Eps 15–21)" },
          { color: "#3B6D11", label: "Home base — Indianapolis" },
        ].map((item) => (
          <div
            key={item.color}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "#6b7280",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: item.color,
                flexShrink: 0,
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommodityMap;
