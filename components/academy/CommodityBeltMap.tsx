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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
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
    modeB: true,
  },
];

/**
 * Builds a GeoJSON rectangle from [lonMin, latMin, lonMax, latMax] bounds.
 * Winding NW→NE→SE→SW matches the Mode A band winding — interior is
 * the rectangle itself. The mirror winding (SW→SE→NE→NW) makes D3 fill
 * everything except the rectangle, which is not what we want.
 */
function makePoly(
  lonMin: number,
  latMin: number,
  lonMax: number,
  latMax: number
): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lonMin, latMax],
        [lonMax, latMax],
        [lonMax, latMin],
        [lonMin, latMin],
        [lonMin, latMax],
      ]],
    },
  };
}

/**
 * Per-commodity producing countries, keyed by belt id, as ISO 3166-1
 * numeric codes. Drawn in Mode B by filtering the world-atlas country
 * features — gives real country shapes instead of rectangles so the
 * oceans stay white and borders read correctly.
 *
 * Peyote is intentionally absent: its range is sub-national (the
 * Chihuahuan Desert, not "all of Mexico + USA"), so it falls through
 * to the PRODUCTION_REGIONS bounding-box override below.
 */
const PRODUCTION_COUNTRIES: Record<string, number[]> = {
  coffee: [76, 170, 231, 704, 360, 320, 340, 484, 800, 404],
  //       BR, CO,  ET,  VN,  ID,  GT,  HN,  MX,  UG,  KE
  cacao: [384, 288, 566, 360, 218, 76, 120],
  //       CI,  GH,  NG,  ID,  EC, BR, CM
  tea: [156, 356, 144, 404, 792, 104, 268, 392],
  //     CN,  IN,  LK,  KE,  TR,  MM,  GE,  JP
  sugar: [76, 356, 156, 36, 192, 32, 710, 764, 360],
  //      BR, IN,  CN,  AU, CU,  AR, ZA,  TH,  ID
  guayusa: [218, 604, 170],
  //        EC,  PE,  CO
  kola: [566, 288, 384, 694, 430, 120, 768, 204],
  //      NG,  GH,  CI,  SL,  LR,  CM,  TG,  BJ
  tobacco: [840, 156, 76, 356, 716, 454, 792, 100, 32],
  //        US,  CN, BR, IN,  ZW,  MW,  TR,  BG,  AR
  cannabis: [4, 504, 484, 170, 840, 710, 422, 388],
  //         AF, MA, MX,  CO,  US,  ZA,  LB,  JM
  coca: [170, 604, 68],
  //     CO,  PE,  BO
  khat: [231, 887, 404, 706, 262],
  //     ET,  YE,  KE,  SO,  DJ
  poppy: [4, 104, 484, 356, 792, 762],
  //      AF, MM,  MX,  IN,  TR,  TJ
};

/**
 * Fallback bounding-box regions for commodities whose production is
 * sub-national (peyote's Chihuahuan Desert range). Used when a belt
 * id is NOT present in PRODUCTION_COUNTRIES.
 */
const PRODUCTION_REGIONS: Record<string, GeoJSON.Feature[]> = {
  peyote: [
    // Chihuahuan Desert extent only — approx -107°W to -100°W, 22°N to 33°N.
    // The wider bbox the upstream doc suggested (east to -95°) extended
    // into the Gulf of Mexico, which is obviously wrong for a desert plant.
    makePoly(-107, 22, -100, 33),
  ],
};

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

/**
 * Approximates the visual result of stacking belt bands with
 * `mix-blend-mode: multiply` at 0.45 opacity each, so the legend
 * swatches match what actually appears on the map (not pure multiply,
 * which would go black at 3+ overlaps).
 */
