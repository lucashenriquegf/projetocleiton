const express = require("express");
const path = require("path");

const fs = require("fs");

const app = express();
const PORT = 3000;

const rootDir = path.join(__dirname, "..");

app.get("/comparacao", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "comparacao", "index.html"));
});

app.use(express.static(path.join(rootDir, "public")));

app.use("/algorithms", express.static(path.join(rootDir, "src", "algorithms")));
app.use("/vendor/h3-js", express.static(path.join(rootDir, "node_modules", "h3-js", "dist")));
app.use("/vendor/leaflet", express.static(path.join(rootDir, "node_modules", "leaflet", "dist")));

app.get("/api/grafo", (req, res) => {
  const possiblePaths = [
    path.join(rootDir, "Goiânia.json"),
    path.join(rootDir, "goiânia.json"),
    path.join(rootDir, "Goiania.json"),
    path.join(rootDir, "goiania.json"),
  ];

  for (const candidatePath of possiblePaths) {
    if (fs.existsSync(candidatePath)) {
      return res.sendFile(candidatePath);
    }
  }

  res.sendFile(path.join(rootDir, "Inhumas.json"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
