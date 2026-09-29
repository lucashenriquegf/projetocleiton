# Malhas viárias

Coloque nesta pasta arquivos `.json` no formato usado pelo roteador:

```json
{
  "city": "Nome do local, Brazil",
  "nodes": [],
  "edges": []
}
```

O servidor descobre os arquivos automaticamente ao atualizar a página. O nome do arquivo vira o identificador da malha e o campo `city` vira o texto exibido no seletor.

Para baixar novamente as malhas padrão, execute:

```powershell
python scripts/download_maps.py --cities --skip-existing
```

O estado inteiro de Goiás permanece disponível separadamente com `--map goias`, pois sua obtenção exige muitas consultas e gera um grafo bem maior.