function multiplyBlend(colors: string[]): string {
  if (colors.length === 0) return "#ffffff";

  const BELT_OPACITY = 0.45;
  let r = 255, g = 255, b = 255;

  colors.forEach((hex) => {
    const cr = parseInt(hex.slice(1, 3), 16);
    const cg = parseInt(hex.slice(3, 5), 16);
    const cb = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * (1 - BELT_OPACITY + BELT_OPACITY * cr / 255));
    g = Math.round(g * (1 - BELT_OPACITY + BELT_OPACITY * cg / 255));
    b = Math.round(b * (1 - BELT_OPACITY + BELT_OPACITY * cb / 255));
  });

  return `rgb(${r},${g},${b})`;
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
        padding: "6px 12px",
        borderRadius: "5px",
        border: active
          ? `1.5px solid ${belt.color}`
          : "1px solid #d1d5db",
        background: active ? `${belt.color}20` : "transparent",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: active ? 500 : 400,
        color: active ? "#1f2937" : "#6b7280",
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
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        background: "white",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
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
            <div style={{ fontSize: "12px", color: "#374151" }}>
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
          <div style={{ fontSize: "12px", color: "#374151" }}>5+ belts</div>
        </div>
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>
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
              fontSize: "12px",
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
                    padding: "3px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${b.color}`,
                    background: `${b.color}18`,
                    fontSize: "12px",
                    color: "#1f2937",
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

    // Pure-white ocean — multiply blend leaves belt colors unchanged
    // over white, so bands appear at full saturation.
    svg
      .append("path")
      .datum({ type: "Sphere" } as d3.GeoPermissibleObjects)
      .attr("d", pathGen)
      .attr("fill", "#ffffff");

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
      .attr("fill", "#e8ecf0")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.4);

    // Belt bands — multiply blend mode group
    const beltGroup = svg.append("g").attr("class", "belt-group");

    const activeBelts = BELTS.filter((b) => active.has(b.id));

    // Cache the country feature list so Mode B can filter by ISO ids.
    const countryFeatures = (countries as d3.ExtendedFeatureCollection)
      .features as Array<{ id?: string | number }>;

    activeBelts.forEach((belt) => {
      if (viewMode === "regions") {
        // MODE B — per-commodity production regions.
        // Prefer real country shapes from the world-atlas topojson; fall
        // back to bounding-box polygons for commodities whose production
        // is sub-national (peyote).
        const countryIds = PRODUCTION_COUNTRIES[belt.id];
        if (countryIds && countryIds.length > 0) {
          const matches = countryFeatures.filter(
            (f) => f.id != null && countryIds.includes(Number(f.id))
          );
          matches.forEach((region) => {
            beltGroup
              .append("path")
              .datum(region as d3.GeoPermissibleObjects)
              .attr("d", pathGen)
              .attr("fill", belt.color)
              .attr("opacity", 0.45)
              .style("mix-blend-mode", "multiply")
              .style("cursor", "pointer");
          });
          return;
        }

        // Sub-national fallback (peyote)
        const regions = PRODUCTION_REGIONS[belt.id];
        if (!regions || regions.length === 0) return;
        regions.forEach((region) => {
          beltGroup
            .append("path")
            .datum(region as d3.GeoPermissibleObjects)
            .attr("d", pathGen)
            .attr("fill", belt.color)
            .attr("opacity", 0.45)
            .style("mix-blend-mode", "multiply")
            .style("cursor", "pointer");
        });
        return;
      }

      // MODE A — full-longitude latitude band.
      // Densify each parallel edge. D3 interpolates polygon edges as
      // great circles along the shortest path — with only 4 corners,
      // the east-west edges collapse to a ~0.2° sliver across the
      // antimeridian instead of wrapping the parallel. Sampling every
      // 2° of longitude forces each segment to be a short great-circle
      // hop that closely approximates the parallel.
      //
      // Winding: top edge west→east at latMax, bottom edge east→west
      // at latMin. This is the orientation D3's spherical polygon
      // logic treats as "the band is the interior" for a densified
      // ring that wraps the full parallel; the mirror winding fills
      // the band's complement instead.
      const STEP = 2;
      const ring: Array<[number, number]> = [];
      for (let lon = -179.9; lon < 179.9; lon += STEP) {
        ring.push([lon, belt.latMax]);
      }
      ring.push([179.9, belt.latMax]);
      for (let lon = 179.9; lon > -179.9; lon -= STEP) {
        ring.push([lon, belt.latMin]);
      }
      ring.push([-179.9, belt.latMin]);
      ring.push([-179.9, belt.latMax]);

      const bandFeature: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
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
          .attr("font-size", "10px")
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
        .attr("font-size", "10px")
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
          style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}
        >
          View:
        </span>
        {(["bands", "regions"] as ViewMode[]).map((mode) => {
          const isActive = viewMode === mode;
          const labels = {
            bands: "Latitude Bands",
            regions: "Production Regions",
          };
          return (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 14px",
                borderRadius: "5px",
                border: isActive
                  ? "1.5px solid #374151"
                  : "1px solid #d1d5db",
                background: isActive ? "#374151" : "transparent",
                color: isActive ? "#fff" : "#374151",
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                cursor: "pointer",
              }}
            >
              {labels[mode]}
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
            fontSize: "13px",
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
            fontSize: "13px",
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
            fontSize: "13px",
            color: active.size > 0 ? "#374151" : "#9ca3af",
            background: active.size > 0 ? "#f3f4f6" : "transparent",
            padding: "3px 10px",
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
      {/* `isolation: isolate` + pure white background creates a new
          stacking context so the belt paths' `mix-blend-mode: multiply`
          composites against white (color × white = color) instead of
          reaching through to the dark academy page background (which
          would multiply every channel down toward black). */}
      <div
        style={{
          width: "100%",
          borderRadius: "10px",
          overflow: "hidden",
          border: "0.5px solid #e5e7eb",
          background: "white",
          isolation: "isolate",
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
                gap: "6px",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "2px",
                  background: b.color,
                  flexShrink: 0,
                }}
              />
              {b.name}
              <span style={{ color: "#d1d5db" }}>·</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
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
          fontSize: "11px",
          color: "#9ca3af",
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
