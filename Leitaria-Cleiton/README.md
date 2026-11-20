# Leitaria Cleiton — protótipo de coleta de leite

Adaptação do último protótipo `sistema-de-roteamento-fabrica-main` enviado pela equipe, preservando a identidade visual, a estrutura React/Vinext, os componentes de interface, o menu lateral e a visão móvel do motorista. Os percursos são calculados com o código do repositório `lucashenriquegf/projetocleiton`.

## Abrir

No Windows, execute **Iniciar-Prototipo.cmd** e abra **http://localhost:4175**. Mantenha a janela do iniciador aberta durante a apresentação.

Na primeira execução em outro computador, é necessário ter **Node.js 22.18 ou superior** e internet para instalar as dependências. Recomendado: Node.js 24 LTS. O iniciador instala as dependências quando necessário. A pasta local neste computador já está preparada; o ZIP contém os fontes, sem `node_modules`.

Também é possível iniciar pelo terminal:

```sh
cd web
npm ci
npm run dev -- --host 127.0.0.1 --port 4175
```

## O que funciona

- Gestor: mapa, seleção de viagem, resumo e acompanhamento das coletas.
- Planejamento: partida, chegada, seleção dos locais, ordem manual, cálculo nas ruas e sugestão de ordem otimizada.
- Locais: cadastro, edição, desativação e reativação; endereço, posição no mapa e volume previsto em litros.
- Motoristas: cadastro, edição e ativação/desativação.
- Caminhões: cadastro, placa, capacidade do tanque e vínculo exclusivo com motorista ativo.
- Vias bloqueadas: a posição escolhida fecha o segmento de rua mais próximo nos dois sentidos. Recalcule após alterar os bloqueios.
- Planejar rota: lista inicial sem mapa. Criar nova viagem abre o formulário e o mapa; rascunhos podem ser retomados. O gestor calcula e atribui a rota ao motorista.
- Troca de motorista e caminhão na viagem, preservando os registros anteriores e verificando capacidade e conflitos de uso.
- Motorista: visão para celular, mapa da viagem atribuída, confirmação manual, volume coletado, motivo de falha e correção de registro.
- Acompanhar: motoristas e suas rotas, classificadas como Não iniciada, Em andamento ou Finalizada, sem mapa na listagem. Clique na rota para consultar os detalhes.
- Histórico de viagens: apenas as finalizadas. Os detalhes mostram percurso, motorista, volume coletado, horários e motivo das coletas não realizadas. O registro de alterações continua separado em Configurações > Histórico de alterações.
- Exportação dos dados locais em JSON e saída para a tela de acesso.

Pendente é um círculo sem preenchimento; realizada é verde com ✓; não realizada é vermelha com ×. A lista e a legenda repetem os estados por texto. Os registros pertencem à viagem e à sua data. Calcular, visualizar ou passar por uma parada nunca confirma a coleta automaticamente.

Os locais são copiados para o planejamento de cada viagem: editar posteriormente um cadastro não altera uma viagem anterior. Para atualizar um local já selecionado numa viagem em planejamento, retire-o da seleção e inclua-o novamente.

## Roteiro para apresentar

1. Entre como gestor e abra **Planejar rota**.
2. Selecione os locais, ajuste partida/chegada e clique em **Calcular rota** ou **Otimizar ordem**.
3. Mostre a ordem manual e **Desfazer**. Recalcule se o planejamento mudar.
4. Como gestor, clique em **Atribuir rota ao motorista**.
5. Abra a visão do motorista, escolha o responsável e clique em **Iniciar viagem**.
6. Confirme uma coleta e registre outra como não realizada, com motivo.
7. Corrija um engano antes da conclusão. Como motorista, clique em **Finalizar viagem**; depois consulte os detalhes no histórico do gestor.
8. Crie outra viagem para mostrar que as confirmações anteriores não são reaproveitadas.

## Roteamento

Mapa de Inhumas/GO: **2.630 nós e 7.321 arestas direcionadas**. O cálculo segue a geometria e os sentidos das vias do grafo. Locais a mais de 400 metros da malha disponível são recusados com uma mensagem. Não se desenha um caminho fictício para esconder a falta de cobertura.

**A*** calcula os trechos pelo **menor tempo estimado** para a ordem escolhida. Ele foi o mais rápido entre os quatro algoritmos de menor custo ponderado comparados nesta amostra; isso não significa ser o mais rápido para qualquer mapa ou computador.

Resultado local de 05/11/2026: 42 consultas direcionadas entre sete posições de demonstração; mediana de três repetições após a primeira execução, incluindo montagem do resultado:

