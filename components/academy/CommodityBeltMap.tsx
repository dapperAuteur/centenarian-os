"use client";

/**
 * CommodityBeltMap.tsx
 *
 * Belt-view world map for Better Vice Club.
 * - Equal Earth projection (accurate land area proportions)
 * - Per-commodity latitude band toggles
 * - mix-blend-mode: multiply for natural subtractive color mixing
 * - Overlap legend showing color behavior at 1/2/3/4+ belt overlaps
 * - Toggle between Mode A (latitude bands) and Mode B (production regions)
 * - Click any region to see which belts overlap at that latitude
 *
 * Dependencies: d3, topojson-client (same as CommodityMap.tsx)
 */

import { useEffect, useRef, useState, useCallback, type FC } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// ---------------------------------------------------------------------------
// Belt data
// ---------------------------------------------------------------------------

export interface Belt {
  id: string;
  name: string;
  episode: string;
  season: number;
  color: string;          // hex — used with multiply blend mode
  latMin: number;
  latMax: number;
  description: string;
  producers: string;
  modeB: boolean;         // whether production region polygons are implemented
}

export const BELTS: Belt[] = [
  {
    id: "coffee",
    name: "Coffee",
    episode: "Episode 1",
    season: 1,
    color: "#FFE500",
    latMin: -30,
    latMax: 25,
    description: "The Bean Belt spans 25°N to 30°S and requires volcanic soil, high elevation, and consistent rainfall. No frost tolerance.",
    producers: "Brazil (38%), Vietnam (18%), Colombia (8%), Ethiopia (4%)",
    modeB: true,
  },
  {
    id: "cacao",
    name: "Chocolate (Cacao)",
    episode: "Episode 3",
    season: 1,
    color: "#FF2200",
    latMin: -20,
    latMax: 20,
    description: "The Cacao Belt is narrower than coffee — 20°N to 20°S. Requires rainforest canopy shade, 70-100% humidity, and temperatures above 60°F year-round.",
    producers: "Côte d'Ivoire (42%), Ghana (17%), Indonesia (13%), Nigeria (7%)",
    modeB: true,
  },
  {
    id: "tea",
    name: "Tea",
    episode: "Episode 2",
    season: 1,
    color: "#0055FF",
    latMin: -35,
    latMax: 35,
    description: "Tea grows across a wide band from 35°N to 35°S, but quality production concentrates in highland tropical zones where altitude creates flavor complexity.",
    producers: "China (46%), India (23%), Kenya (8%), Sri Lanka (6%)",
    modeB: true,
  },
  {
    id: "sugar",
    name: "Sugar",
    episode: "Episode 4",
    season: 1,
    color: "#FF8800",
    latMin: -35,
    latMax: 35,
    description: "Sugarcane grows across tropical and subtropical zones. The colonial sugar belt of the Caribbean and Brazil was the economic foundation of the Atlantic slave trade.",
    producers: "Brazil (39%), India (20%), China (6%), Thailand (5%)",
    modeB: false,
  },
  {
    id: "guayusa",
    name: "Guayusa",
    episode: "Episode 5",
    season: 1,
    color: "#00EE88",
    latMin: -5,
    latMax: 5,
    description: "Guayusa grows only in the Amazonian equatorial zone — the narrowest belt in the series. Requires dense canopy shade and year-round tropical conditions.",
    producers: "Ecuador (primary), Peru, Colombia",
    modeB: false,
  },
  {
    id: "kola",
    name: "Kola Nut",
    episode: "Episode 6",
    season: 1,
    color: "#FFAA00",
    latMin: 0,
    latMax: 15,
    description: "Kola nut grows in tropical West Africa between the equator and 15°N. It thrives in the same rainforest conditions as cacao — the two belts overlap significantly.",
    producers: "Nigeria (primary), Ghana, Côte d'Ivoire, Sierra Leone",
    modeB: false,
  },
  {
    id: "tobacco",
    name: "Tobacco",
    episode: "Episode 15",
    season: 3,
    color: "#00BB44",
    latMin: -40,
    latMax: 60,
    description: "Tobacco has the broadest growing belt — from 60°N to 40°S — which is part of what made it the first successful global colonial commodity. It grows almost anywhere temperate.",
    producers: "China (43%), Brazil (11%), India (9%), USA (5%)",
    modeB: false,
  },
  {
    id: "cannabis",
    name: "Cannabis",
    episode: "Episode 16",
    season: 3,
    color: "#00CCEE",
    latMin: -50,
    latMax: 50,
    description: "Cannabis has one of the widest natural growing ranges in the series — 50°N to 50°S. Its near-global range is part of why its Schedule I classification was driven by politics, not pharmacology.",
    producers: "Afghanistan, Morocco, Mexico, Colombia, USA (legal states)",
    modeB: false,
  },
  {
    id: "coca",
    name: "Coca",
    episode: "Episode 18",
    season: 3,
    color: "#EE0099",
    latMin: -20,
    latMax: 15,
    description: "Coca grows in Andean highland tropical zones — concentrated but not identical to the Cacao Belt. It requires elevations of 500–2,000m, humid conditions, and well-drained volcanic soil.",
    producers: "Colombia (primary), Peru, Bolivia",
    modeB: false,
  },
  {
    id: "khat",
    name: "Khat",
    episode: "Episode 20",
    season: 3,
    color: "#AAEE00",
    latMin: -15,
    latMax: 15,
    description: "Khat grows in tropical highland conditions — elevations of 1,500–2,500m, temperatures of 15–25°C. Its belt overlaps with coffee, cacao, and tea in the East African highlands.",
    producers: "Ethiopia (primary), Kenya (miraa), Yemen",
    modeB: false,
  },
  {
    id: "poppy",
    name: "Opium Poppy",
    episode: "Episode 17",
    season: 3,
    color: "#8800EE",
    latMin: 20,
    latMax: 55,
    description: "The opium poppy belt runs through temperate regions from 25°N to 55°N. It's the only major BVC belt in the northern temperate zone — producing where coffee, cacao, and tea cannot grow.",
    producers: "Afghanistan (85% of illicit supply), Myanmar, Mexico",
    modeB: false,
  },
  {
    id: "peyote",
    name: "Peyote",
    episode: "Episode 19",
    season: 3,
    color: "#FF5544",
    latMin: 22,
    latMax: 32,
    description: "Peyote's range is the most geographically specific in the series — the Chihuahuan Desert of Texas and northern Mexico, a narrow band from 22°N to 32°N between 95°W and 105°W.",
    producers: "Texas (USA), Tamaulipas, Coahuila (Mexico) — endangered; 10–15 years to maturity",
    modeB: false,
  },
];

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "bands" | "regions";
interface CountryFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/** Approximate subtractive (multiply) blend of N colors */
function multiplyBlend(colors: string[]): string {
  if (colors.length === 0) return "#ffffff";
  const rgbs = colors.map(hexToRgb);
  const blended = rgbs.reduce(
    (acc, c) => ({
      r: Math.round((acc.r * c.r) / 255),
      g: Math.round((acc.g * c.g) / 255),
      b: Math.round((acc.b * c.b) / 255),
    }),
    { r: 255, g: 255, b: 255 }
  );
  return `rgb(${blended.r},${blended.g},${blended.b})`;
}

