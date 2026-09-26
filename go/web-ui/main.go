package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"html"
	"sort"
	"strconv"
	"strings"
	"syscall/js"
	"time"
)

type Poll struct {
	Institute       string     `json:"institute"`
	FieldworkStart  string     `json:"fieldwork_start"`
	FieldworkEnd    string     `json:"fieldwork_end"`
	PublishedDate   string     `json:"published_date"`
	Scenario        string     `json:"scenario"`
	Candidates      []Candidate `json:"candidates"`
	N               int        `json:"n"`
	MarginOfError   string     `json:"margin_of_error"`
	SourceURL       string     `json:"source_url"`
	MethodologyNote string     `json:"methodology_note"`
	Verified        bool       `json:"verified"`
	TSERegistration string     `json:"tse_registration"`
	Geo             string     `json:"geo"`
}

type Candidate struct {
	Name       string  `json:"name"`
	Party      *string `json:"party_optional"`
	Percentage float64 `json:"pct"`
}

type Meta struct {
	LastUpdated           string `json:"last_updated"`
	LatestPublicationDate string `json:"latest_publication_date"`
	LastCheckAt           string `json:"last_check_at"`
	RecordCount           int    `json:"record_count"`
	ContentHash           string `json:"content_hash"`
}

var (
	//go:embed data/polls.json
	pollsJSON []byte
	//go:embed data/meta.json
	metaJSON []byte
)

type state struct {
	round     int
	candidate string
	geo       string
	institute string
	query     string
}

var (
	polls     []Poll
	meta      Meta
	view      = state{round: 2, candidate: "Lula", geo: "ALL", institute: "ALL"}
	root      js.Value
	keepAlive []js.Func
)

func main() {
	if err := json.Unmarshal(pollsJSON, &polls); err != nil {
		panic(err)
	}
	_ = json.Unmarshal(metaJSON, &meta)

	root = js.Global().Get("document").Call("getElementById", "app")
	render()
	select {}
}

