const express = require("express");
const path = require("path");

const fs = require("fs");
const { getDefaultMapId, listMaps, toPublicMap } = require("./mapCatalog");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const rootDir = path.join(__dirname, "..");
const mapsDir = path.join(rootDir, "maps");

fs.mkdirSync(mapsDir, { recursive: true });

app.get("/comparacao", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "comparacao", "index.html"));
});

app.use(express.static(path.join(rootDir, "public")));

app.use("/algorithms", express.static(path.join(rootDir, "src", "algorithms")));
app.use("/vendor/h3-js", express.static(path.join(rootDir, "node_modules", "h3-js", "dist")));
app.use("/vendor/leaflet", express.static(path.join(rootDir, "node_modules", "leaflet", "dist")));

app.get("/api/maps", (req, res) => {
  const maps = listMaps(mapsDir);
  res.json({
    maps: maps.map(toPublicMap),
    defaultMapId: getDefaultMapId(maps),
  });
});

app.get("/api/grafo", (req, res) => {
  const maps = listMaps(mapsDir);
  const requestedMapId = typeof req.query.map === "string" ? req.query.map : getDefaultMapId(maps);
  const selectedMap = maps.find((map) => map.id === requestedMapId);

  if (!selectedMap) {
    return res.status(404).json({
      error: maps.length
        ? "Malha viária não encontrada."
        : "Nenhuma malha viária foi encontrada na pasta maps.",
    });
  }

  res.set("Cache-Control", "no-cache");
  return res.sendFile(selectedMap.filePath);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
