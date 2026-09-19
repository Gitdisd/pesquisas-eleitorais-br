import './methodology.css'

export function methodologyHTML() {
  return `
<section class="panel metodologia" id="metodologia">
  <h2>Como este site funciona (explicação simples)</h2>
  <p class="meto-lead">Pense em vários amigos medindo a altura da mesma árvore. Cada um usa uma fita diferente. A gente não escolhe o amigo mais alto de voz. A gente junta as medidas.</p>

  <section class="meto-sec">
    <h3>Regras de inclusão e datas</h3>
    <ul>
      <li><strong>Data de campo</strong> = quando as entrevistas foram realizadas e é a data usada no eixo do gráfico.</li>
      <li><strong>Data de publicação</strong> = quando uma fonte divulgou o levantamento. Ela permanece visível e pode ter mais de uma data de cobertura, mas não cria uma nova pesquisa.</li>
      <li><strong>Registro TSE</strong> = quando identificado, ajuda a reconhecer a mesma pesquisa mesmo que outra fonte a publique depois.</li>
      <li><strong>Gráfico nacional</strong> = somente pesquisas verificadas de intenção de voto presidencial no Brasil. Pesquisas estaduais ficam no painel regional.</li>
      <li><strong>Faixa de incerteza</strong> = estimativa do agregado. Não é a margem de erro de uma pesquisa e não é probabilidade de vitória.</li>
    </ul>
  </section>

  <section class="meto-sec">
    <h3>O desenho</h3>
    <ul>
      <li><strong>Bolinha</strong> = uma pesquisa. É só aquela escola, naquele dia.</li>
      <li><strong>Linha cheia</strong> = o resumo de várias bolinhas. É o número do site.</li>
      <li><strong>Linha tracejada</strong> = “se continuar assim”. Não é o resultado da eleição.</li>
      <li><strong>Linhas extras (overlays)</strong> = réguas em cima do resumo. Elas não mudam o número dos cartões.</li>
    </ul>
    <p class="ex">Exemplo: Datafolha diz 39 e Atlas diz 43 no mesmo fim de semana. As duas bolinhas aparecem. A linha fica no meio, um pouco mais perto de quem ouviu mais gente.</p>
  </section>

  <section class="meto-sec">
    <h3>Por que não olhamos só uma pesquisa</h3>
    <ul>
      <li>Um amigo sempre mede um pouco alto. Outro sempre mede um pouco baixo.</li>
      <li>Quem ouviu mais pessoas (N grande) pesa mais, mas não manda sozinho.</li>
      <li>Medida velha vale menos que medida nova.</li>
      <li>Se o mesmo amigo manda três recados na mesma semana, cada recado vale menos — senão ele grita mais alto só porque falou três vezes.</li>
    </ul>
    <p class="ex">Exemplo: Atlas ouve 5.000 pessoas. Datafolha ouve 2.000. Atlas pesa mais, mas Datafolha, Quaest e Nexus ainda puxam a linha. Uma casa não “ganha” o gráfico.</p>
  </section>

  <section class="meto-sec">
    <h3>Os modos da linha (Modelos 1 a 5)</h3>
    <p>É a mesma turma de bolinhas. Muda só o jeito de fazer a média. Um modo de cada vez.</p>
    <div class="meto-models">
      <article>
        <h4>off</h4>
        <p>Bolinha + linha antiga. Sem “se continuar assim”.</p>
      </article>
      <article>
        <h4>1 — padrão</h4>
        <p>Receita antiga do site. Pesquisa grande e nova pesa mais. Não corrige o hábito da casa.</p>
        <p class="ex">Exemplo: 39 ontem e 35 há 20 dias. O 39 puxa mais a linha.</p>
      </article>
      <article>
        <h4>2 — casa justa</h4>
        <p>Se uma casa sempre fica 2 pontos acima das outras, a gente tira esses 2 antes de misturar.</p>
        <p class="ex">Exemplo: casa A sempre 2 pontos acima de B, C e D. No modo 2 a linha trata A como se fosse “menos 2”.</p>
      </article>
      <article>
        <h4>3 — quando brigam</h4>
        <p>Olha a margem de erro e o quanto as casas discordam. Se discordam muito, ninguém manda sozinho.</p>
        <p class="ex">Exemplo: uma diz 34 e outra 40. O modo 3 não finge que são a mesma foto. A linha fica no meio e não corre para o 40.</p>
      </article>
      <article>
        <h4>4 — filme, não foto</h4>
        <p>A disputa anda um pouquinho por dia. Cada pesquisa nova empurra o filme, não apaga o capítulo anterior.</p>
        <p class="ex">Exemplo: três semanas de 38 e uma pesquisa de 43. O filme sobe, mas não pula para 43 no mesmo dia.</p>
      </article>
      <article>
        <h4>5 — nervoso</h4>
        <p>Olha quase só o que acabou de sair. Bom para ver o susto. Ruim para um número calmo.</p>
        <p class="ex">Exemplo: sai um 43 hoje. O modo 5 sobe rápido. O modo 1 sobe devagar.</p>
      </article>
    </div>
  </section>

  <section class="meto-sec">
    <h3>Réguas (overlays / indicadores)</h3>
    <p>São adesivos no desenho. Ligar ou desligar não muda os cartões.</p>
    <ul>
      <li><strong>SMA 7</strong> — média dos últimos 7 dias da linha. Como a nota da semana.</li>
      <li><strong>SMA 21</strong> — média de 21 dias. Como a nota do mês. Mais lisa.</li>
      <li><strong>EMA 9 / 21</strong> — parecida com a SMA, mas o dia de ontem pesa mais que o de três semanas.</li>
      <li><strong>HMA</strong> — régua rápida. Vira cedo quando a linha vira.</li>
      <li><strong>VWMA</strong> — dias com pesquisa grande (muito N) puxam mais a régua.</li>
      <li><strong>KAMA</strong> — anda rápido quando o número está mudando de verdade; anda devagar quando só treme.</li>
      <li><strong>Bollinger (BB)</strong> — um corredor em volta da linha. Corredor largo = as casas não combinam. Estreito = quase o mesmo número.</li>
    </ul>
    <p class="ex">Exemplo: a linha sobe de 36 para 39. SMA 21 quase não se mexe. EMA 9 e HMA sobem junto. BB fica mais largo se uma casa ficou em 34 e outra em 43.</p>
  </section>

  <section class="meto-sec">
    <h3>Escalas e botões do gráfico</h3>
    <ul>
      <li><strong>Eixo de baixo (X)</strong> = calendário. Esquerda é passado. Direita é agora.</li>
      <li><strong>Eixo de lado (Y)</strong> = porcentagem de voto. 40 quer dizer 40 em cada 100 pessoas naquela pesquisa.</li>
      <li><strong>30d / 90d / tudo</strong> = quanto calendário cabe na tela. Não apaga pesquisa; só aproxima o zoom.</li>
      <li><strong>Janela 7d / 14d / 30d</strong> = até que distância uma bolinha ainda puxa a linha de hoje. Janela curta = memória curta.</li>
      <li><strong>Resetar eixos</strong> = volta o zoom. <strong>Resetar Y</strong> = só o eixo da porcentagem.</li>
      <li><strong>Roda do mouse / pinça / Shift+arrastar</strong> = zoom. Como aproximar um mapa.</li>
      <li><strong>1º turno / 2º turno</strong> = duas perguntas diferentes. Não misturamos as bolinhas.</li>
    </ul>
    <p class="ex">Exemplo: no 1º turno Lula pode ter 39 e Flávio 35. No 2º a mesma pesquisa pode ser 46 a 44. São contas separadas. Trocar o chip de turno é trocar de caderno.</p>
  </section>

  <section class="meto-sec">
    <h3>Ferramentas da página</h3>
    <ul>
      <li><strong>Cartões em cima</strong> = o número da linha hoje e a diferença contra 30 dias atrás. “+1,20 pp vs 30d” = subiu um pouco no mês.</li>
      <li><strong>Chips de instituto</strong> = ligar/desligar uma casa. Útil para ver se uma casa sozinha puxa o desenho. Com todas ligadas o site está no modo justo.</li>
      <li><strong>Tema / bandeira</strong> = só cor da página. Zero efeito no número.</li>
      <li><strong>Verificar agora</strong> = pede de novo o arquivo que já está no ar. Não sai caçando pesquisa nova na hora.</li>
      <li><strong>Tabela</strong> = lista crua: quem mediu, quantas pessoas, margem, link.</li>
    </ul>
    <p class="ex">Exemplo: desliga Atlas e a linha desce um pouco. Liga de novo e ela volta. Isso mostra o peso daquela casa — por isso o modo justo deixa todas ligadas.</p>
  </section>

  <section class="meto-sec">
    <h3>O que o site não faz</h3>
    <ul>
      <li>Não diz “vai ganhar”. Diz “as pesquisas de agora, juntas, estão aqui”.</li>
      <li>Não inventa pesquisa. Sem número publicado, não tem bolinha.</li>
      <li>Não usa pesquisa de um só estado no desenho nacional.</li>
      <li>Não transforma 1º turno em 2º turno por mágica.</li>
    </ul>
  </section>

  <details class="meto-more">
    <summary>Contas diretas (para quem quiser o detalhe)</summary>
    <ul>
      <li>Modelo 1: <code>peso = √(N/2000) × exp(−dias/janela)</code>. N vazio = 800; N entre 100 e 8000.</li>
      <li>Modelo 2: meia-vida <code>2^(−dias/janela)</code>, vezes <code>1/k</code> se a mesma casa repetiu, menos o vício da casa (house) encolhido <code>n/(n+4)</code>.</li>
      <li>Modelo 3: <code>peso = recência / (σ² + τ²) / k</code>. σ = margem/1,96. τ² = briga extra entre casas.</li>
      <li>Modelo 4: Kalman + smoother. A disputa é um estado que anda ~0,16 ponto por raiz de dia.</li>
      <li>Modelo 5: meia-vida = janela/5, com impulso <code>1 + 2e^(−dias/1,8)</code> nas pesquisas novas.</li>
    </ul>
    <p>Texto longo: <a href="https://github.com/Gitdisd/pesquisas-eleitorais-br/blob/main/docs/MODELS.md" target="_blank" rel="noopener">docs/MODELS.md</a>.</p>
  </details>

  <p class="meto-foot">Site estático, sem fins partidários.</p>
  <p id="projMethodology"></p>
</section>`
}
