# Contrato da automação Grok → site

O watcher **não commita sozinho**. Ele só devolve objetos `Poll` prontos para colar em `data/polls.json` **e** `public/data/polls.json` (os dois precisam ser iguais). Depois rode `npm run update-polls`.

## Institutos canônicos (use o string exato)

`AtlasIntel` · `CNT/MDA` · `Datafolha` · `Futura/Apex` · `GERP` · `Genial/Quaest` · `Ideia` · `Indexa/Broadcast` · `Nexus/BTG` · `Paraná Pesquisas` · `PoderData` · `Quaest` · `Alfa Inteligência` · `Real Time Big Data` · `Vox Brasil`

Aliases → canônico:

- Quaest/Genial, Genial → `Genial/Quaest` se a série histórica for Genial; rodadas Globo recentes usam `Quaest`
- Meio/Ideia, Ideia Inteligência → `Ideia`
- Gerp, GERP Mercadologia → `GERP`
- BTG/Nexus, BTG Pactual → `Nexus/BTG`
- PoderData/Aya → `PoderData`
- Futura, Apex, 100% Cidades → `Futura/Apex`

Não incluir Palver, agregadores, wikis ou recortes só estaduais.

## `scenario` (só estes dois no gráfico)

- `estimulada 1º turno`
- `2º turno Lula x Flávio Bolsonaro`

Espontânea e outros 2º turnos (Cury, Caiado…) ficam de fora do plot atual.

## Chave de dedupe

`institute + fieldwork_end + scenario` contra o `polls.json` publicado.

## Campos

Congelados em `data/SCHEMA.md`. Sem chaves extras. `verified: true` só com número publicado e URL. `margin_of_error` string (`±2 pp`). Nomes de candidatos alinhados a `src/candidates.js`.