func render() {
	rows := filteredPolls()
	candidates := candidateNames()
	geos := geoNames()
	institutes := instituteNames()
	latest := latestPoll(rows)
	updated := firstNonEmpty(meta.LastUpdated, meta.LatestPublicationDate)

	var b strings.Builder
	b.WriteString("<header>")
	b.WriteString("<h1>Pesquisas eleitorais — Presidência 2026</h1>")
	b.WriteString("<p>Dados públicos de pesquisas. Interface reconstruída em Go/WebAssembly.</p>")
	b.WriteString("<p><strong>Atualização:</strong> " + esc(updated) + " · <strong>Registros:</strong> " + strconv.Itoa(len(polls)) + "</p>")
	b.WriteString("</header>")

	b.WriteString("<section><h2>Filtros</h2>")
	b.WriteString("<label>Turno <select id='round'>")
	for _, n := range []int{1, 2} {
		selected := ""
		if n == view.round {
			selected = " selected"
		}
		b.WriteString(fmt.Sprintf("<option value='%d'%s>%dº turno</option>", n, selected, n))
	}
	b.WriteString("</select></label> ")

	b.WriteString("<label>Candidato <select id='candidate'><option value='ALL'>Todos</option>")
	for _, n := range candidates {
		selected := ""
		if n == view.candidate {
			selected = " selected"
		}
		b.WriteString(fmt.Sprintf("<option value='%s'%s>%s</option>", esc(n), selected, esc(n)))
	}
	b.WriteString("</select></label> ")

	b.WriteString("<label>Geografia <select id='geo'><option value='ALL'>Brasil / todas</option>")
	for _, n := range geos {
		selected := ""
		if n == view.geo {
			selected = " selected"
		}
		b.WriteString(fmt.Sprintf("<option value='%s'%s>%s</option>", esc(n), selected, esc(n)))
	}
	b.WriteString("</select></label> ")

	b.WriteString("<label>Instituto <select id='institute'><option value='ALL'>Todos</option>")
	for _, n := range institutes {
		selected := ""
		if n == view.institute {
			selected = " selected"
		}
		b.WriteString(fmt.Sprintf("<option value='%s'%s>%s</option>", esc(n), selected, esc(n)))
	}
	b.WriteString("</select></label> ")

	b.WriteString("<label>Busca <input id='query' value='" + esc(view.query) + "' placeholder='instituto, cenário, candidato…'></label> ")
	b.WriteString("<button id='reset'>Limpar</button></section>")

	b.WriteString("<section><h2>Resumo</h2><ul>")
	b.WriteString("<li>Pesquisas filtradas: <strong>" + strconv.Itoa(len(rows)) + "</strong></li>")
	b.WriteString("<li>Institutos no conjunto: <strong>" + strconv.Itoa(len(institutes)) + "</strong></li>")
	if latest != nil {
		b.WriteString("<li>Pesquisa mais recente: <strong>" + esc(latest.Institute) + "</strong> — " + esc(latest.FieldworkEnd) + "</li>")
	}
	b.WriteString("</ul></section>")

	b.WriteString("<section><h2>Tendência</h2>")
	b.WriteString(chartSVG(rows))
	b.WriteString("</section>")

	b.WriteString("<section><h2>Pesquisas</h2>")
	b.WriteString("<p>Exibindo até 100 registros mais recentes do filtro atual.</p>")
	b.WriteString("<table border='1' cellpadding='6' cellspacing='0'><thead><tr><th>Data</th><th>Instituto</th><th>Cenário</th><th>Candidato</th><th>%</th><th>Fonte</th></tr></thead><tbody>")
	shown := 0
	for _, p := range rows {
		for _, c := range p.Candidates {
			if view.candidate != "ALL" && c.Name != view.candidate {
				continue
			}
			b.WriteString("<tr><td>" + esc(p.FieldworkEnd) + "</td><td>" + esc(p.Institute) + "</td><td>" + esc(p.Scenario) + "</td><td>" + esc(c.Name) + "</td><td>" + fmt.Sprintf("%.1f", c.Percentage) + "</td><td><a href='" + esc(p.SourceURL) + "' target='_blank' rel='noopener'>fonte</a></td></tr>")
			shown++
			if shown >= 100 {
				break
			}
		}
		if shown >= 100 {
			break
		}
	}
	if shown == 0 {
		b.WriteString("<tr><td colspan='6'>Nenhuma pesquisa corresponde aos filtros.</td></tr>")
	}
	b.WriteString("</tbody></table></section>")

	b.WriteString("<section><details><summary>Metodologia e proveniência</summary>")
	if latest != nil {
		b.WriteString("<p><strong>Última fonte:</strong> " + esc(latest.Institute) + " — " + esc(latest.FieldworkEnd) + ".</p>")
		b.WriteString("<p>" + esc(latest.MethodologyNote) + "</p>")
		b.WriteString("<p>TSE: " + esc(latest.TSERegistration) + " · Verificado: " + strconv.FormatBool(latest.Verified) + "</p>")
	}
	b.WriteString("<p>Hash do conjunto publicado: <code>" + esc(meta.ContentHash) + "</code></p>")
	b.WriteString("</details></section>")
	b.WriteString("<footer><p>Build: Go WebAssembly · GitHub Pages static artifact.</p></footer>")

	root.Set("innerHTML", b.String())

	bind("round", func(v string) {
		view.round, _ = strconv.Atoi(v)
		render()
	})
	bind("candidate", func(v string) {
		view.candidate = v
		render()
	})
	bind("geo", func(v string) {
		view.geo = v
		render()
	})
	bind("institute", func(v string) {
		view.institute = v
		render()
	})
	bind("query", func(v string) {
		view.query = v
		render()
	})
	bindButton("reset", func() {
		view = state{round: 2, candidate: "Lula", geo: "ALL", institute: "ALL"}
		render()
	})
}

func bind(id string, change func(string)) {
	el := js.Global().Get("document").Call("getElementById", id)
	if !el.Truthy() {
		return
	}
	fn := js.FuncOf(func(this js.Value, args []js.Value) any {
		change(el.Get("value").String())
		return nil
	})
	keepAlive = append(keepAlive, fn)
	el.Call("addEventListener", "change", fn)
	if id == "query" {
		el.Call("addEventListener", "input", fn)
	}
}

func bindButton(id string, click func()) {
	el := js.Global().Get("document").Call("getElementById", id)
	if !el.Truthy() {
		return
	}
	fn := js.FuncOf(func(this js.Value, args []js.Value) any {
		click()
		return nil
	})
	keepAlive = append(keepAlive, fn)
	el.Call("addEventListener", "click", fn)
}

