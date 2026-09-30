const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { getDefaultMapId, listMaps, mapIdFromFilename } = require("../src/mapCatalog");

test("normaliza nomes de arquivo para IDs seguros", () => {
  assert.equal(mapIdFromFilename("São Paulo.json"), "sao-paulo");
  assert.equal(mapIdFromFilename("Goiânia_GO.json"), "goiania-go");
});

test("descobre automaticamente os grafos JSON e prioriza Goiânia na ausência de São Paulo", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "route-maps-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  fs.writeFileSync(path.join(directory, "inhumas.json"), '{"city":"Inhumas, Goiás, Brazil","nodes":[],"edges":[]}');
  fs.writeFileSync(path.join(directory, "goiania.json"), '{"city":"Goiânia, Goiás, Brazil","nodes":[],"edges":[]}');
  fs.writeFileSync(path.join(directory, "README.md"), "ignorado");

  const maps = listMaps(directory);
  assert.deepEqual(maps.map(({ id }) => id), ["goiania", "inhumas"]);
  assert.equal(maps[0].label, "Goiânia, Goiás");
  assert.equal(getDefaultMapId(maps), "goiania");
});

test("prioriza São Paulo como mapa padrão quando disponível", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "route-maps-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  fs.writeFileSync(path.join(directory, "inhumas.json"), '{"city":"Inhumas, Goiás, Brazil","nodes":[],"edges":[]}');
  fs.writeFileSync(path.join(directory, "goiania.json"), '{"city":"Goiânia, Goiás, Brazil","nodes":[],"edges":[]}');
  fs.writeFileSync(path.join(directory, "sao-paulo.json"), '{"city":"São Paulo, São Paulo, Brazil","nodes":[],"edges":[]}');

  const maps = listMaps(directory);
  assert.deepEqual(maps.map(({ id }) => id), ["sao-paulo", "goiania", "inhumas"]);
  assert.equal(maps[0].label, "São Paulo, São Paulo");
  assert.equal(getDefaultMapId(maps), "sao-paulo");
});