/** Sample overlap legend — 1, 2, 3, 4 belts */
const OVERLAP_SAMPLES: Array<{ count: number; colors: string[]; label: string }> = [
  {
    count: 1,
    colors: ["#FFE500"],
    label: "1 belt",
  },
  {
    count: 2,
    colors: ["#FFE500", "#FF2200"],
    label: "2 belts",
  },
  {
    count: 3,
    colors: ["#FFE500", "#FF2200", "#0055FF"],
    label: "3 belts",
  },
  {
    count: 4,
    colors: ["#FFE500", "#FF2200", "#0055FF", "#00BB44"],
    label: "4+ belts",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BeltToggleButton({
  belt,
  active,
  onClick,
}: {
  belt: Belt;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={belt.description}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "5px",
        border: active
          ? `1.5px solid ${belt.color}`
          : "1px solid #d1d5db",
        background: active ? `${belt.color}20` : "transparent",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: active ? 500 : 400,
        color: active ? "#1f2937" : "#9ca3af",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: active ? belt.color : "#d1d5db",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      />
      {belt.name}
    </button>
  );
}

function OverlapLegend() {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: "0.5px solid #e5e7eb",
        borderRadius: "8px",
        background: "#f9fafb",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#374151",
          marginBottom: "8px",
          letterSpacing: "0.03em",
        }}
      >
        Color mixing guide
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "8px",
        }}
      >
        {OVERLAP_SAMPLES.map((s, i) => (
          <div key={i} style={{ textAlign: "center", flex: 1 }}>
            <div
              style={{
                height: "24px",
                borderRadius: "4px",
                background: multiplyBlend(s.colors),
                border: "0.5px solid rgba(0,0,0,0.12)",
                marginBottom: "4px",
              }}
            />
            <div style={{ fontSize: "10px", color: "#6b7280" }}>
              {s.label}
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div
            style={{
              height: "24px",
              borderRadius: "4px",
              background: multiplyBlend([
                "#FFE500",
                "#FF2200",
                "#0055FF",
                "#00BB44",
                "#FF8800",
              ]),
              border: "0.5px solid rgba(0,0,0,0.12)",
              marginBottom: "4px",
            }}
          />
          <div style={{ fontSize: "10px", color: "#6b7280" }}>5+ belts</div>
        </div>
      </div>
      <div style={{ fontSize: "10px", color: "#9ca3af", lineHeight: 1.5 }}>
        Belt colors mix like paint — yellow + blue = green, red + blue = purple,
        all primary colors together = near black. Darker regions have more
        overlapping growing belts. Click any region to see which belts are
        active at that point.
      </div>
    </div>
  );
}

function BeltInfoPanel({
  activeBelts,
  clickLat,
}: {
  activeBelts: Belt[];
  clickLat: number | null;
}) {
  if (clickLat === null) {
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
          Click anywhere on the map to see which belts overlap at that latitude.
        </span>
      </div>
    );
  }

  const overlapping = activeBelts.filter(
    (b) => clickLat >= b.latMin && clickLat <= b.latMax
  );
  const blendedColor =
    overlapping.length > 0
      ? multiplyBlend(overlapping.map((b) => b.color))
      : "#e5e7eb";

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "14px 16px",
        borderRadius: "10px",
        border: `0.5px solid ${blendedColor === "#e5e7eb" ? "#e5e7eb" : blendedColor + "88"}`,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Overlap color swatch */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: blendedColor,
            flexShrink: 0,
            border: "0.5px solid rgba(0,0,0,0.1)",
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "#6b7280",
              marginBottom: "2px",
            }}
          >
            {Math.abs(Math.round(clickLat))}°{clickLat >= 0 ? "N" : "S"} latitude
          </div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "#111827",
              marginBottom: "6px",
            }}
          >
            {overlapping.length === 0
              ? "No active belts at this latitude"
              : overlapping.length === 1
              ? `1 belt — ${overlapping[0].name}`
              : `${overlapping.length} belts overlapping`}
          </div>
          {overlapping.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
              {overlapping.map((b) => (
                <span
                  key={b.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    border: `1px solid ${b.color}`,
                    background: `${b.color}18`,
                    fontSize: "11px",
                    color: "#374151",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: b.color,
                    }}
                  />
                  {b.name}
                </span>
              ))}
            </div>
          )}
          {overlapping.length === 1 && (
            <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>
              <strong style={{ color: "#374151", fontWeight: 500 }}>
                {overlapping[0].episode}
              </strong>{" "}
              · {overlapping[0].producers}
            </div>
          )}
          {overlapping.length > 1 && (
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              Episodes:{" "}
              {overlapping.map((b) => b.episode).join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CommodityBeltMap: FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<string>>(
    new Set(["coffee", "cacao", "tea"])
  );
  const [viewMode, setViewMode] = useState<ViewMode>("bands");
  const [clickLat, setClickLat] = useState<number | null>(null);

  // Fetch topology once
  useEffect(() => {
    fetch(WORLD_ATLAS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Map data failed (${r.status})`);
        return r.json() as Promise<Topology>;
      })
      .then(setTopoData)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Draw map
  useEffect(() => {
    if (!svgRef.current || !topoData) return;

    const W = 900;
    const H = 460;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const proj = d3
      .geoEqualEarth()
      .scale(153)
      .translate([W / 2, H / 2 + 10]);

    const pathGen = d3.geoPath(proj);

    // White ocean (required for multiply blend mode to work correctly)
    svg
      .append("path")
      .datum({ type: "Sphere" } as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "#f0f4f8");

    // Graticule
    svg
      .append("path")
      .datum(d3.geoGraticule()() as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "none")
      .attr("stroke", "#cdd5e0")
      .attr("stroke-width", 0.25);

    // Equator line (emphasized)
    svg
      .append("path")
      .datum(
        d3.geoGraticule().stepMinor([0, 90]).stepMajor([0, 90])() as d3.GeoPermissibleObjects
      )
      .attr("d", pathGen)
      .attr("fill", "none")
      .attr("stroke", "#b0bec5")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "3,3");

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
      .attr("fill", "#dde3ea")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.4);

    // Belt bands — multiply blend mode group
    const beltGroup = svg.append("g").attr("class", "belt-group");

    const activeBelts = BELTS.filter((b) => active.has(b.id));

    activeBelts.forEach((belt) => {
      const bandFeature: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-179.9, belt.latMin],
              [179.9, belt.latMin],
              [179.9, belt.latMax],
              [-179.9, belt.latMax],
              [-179.9, belt.latMin],
            ],
          ],
        },
      };

      beltGroup
        .append("path")
        .datum(bandFeature as d3.GeoPermissibleObjects)
        .attr("d", pathGen)
        .attr("fill", belt.color)
        .attr("opacity", 0.45)
        .style("mix-blend-mode", "multiply")
        .style("cursor", "pointer");
    });

    // Clickable overlay for lat detection
    svg
      .append("path")
      .datum({ type: "Sphere" } as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("click", function (event) {
        const [px, py] = d3.pointer(event);
        const coords = proj.invert?.([px, py]);
        if (coords) {
          setClickLat(coords[1]);
        }
      });

    // Latitude reference lines — 20°, 35° (key belt edges)
    const refLats = [-35, -30, -20, 20, 25, 30, 35];
    const refGroup = svg.append("g");
    refLats.forEach((lat) => {
      const lineFeature = {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [[-179.9, lat], [179.9, lat]],
        },
      };
      refGroup
        .append("path")
        .datum(lineFeature as d3.GeoPermissibleObjects)
        .attr("d", pathGen)
        .attr("fill", "none")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 0.4)
        .attr("stroke-dasharray", "2,4")
        .attr("opacity", 0.6);

      // Label
      const labelCoords = proj([0, lat]);
      if (labelCoords) {
        refGroup
          .append("text")
          .attr("x", labelCoords[0] + 6)
          .attr("y", labelCoords[1] - 2)
          .attr("font-size", "7px")
          .attr("fill", "#94a3b8")
          .attr("font-family", "system-ui, sans-serif")
          .text(`${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`);
      }
    });

    // Equator label
    const eqCoords = proj([0, 0]);
    if (eqCoords) {
      refGroup
        .append("text")
        .attr("x", eqCoords[0] + 6)
        .attr("y", eqCoords[1] - 2)
        .attr("font-size", "7px")
        .attr("fill", "#64748b")
        .attr("font-family", "system-ui, sans-serif")
        .attr("font-weight", "500")
        .text("Equator 0°");
    }
  }, [topoData, active, viewMode]);

  const toggleBelt = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setActive(new Set()), []);
  const showAll = useCallback(
    () => setActive(new Set(BELTS.map((b) => b.id))),
    []
  );

  const activeBeltsList = BELTS.filter((b) => active.has(b.id));

  return (
    <div
      style={{
        width: "100%",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* View mode toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
        >
          View:
        </span>
        {(["bands", "regions"] as ViewMode[]).map((mode) => {
          const isActive = viewMode === mode;
          const isDisabled = mode === "regions";
          const labels = {
            bands: "Latitude Bands",
            regions: "Production Regions",
          };
          return (
            <button
              key={mode}
              onClick={() => !isDisabled && setViewMode(mode)}
              disabled={isDisabled}
              style={{
                padding: "4px 12px",
                borderRadius: "5px",
                border: isActive
                  ? "1.5px solid #374151"
                  : "1px solid #d1d5db",
                background: isActive ? "#374151" : "transparent",
                color: isActive
                  ? "#fff"
                  : isDisabled
                  ? "#d1d5db"
                  : "#6b7280",
                fontSize: "12px",
                fontWeight: isActive ? 500 : 400,
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}
            >
              {labels[mode]}
              {isDisabled && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "9px",
                    background: "#f3f4f6",
                    color: "#9ca3af",
                    padding: "1px 4px",
                    borderRadius: "3px",
                    verticalAlign: "middle",
                  }}
                >
                  coming soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "8px",
          alignItems: "center",
        }}
      >
        {BELTS.map((belt) => (
          <BeltToggleButton
            key={belt.id}
            belt={belt}
            active={active.has(belt.id)}
            onClick={() => toggleBelt(belt.id)}
          />
        ))}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "8px",
        }}
      >
        <button
          onClick={showAll}
          style={{
            background: "none",
            border: "none",
            fontSize: "12px",
            color: "#2563eb",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Show all
        </button>
        <button
          onClick={clearAll}
          style={{
            background: "none",
            border: "none",
            fontSize: "12px",
            color: "#6b7280",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Clear all
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "11px",
            color: active.size > 0 ? "#374151" : "#d1d5db",
            background: active.size > 0 ? "#f3f4f6" : "transparent",
            padding: "2px 8px",
            borderRadius: "10px",
            fontWeight: 500,
          }}
        >
          {active.size} of {BELTS.length} active
        </span>
      </div>

      {/* Overlap legend */}
      <OverlapLegend />

      {/* Map */}
      <div
        style={{
          width: "100%",
          borderRadius: "10px",
          overflow: "hidden",
          border: "0.5px solid #e5e7eb",
          background: "#f0f4f8",
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
            aria-label="Equal Earth world map showing commodity growing belts by latitude range. Belt colors blend using multiply mode — overlapping regions darken toward brown and black."
          />
        )}
      </div>

      {/* Belt info panel */}
      <BeltInfoPanel activeBelts={activeBeltsList} clickLat={clickLat} />

      {/* Per-belt legend strip */}
      {active.size > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "0.5px solid #f3f4f6",
          }}
        >
          {activeBeltsList.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: b.color,
                  flexShrink: 0,
                }}
              />
              {b.name}
              <span style={{ color: "#d1d5db" }}>·</span>
              <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                {b.latMin < 0 ? `${Math.abs(b.latMin)}°S` : `${b.latMin}°N`}
                {" – "}
                {b.latMax < 0 ? `${Math.abs(b.latMax)}°S` : `${b.latMax}°N`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Equal Earth attribution note */}
      <div
        style={{
          marginTop: "10px",
          fontSize: "10px",
          color: "#d1d5db",
          textAlign: "right",
        }}
      >
        Equal Earth projection — Patterson, Jenny, and Šavrič (2018). Land areas
        shown at true proportional size.
      </div>
    </div>
  );
};

export default CommodityBeltMap;
