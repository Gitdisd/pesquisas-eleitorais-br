import './methodology.css'
/** Texto da seção Metodologia — curto, em blocos, no ar. */
export function methodologyHTML() {
  return `
<section class="panel metodologia" id="metodologia">
  <h2>Metodologia</h2>

  <section class="meto-sec">
    <h3>Objetivo</h3>
    <p>Mostrar um número de <strong>consenso</strong> da disputa nacional, não a última pesquisa de um instituto. Uma casa sozinha tem modo (telefone, face, online), peso geográfico e hábito próprio. A linha junta várias casas para reduzir esse viés.</p>
  </section>

  <section class="meto-sec">
    <h3>O que o gráfico mostra</h3>
    <ul>
      <li><strong>Ponto</strong> = uma pesquisa publicada. Data = <em>fim de campo</em>, não o dia da matéria.</li>
      <li><strong>Linha sólida</strong> = modelo do chip (padrão: Modelo 1). Os cartões usam a mesma conta.</li>
      <li><strong>Tracejado</strong> = projeção opcional. Não é urna.</li>
      <li><strong>Overlays</strong> (SMA, EMA…) = régua visual. <em>Não</em> entram na média nem nos cartões.</li>
    </ul>
  </section>

  <section class="meto-sec">
    <h3>Como o viés de uma fonte é cortado</h3>
    <ul>
      <li><strong>Várias casas</strong> no mesmo dia: nenhuma pesquisa é o resultado sozinha.</li>
      <li><strong>Peso por N</strong>: amostra maior conta mais (√N), mas não come o gráfico (N limitado 100–8000; n ausente = 800).</li>
      <li><strong>Recência</strong>: pesquisa velha perde peso. A janela (padrão 14d) define o alcance.</li>
      <li><strong>Anti-inundação</strong> (modelos 2 e 3): se a mesma casa solta várias ondas na janela, cada uma vale 1/k.</li>
      <li><strong>House</strong> (modelos 2 e 4): desvio sistemático da casa vs as outras em ±14 dias, encolhido n/(n+4). Casa alta demais é puxada para o meio.</li>
      <li><strong>τ²</strong> (modelo 3): desacordo <em>além</em> do erro amostral (modo, geografia, pergunta). Atlas n=5000 não manda sozinho.</li>
      <li>Só entram pesquisas <strong>nacionais</strong> estimuladas. Estadual e PDF vão para a caixa, não para o plot.</li>
    </ul>
  </section>

  <section class="meto-sec">
    <h3>Modelos da linha</h3>
    <p>Um chip por vez. Compare; não misture na cabeça como se fossem urnas diferentes.</p>
    <div class="meto-models">
      <article>
        <h4>off</h4>
        <p>Pontos + linha do Modelo 1. Sem projeção.</p>
      </article>
      <article>
        <h4>1 — original (padrão)</h4>
        <p><code>peso = √(N/2000) × exp(−dias/janela)</code></p>
        <p>Simples e estável. Não corrige casa. É o histórico do site.</p>
      </article>
      <article>
        <h4>2 — meia-vida + house</h4>
        <p><code>peso = √(N/2000) × 2^(−dias/janela) × 1/k</code></p>
        <p>Meia-vida em vez de exp. Debiasa a casa. Tracejado só se o holdout de 7 dias ganhar de “ficar parado”.</p>
      </article>
      <article>
        <h4>3 — meta-análise</h4>
        <p><code>peso = recência / (σ² + τ²) / k</code></p>
        <p>σ = margem/1,96 (ou 1,3×√[p(1−p)/N] se não há margem). τ² = DerSimonian–Laird. Melhor quando as casas discordam.</p>
      </article>
      <article>
        <h4>4 — latente (Kalman)</h4>
        <p>A corrida é um estado θ que anda um pouco por dia. Cada pesquisa atualiza θ pelo erro amostral + house. A linha é o estado até o último campo, não até 4/out.</p>
      </article>
      <article>
        <h4>5 — reativo</h4>
        <p>Meia-vida curta (janela/5) e impulso nas pesquisas novas. Sem house. Serve para ver o choque da última onda — não para consenso calmo.</p>
      </article>
    </div>
  </section>

  <section class="meto-sec">
    <h3>Overlays</h3>
    <p>Ferramentas de gráfico (ideia TradingView), ligadas uma a uma. Calculadas <em>em cima</em> da linha do modelo ativo.</p>
    <ul>
      <li><strong>SMA 7 / 21</strong> — média simples dos últimos 7 ou 21 dias da linha.</li>
      <li><strong>EMA 9 / 21</strong> — média exponencial (recente pesa mais).</li>
      <li><strong>HMA 16</strong> — Hull; reage rápido a virada.</li>
      <li><strong>VWMA 14</strong> — peso = N da pesquisa (“volume”).</li>
      <li><strong>KAMA 10</strong> — adapta a velocidade quando o número oscila.</li>
      <li><strong>Bollinger 20</strong> — faixa ±2 desvios da SMA 20. Faixa larga = casas discordando.</li>
    </ul>
  </section>

  <section class="meto-sec">
    <h3>Janela, cartões, dados</h3>
    <ul>
      <li>Janela padrão <strong>14 dias</strong>. Muda o alcance da média, não inventa ponto.</li>
      <li>Cartões: valor do modelo hoje vs o mesmo modelo há <strong>30 dias</strong>.</li>
      <li>Busca automática a cada ~3 h. “Verificar agora” só recarrega o JSON já publicado.</li>
      <li>Fonte: institutos + TSE no texto da linha. Extra pinado em <code>polls-extra.json</code> se o RSS atrasar.</li>
    </ul>
  </section>

  <section class="meto-sec">
    <h3>O que isto não é</h3>
    <ul>
      <li>Não é probabilidade de vitória.</li>
      <li>Não simula 2º turno a partir do 1º (o 2º turno no site só usa pesquisas de 2º).</li>
      <li>Não é MRP estadual — só há nacionais no JSON.</li>
      <li>Não corrige o erro de 2022 de cada instituto.</li>
      <li>Não inventa pesquisa. Sem número publicado, não entra.</li>
    </ul>
  </section>

  <p class="meto-foot">Contas no repositório: <a href="https://github.com/Gitdisd/pesquisas-eleitorais-br/blob/main/docs/MODELS.md" target="_blank" rel="noopener">docs/MODELS.md</a>. Site estático, sem fins partidários.</p>
  <p id="projMethodology"></p>
</section>`
}
