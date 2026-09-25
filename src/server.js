const express = require("express");
const path = require("path");

const fs = require("fs");

const app = express();
const PORT = 3000;

const rootDir = path.join(__dirname, "..");

app.use(express.static(path.join(rootDir, "public")));

app.use("/algorithms", express.static(path.join(rootDir, "src", "algorithms")));

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
