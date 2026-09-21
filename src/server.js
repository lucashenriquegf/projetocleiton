const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const rootDir = path.join(__dirname, "..");

app.use(express.static(path.join(rootDir, "public")));

app.use("/algorithms", express.static(path.join(rootDir, "src", "algorithms")));

app.get("/api/grafo", (req, res) => {
  res.sendFile(path.join(rootDir, "Inhumas.json"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
