const fs = require("fs");
const path = require("path");

const DEFAULT_MAP_ORDER = ["sao-paulo", "goiania", "inhumas", "goias"];

function mapIdFromFilename(filename) {
  return path.basename(filename, path.extname(filename))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelFromFilename(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function readCityFromGraph(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    const beginning = buffer.toString("utf8", 0, bytesRead);
    const match = beginning.match(/"city"\s*:\s*("(?:\\.|[^"\\])*")/);
    return match ? JSON.parse(match[1]) : null;
  } catch {
    return null;
  } finally {
    fs.closeSync(descriptor);
  }
}

function listMaps(mapsDir) {
  if (!fs.existsSync(mapsDir)) return [];

  const usedIds = new Set();
  return fs.readdirSync(mapsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(mapsDir, entry.name);
      const id = mapIdFromFilename(entry.name);
      if (!id || usedIds.has(id)) return null;
      usedIds.add(id);
      const city = readCityFromGraph(filePath);
      return {
        id,
        label: city ? city.replace(/,?\s*Brazil$/i, "") : labelFromFilename(entry.name),
        city,
        filename: entry.name,
        sizeBytes: fs.statSync(filePath).size,
        filePath,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const firstPriority = DEFAULT_MAP_ORDER.indexOf(first.id);
      const secondPriority = DEFAULT_MAP_ORDER.indexOf(second.id);
      if (firstPriority >= 0 || secondPriority >= 0) {
        if (firstPriority < 0) return 1;
        if (secondPriority < 0) return -1;
        return firstPriority - secondPriority;
      }
      return first.label.localeCompare(second.label, "pt-BR");
    });
}

function getDefaultMapId(maps) {
  return maps.find((map) => map.id === "sao-paulo")?.id || maps.find((map) => map.id === "goiania")?.id || maps[0]?.id || null;
}

function toPublicMap(map) {
  const { filePath, filename, ...publicMap } = map;
  return publicMap;
}

module.exports = {
  getDefaultMapId,
  listMaps,
  mapIdFromFilename,
  toPublicMap,
};