| Algoritmo | Tempo total das 42 consultas |
| --- | ---: |
| A* | 55,44 ms |
| Dijkstra | 74,28 ms |
| Dijkstra bidirecional | 136,13 ms |
| A* bidirecional | 261,43 ms |

Os quatro produziram os mesmos custos nessa amostra. Repita com `npm run benchmark`; resultado registrado em `web/test/benchmark-result.json`. BFS/DFS e buscas gulosas não foram escolhidos porque não garantem o menor custo de tempo das vias.

**ILS com busca local** sugere a ordem das coletas usando uma matriz de tempos calculada no grafo. O código original recebeu os parâmetros `startStop` e `endStop` para manter partida e chegada fixas. A busca começa na ordem do gestor e apresenta uma ordem de custo igual ou menor. É uma heurística, sem garantia do melhor circuito global. A ordem manual continua disponível.

O cálculo ocorre em um Worker e não depende de serviço de roteamento externo. O mapa-base do OpenStreetMap precisa de internet; sem ele, as ruas locais e o trajeto continuam visíveis. Tracejados indicam acessos aproximados entre o local e a rua, sem prometer navegabilidade desse acesso.

## Limites da demonstração

Locais e pessoas são fictícios. Os dados ficam neste navegador, em `localStorage`, sem banco central e sem sincronização entre dispositivos ou abas abertas. Gestor e motorista são modos demonstrativos, sem autenticação real. Para apresentar ambos com os mesmos dados, use o mesmo navegador e endereço.

Não há GPS ao vivo, trânsito, aplicativo nativo, operação offline com sincronização, controle sanitário ou validação das estradas para dimensões/peso do caminhão. O tempo mostrado inclui somente deslocamento. Um bloqueio afeta o segmento mais próximo, não toda uma estrada. Não há simulação apresentada como rastreamento real.

Escolas, cardápios, nutrição, demandas alimentares e estoque de produtos da cooperativa ficaram fora da navegação desta derivação para leite. As páginas originais foram preservadas em `referencia-original/app`; os componentes e módulos de apoio permanecem em `web`. O fluxo demonstrado usa `web/components/milk` e `web/lib/milk`, sem chamar as APIs/banco da cooperativa.

## Lean UX

Hipóteses para a próxima aula: o gestor consegue planejar sem ajuda; o motorista entende que a confirmação é manual; as pessoas conseguem recuperar um engano; mapa, textos e resumo ajudam a entender a operação. Propor tarefas curtas, observar dificuldades e registrar o que mudar. Os testes com pessoas ainda precisam ser realizados.

## Verificação

```sh
cd web
npm test
npm run typecheck
npm run lint
npm run build
```

Onze testes de regras e roteamento, análise dos arquivos alterados e compilação foram verificados. No Edge isolado foram exercitados cálculo, otimização, seleção/ordem/desfazer, coleta, motivo obrigatório, correção, troca de responsável, persistência, nova viagem, cadastros, frota e bloqueios. Layout conferido em 1440px e 390px, sem erros de JavaScript observados nesse roteiro.

Origem dos algoritmos: `https://github.com/lucashenriquegf/projetocleiton`, commit `c8989882ceb54d0b7101fd6bf376bb7d4906e541`. As implementações estão em `web/public/routing`, com a adaptação documentada do ILS e a integração em `engine.mjs`/`worker.js`. A fonte Inter foi reaproveitada do protótipo e servida localmente.

O trabalho foi feito numa cópia separada. Os arquivos originais enviados e o repositório remoto não foram substituídos.


Correção do cálculo: planejar e atribuir uma rota pendente não exige que motorista e caminhão estejam livres naquele instante. A disponibilidade é verificada quando o motorista inicia a viagem, para impedir duas viagens simultâneas. O cálculo do percurso depende dos locais e das vias; mensagens de falha ficam junto ao cálculo.


Exclusões: as viagens em planejamento ou atribuídas têm uma lixeira com confirmação. Qualquer viagem que já tenha sido iniciada é protegida, inclusive se seu estado tiver sido alterado depois. É possível excluir até a última viagem sem recriar os dados de demonstração ao recarregar. Locais e motoristas podem ser excluídos quando não estão vinculados a viagens ainda não finalizadas. Ao excluir um motorista, o vínculo com o caminhão é encerrado. Os itens excluídos saem dos cadastros e seleções, mas os dados necessários ao histórico e o registro da exclusão são mantidos. Exclusões, cancelamento da confirmação, vínculos e preservação do histórico foram verificados no navegador.
