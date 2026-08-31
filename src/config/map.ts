const configuredApiKey = String(
  process.env.EXPO_PUBLIC_MAPTILER_API_KEY ||
    process.env.EXPO_PUBLIC_MAPTILER_KEY ||
    ""
).trim();

const configuredStyle = String(
  process.env.EXPO_PUBLIC_MAPTILER_STYLE || "streets-v4"
).trim();

export const MAPTILER_API_KEY = configuredApiKey;
export const hasMapTilerApiKey = Boolean(MAPTILER_API_KEY);

export function getMapTilerStyleUrl(): string {
  if (!MAPTILER_API_KEY) return "";

  if (/^https?:\/\//i.test(configuredStyle)) {
    const separator = configuredStyle.includes("?") ? "&" : "?";
    return configuredStyle.includes("key=")
      ? configuredStyle
      : `${configuredStyle}${separator}key=${encodeURIComponent(MAPTILER_API_KEY)}`;
  }

  return `https://api.maptiler.com/maps/${encodeURIComponent(
    configuredStyle
  )}/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`;
}

export function getFallbackMapStyle() {
  return {
    version: 8 as const,
    sources: {
      openStreetMap: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "open-street-map",
        type: "raster" as const,
        source: "openStreetMap",
      },
    ],
  };
}