func filteredPolls() []Poll {
	out := make([]Poll, 0, len(polls))
	q := strings.ToLower(strings.TrimSpace(view.query))
	for _, p := range polls {
		if view.round != 0 && pollRound(p) != view.round {
			continue
		}
		if view.geo != "ALL" && p.Geo != view.geo {
			continue
		}
		if view.institute != "ALL" && p.Institute != view.institute {
			continue
		}
		if q != "" {
			hay := strings.ToLower(strings.Join([]string{p.Institute, p.Scenario, p.Geo, p.FieldworkEnd, p.TSERegistration}, " "))
			found := strings.Contains(hay, q)
			if !found {
				for _, c := range p.Candidates {
					if strings.Contains(strings.ToLower(c.Name), q) {
						found = true
						break
					}
				}
			}
			if !found {
				continue
			}
		}
		if view.candidate != "ALL" {
			found := false
			for _, c := range p.Candidates {
				if c.Name == view.candidate {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].FieldworkEnd == out[j].FieldworkEnd {
			return out[i].Institute < out[j].Institute
		}
		return out[i].FieldworkEnd > out[j].FieldworkEnd
	})
	return out
}

func pollRound(p Poll) int {
	if strings.Contains(p.Scenario, "2º turno") || strings.Contains(p.Scenario, "2° turno") {
		return 2
	}
	return 1
}

func candidateNames() []string {
	set := map[string]bool{}
	for _, p := range polls {
		for _, c := range p.Candidates {
			set[c.Name] = true
		}
	}
	return sortedKeys(set)
}

func geoNames() []string {
	set := map[string]bool{}
	for _, p := range polls {
		if p.Geo != "" {
			set[p.Geo] = true
		}
	}
	return sortedKeys(set)
}

func instituteNames() []string {
	set := map[string]bool{}
	for _, p := range polls {
		if p.Institute != "" {
			set[p.Institute] = true
		}
	}
	return sortedKeys(set)
}

func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for n := range set {
		out = append(out, n)
	}
	sort.Strings(out)
	return out
}

func latestPoll(rows []Poll) *Poll {
	if len(rows) == 0 {
		return nil
	}
	return &rows[0]
}

func chartSVG(rows []Poll) string {
	if len(rows) == 0 {
		return "<p>Sem dados para o gráfico.</p>"
	}

	const width, height = 900, 360
	const left, right, top, bottom = 55, 20, 20, 45
	minDay, maxDay := rows[len(rows)-1].FieldworkEnd, rows[0].FieldworkEnd
	points := map[string][]string{}

	for _, p := range rows {
		for _, c := range p.Candidates {
			if view.candidate != "ALL" && c.Name != view.candidate {
				continue
			}
			x := 0.0
			span := dateDistance(minDay, maxDay)
			if span > 0 {
				x = float64(dateDistance(minDay, p.FieldworkEnd)) / float64(span)
			}
			px := float64(left) + x*float64(width-left-right)
			py := float64(height-bottom) - (c.Percentage/60.0)*float64(height-top-bottom)
			points[c.Name] = append(points[c.Name], fmt.Sprintf("%.1f,%.1f", px, py))
		}
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d' width='100%%' height='%d' role='img' aria-label='Tendência das pesquisas'>", width, height, height))
	b.WriteString("<rect x='0' y='0' width='900' height='360' fill='white' stroke='black'/>")
	for _, pct := range []int{0, 20, 40, 60} {
		y := float64(height-bottom) - float64(pct)/60.0*float64(height-top-bottom)
		b.WriteString(fmt.Sprintf("<line x1='%d' y1='%.1f' x2='%d' y2='%.1f' stroke='#bbb'/>", left, y, width-right, y))
		b.WriteString(fmt.Sprintf("<text x='8' y='%.1f' font-size='12'>%d%%</text>", y+4, pct))
	}

	names := make([]string, 0, len(points))
	for n := range points {
		names = append(names, n)
	}
	sort.Strings(names)
	for i, n := range names {
		b.WriteString(fmt.Sprintf("<polyline fill='none' stroke='hsl(%d 65%% 40%%)' stroke-width='2' points='%s'/>", (i*83)%360, strings.Join(points[n], " ")))
		b.WriteString(fmt.Sprintf("<text x='%d' y='%d' font-size='12'>%s</text>", left+10, 18+i*16, esc(n)))
	}
	b.WriteString(fmt.Sprintf("<line x1='%d' y1='%d' x2='%d' y2='%d' stroke='black'/>", left, height-bottom, width-right, height-bottom))
	b.WriteString("</svg>")
	return b.String()
}

func dateDistance(a, b string) int {
	aa, errA := time.Parse("2006-01-02", a)
	bb, errB := time.Parse("2006-01-02", b)
	if errA != nil || errB != nil {
		return 0
	}
	return int(bb.Sub(aa).Hours() / 24)
}

func esc(s string) string {
	return html.EscapeString(s)
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return "—"
}
