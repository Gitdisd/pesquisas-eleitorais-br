package main

import (
	_ "embed"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html"
	"math"
	"sort"
	"strconv"
	"strings"
	"syscall/js"
	"time"
)

type CandidateResult struct {
	Name       string  `json:"name"`
	Party      *string `json:"party_optional"`
	Percentage float64 `json:"pct"`
}
type Poll struct {
	Institute       string            `json:"institute"`
	FieldworkStart  string            `json:"fieldwork_start"`
	FieldworkEnd    string            `json:"fieldwork_end"`
	PublishedDate   string            `json:"published_date"`
	Scenario        string            `json:"scenario"`
	Candidates      []CandidateResult `json:"candidates"`
	N               float64           `json:"n"`
	MarginOfError   string            `json:"margin_of_error"`
	SourceURL       string            `json:"source_url"`
	MethodologyNote string            `json:"methodology_note"`
	Verified        bool              `json:"verified"`
	TSERegistration string            `json:"tse_registration"`
	TSEProtocol     string            `json:"tse_protocol"`
	Geo             string            `json:"geo"`
	Flag            string            `json:"flag"`
}
type Meta struct {
	SchemaVersion         int    `json:"schema_version"`
	LastUpdated           string `json:"last_updated"`
	LatestPublicationDate string `json:"latest_publication_date"`
	LatestFieldworkEnd    string `json:"latest_fieldwork_end"`
	LastCheckAt           string `json:"last_check_at"`
	RecordCount           int    `json:"record_count"`
	ContentHash           string `json:"content_hash"`
}
type state struct {
	Round int
	Candidate string
	Geo string
	Institutes map[string]bool
	TableQuery string
	RangeDays int
	WindowDays int
	Model int
	Projection bool
	Language string
	Theme string
	Hidden map[string]bool
	Overlays map[string]bool
	SelectedPoll string
	Zoom float64
	RegionalRound int
	RegionalGeos map[string]bool
	Status string
}

var (
	//go:embed data/polls.json
	pollsJSON []byte
	//go:embed data/meta.json
	metaJSON []byte
	//go:embed data/polls-extra.json
	extraJSON []byte
	//go:embed data/polls-regional.json
	regionalJSON []byte

	polls []Poll
	regionalPolls []Poll
	meta Meta
	view state
	root js.Value
)

func main() {
	if err := json.Unmarshal(pollsJSON, &polls); err != nil { panic(err) }
	var extra []Poll
	_ = json.Unmarshal(extraJSON, &extra)
	_ = json.Unmarshal(regionalJSON, &regionalPolls)
	_ = json.Unmarshal(metaJSON, &meta)
	polls = mergePolls(polls, extra)
	view = restoreState()
	root = doc().Call("getElementById", "app")
	setLanguageDoc(view.Language)
	render()
	select {}
}

func defaultState() state {
	return state{
		Round: 1, Candidate: "Lula", Geo: "ALL", Institutes: map[string]bool{},
		RangeDays: 30, WindowDays: 14, Model: 1, Language: "pt-BR", Theme: "light",
		Hidden: map[string]bool{}, Overlays: map[string]bool{}, Zoom: 1,
		RegionalRound: 1, RegionalGeos: map[string]bool{},
	}
}
func restoreState() state {
	s := defaultState()
	q := queryParams()
	if n, e := strconv.Atoi(q.Get("round")); e == nil && (n == 1 || n == 2) { s.Round = n }
	if v := q.Get("candidate"); v != "" { s.Candidate = v }
	if v := q.Get("geo"); v != "" { s.Geo = v }
	if q.Get("range") == "all" { s.RangeDays = 0 } else if n, e := strconv.Atoi(q.Get("range")); e == nil && n > 0 { s.RangeDays = n }
	if q.Get("window") == "ytd" { s.WindowDays = 365 } else if n, e := strconv.Atoi(q.Get("window")); e == nil && n > 0 { s.WindowDays = n }
	if n, e := strconv.Atoi(q.Get("model")); e == nil && n >= 1 && n <= 12 { s.Model = n }
	if q.Get("projection") == "1" || strings.EqualFold(q.Get("projection"), "true") { s.Projection = true }
	if v := q.Get("institutes"); v != "" {
		for _, x := range strings.Split(v, ",") { if x = strings.TrimSpace(x); x != "" { s.Institutes[x] = true } }
	}
	if q.Get("lang") == "en" || localGet("pebr-language") == "en" { s.Language = "en" }
	if t := localGet("pebr-theme"); t != "" { s.Theme = t }
	if n, e := strconv.Atoi(localGet("pebr-model")); e == nil && n >= 1 && n <= 12 { if q.Get("model") == "" { s.Model = n } }
	if n, e := strconv.Atoi(localGet("pebr-window")); e == nil && n > 0 && q.Get("window") == "" { s.WindowDays = n }
	s.Hidden = loadJSONMap("pebr-hidden")
	s.Overlays = loadJSONMap("pebr-overlays")
	return s
}

func mergePolls(base, extra []Poll) []Poll {
	out := append([]Poll(nil), base...)
	index := map[string]int{}
	for i, p := range out { index[pollID(p)] = i }
	for _, p := range extra {
		id := pollID(p)
		if i, ok := index[id]; ok { out[i] = mergePoll(out[i], p) } else { index[id] = len(out); out = append(out, p) }
	}
	sortPolls(out)
	return out
}
func mergePoll(a, b Poll) Poll {
	if a.SourceURL == "" { a.SourceURL = b.SourceURL }
	if a.MethodologyNote == "" { a.MethodologyNote = b.MethodologyNote }
	if a.PublishedDate == "" || (b.PublishedDate != "" && b.PublishedDate < a.PublishedDate) { a.PublishedDate = b.PublishedDate }
	if a.FieldworkStart == "" { a.FieldworkStart = b.FieldworkStart }
	if a.Geo == "" { a.Geo = b.Geo }
	if a.TSERegistration == "" { a.TSERegistration = b.TSERegistration }
	if a.TSEProtocol == "" { a.TSEProtocol = b.TSEProtocol }
	if a.Flag == "" { a.Flag = b.Flag }
	a.Verified = a.Verified || b.Verified
	seen := map[string]bool{}
	for _, c := range a.Candidates { seen[normalizeCandidate(c.Name)] = true }
	for _, c := range b.Candidates { if !seen[normalizeCandidate(c.Name)] { a.Candidates = append(a.Candidates, c) } }
	return a
}
func pollID(p Poll) string {
	key := firstNonEmpty(p.TSERegistration, p.TSEProtocol)
	if key != "—" && key != "" { return key + "|" + p.Scenario + "|" + p.Geo }
	return p.Institute + "|" + p.FieldworkStart + "|" + p.FieldworkEnd + "|" + p.Scenario + "|" + p.Geo
}
func parseMoe(s string) float64 {
	var b strings.Builder
	for _, r := range s { if (r >= '0' && r <= '9') || r == ',' || r == '.' { b.WriteRune(r) } }
	v, _ := strconv.ParseFloat(strings.ReplaceAll(b.String(), ",", "."), 64)
	return v
}
func pollPoints(p Poll, key string) []TrendPoint {
	d, ok := parseDay(p.FieldworkEnd); if !ok { return nil }
	for _, c := range p.Candidates {
		if normalizeCandidate(c.Name) == key { return []TrendPoint{{T:d, Y:c.Percentage, N:p.N, Moe:parseMoe(p.MarginOfError), Institute:p.Institute, PollID:pollID(p)}} }
	}
	return nil
}
func pollRound(p Poll) int {
	s := strings.ToLower(p.Scenario)
	if strings.Contains(s, "2º turno") || strings.Contains(s, "2° turno") || strings.Contains(s, "2o turno") || strings.Contains(s, "2o turno") { return 2 }
	return 1
}
func sortPolls(rows []Poll) {
	sort.Slice(rows, func(i,j int) bool {
		if rows[i].FieldworkEnd == rows[j].FieldworkEnd { return rows[i].Institute < rows[j].Institute }
		return rows[i].FieldworkEnd > rows[j].FieldworkEnd
	})
}
func uniquePolls(rows []Poll, round int) int {
	set := map[string]bool{}
	for _, p := range rows { if round == 0 || pollRound(p) == round { set[pollID(p)] = true } }
	return len(set)
}
func trendForCandidate(rows []Poll, key string, round int, geo string, inst map[string]bool) []TrendPoint {
	out := []TrendPoint{}
	for _, p := range rows {
		if pollRound(p) != round || (geo != "ALL" && p.Geo != geo) || (len(inst) > 0 && !inst[p.Institute]) { continue }
		out = append(out, pollPoints(p,key)...)
	}
	sort.Slice(out, func(i,j int) bool { return out[i].T < out[j].T })
	return out
}
func uniqueStrings(rows []Poll, f func(Poll) string) []string {
	set := map[string]bool{}
	for _, p := range rows { if v:=f(p); v!="" { set[v]=true } }
	out:=make([]string,0,len(set)); for v:=range set { out=append(out,v) }; sortStrings(out); return out
}
func allCandidateKeys(round int) []string {
	if round == 2 { return []string{"Lula","Flávio Bolsonaro","Branco/Nulo"} }
	return candidateKeys()
}
func firstNonEmpty(v ...string) string {
	for _, x := range v { if strings.TrimSpace(x)!="" { return x } }
	return "—"
}
func esc(s string) string { return html.EscapeString(s) }
func fmtPct(v float64, ok bool) string { if !ok || math.IsNaN(v) { return "—" }; return fmt.Sprintf("%.2f%%",v) }
func formatDate(s string) string { if len(s)>=10 { return s[8:10]+"/"+s[5:7]+"/"+s[:4] }; return s }
func tr(en bool, pt, enText string) string { if en { return enText }; return pt }
func checkedAttr(on bool) string { if on { return " checked" }; return "" }
func themeColors(theme string) (string,string,string,string) {
	switch theme {
	case "dark": return "#0f172a","#1e293b","#f8fafc","#94a3b8"
	case "crt-amber": return "#211307","#33200c","#ffd166","#d6a64f"
	case "crt-green": return "#04170a","#0b2814","#d9ffe2","#70d08a"
	case "pt": return "#4a0b16","#6b1020","#fff8f6","#f3c4c8"
	case "pl": return "#161636","#22225a","#ffe9a0","#d4c07a"
	case "missao": return "#111","#1c1c1c","#fcbe26","#d7a31c"
	case "psd": return "#2a1600","#3d2200","#ffe4b0","#e0b46a"
	case "novo": return "#1c0d04","#2c1608","#ffe8d6","#f0b48a"
	case "avante": return "#062022","#0a3034","#e8ffff","#9ad4d8"
	default: return "#f5f7fa","#fff","#111827","#667085"
	}
}
func candidateColor(k string) string {
	return map[string]string{
		"Lula":"#c62828","Flávio Bolsonaro":"#1565c0","Augusto Cury":"#b45309",
		"Ronaldo Caiado":"#4d7c0f","Renan Santos":"#6d28d9","Romeu Zema":"#ea580c",
		"Samara Martins":"#0284c7","Hertz Dias":"#475569","Edmilson Costa":"#9f1239",
		"Rui Costa Pimenta":"#0f766e","Clariana Barão":"#7c3aed",
		"Veterinário Wilson Grassi":"#57534e","Branco/Nulo":"#64748b",
	}[k]
}

func render() {
	releaseCallbacks()
	if !root.Truthy() { return }
	root.Set("innerHTML", renderPage())
	bindControls()
}
func selectControl(id,label string, vals,labs []string, selected string) string {
	var b strings.Builder
	b.WriteString("<label>"+esc(label)+" <select id='"+esc(id)+"'>")
	for i,v := range vals { sel:=""; if v==selected {sel=" selected"}; b.WriteString("<option value='"+esc(v)+"'"+sel+">"+esc(labs[i])+"</option>") }
	b.WriteString("</select></label> ")
	return b.String()
}
func renderPage() string {
	en:=view.Language=="en"; bg,surface,fg,muted:=themeColors(view.Theme)
	rows:=nationalRows(); insts:=uniqueStrings(polls,func(p Poll)string{return p.Institute}); geos:=uniqueStrings(polls,func(p Poll)string{return p.Geo})
	var b strings.Builder
	b.WriteString(fmt.Sprintf("<div id='appFrame' style='font-family:system-ui,sans-serif;max-width:1480px;margin:auto;padding:18px;background:%s;color:%s;min-height:100vh;line-height:1.45'>",bg,fg))
	b.WriteString("<header><h1>Pesquisas eleitorais — Presidência 2026</h1>")
	b.WriteString("<p>"+tr(en,"Painel público de pesquisas, modelos e metodologia.","Public polling dashboard, models and methodology.")+"</p>")
	b.WriteString(fmt.Sprintf("<p><b>%s:</b> %s · <b>%s:</b> %d · <b>%s:</b> %s</p>",
		tr(en,"Atualizado","Updated"),esc(firstNonEmpty(meta.LastUpdated,meta.LatestPublicationDate)),
		tr(en,"Registros","Records"),len(polls),tr(en,"Último campo","Latest fieldwork"),esc(firstNonEmpty(meta.LatestFieldworkEnd,"—"))))
	b.WriteString("<nav><a href='#overview'>Visão geral</a> · <a href='#chartPanel'>Gráfico</a> · <a href='#cards'>Resumo</a> · <a href='#pollsPanel'>Pesquisas</a> · <a href='#allSourcesPanel'>Regional</a> · <a href='#methodology'>Metodologia</a></nav>")
	b.WriteString("<fieldset><legend>Interface</legend><button data-action='lang' data-value='pt-BR'>Português</button> <button data-action='lang' data-value='en'>English</button> <label>Tema <select id='theme'>")
	themes:=[]struct{ID,Label string}{{"light","Claro / Light"},{"dark","Escuro / Dark"},{"crt-amber","CRT âmbar"},{"crt-green","CRT verde"},{"pt","PT"},{"pl","PL"},{"missao","Missão"},{"psd","PSD"},{"novo","Novo"},{"avante","Avante"}}
	for _,t:=range themes { sel:=""; if t.ID==view.Theme {sel=" selected"}; b.WriteString("<option value='"+t.ID+"'"+sel+">"+esc(t.Label)+"</option>") }
	b.WriteString("</select></label> <button data-action='refresh'>↻ Atualizar</button></fieldset></header>")

	b.WriteString(fmt.Sprintf("<section id='overview'><h2>%s</h2><div style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px'>",tr(en,"Visão geral","Overview")))
	metrics:=[]string{fmt.Sprintf("<b>Pesquisas publicadas</b><br>%d",uniquePolls(polls,0)),fmt.Sprintf("<b>Institutos</b><br>%d",len(insts)),fmt.Sprintf("<b>Último campo</b><br>%s",esc(firstNonEmpty(meta.LatestFieldworkEnd,"—"))),fmt.Sprintf("<b>Cobertura</b><br>%d / %d",uniquePolls(polls,1),uniquePolls(polls,2))}
	for _,m:=range metrics { b.WriteString("<article style='background:"+surface+";padding:12px;border:1px solid "+muted+";border-radius:8px'>"+m+"</article>") }
	b.WriteString("</div></section>")

	b.WriteString("<section id='chartPanel'><h2>"+tr(en,"Evolução da intenção de voto","Voting intention over time")+"</h2>")
	b.WriteString("<fieldset><legend>Controles</legend>")
	b.WriteString(selectControl("round","Turno",[]string{"1","2"},[]string{"1º turno","2º turno"},strconv.Itoa(view.Round)))
	gVals:=append([]string{"ALL"},geos...); gLabs:=append([]string{tr(en,"Todas","All")},geos...); b.WriteString(selectControl("geo","Geografia",gVals,gLabs,view.Geo))
	cVals:=append([]string{"ALL"},allCandidateKeys(view.Round)...); cLabs:=append([]string{tr(en,"Todos","All")},allCandidateKeys(view.Round)...); b.WriteString(selectControl("candidate","Candidato",cVals,cLabs,view.Candidate))
	b.WriteString(selectControl("range","Período",[]string{"1","3","7","14","21","30","90","0"},[]string{"1d","3d","7d","14d","21d","30d","90d","tudo"},strconv.Itoa(view.RangeDays)))
	b.WriteString(selectControl("window","Janela",[]string{"7","14","30","90","365"},[]string{"7d","14d","30d","90d","YTD"},strconv.Itoa(view.WindowDays)))
	b.WriteString(selectControl("model","Modelo",modelValueList(),modelLabelList(),strconv.Itoa(view.Model)))
	b.WriteString(fmt.Sprintf("<label>Janela custom <input id='windowCustom' type='number' min='1' value='%d'></label>",view.WindowDays))
	b.WriteString("<label><input id='projection' type='checkbox'"+checkedAttr(view.Projection)+"> Projeção</label></fieldset>")

	b.WriteString("<fieldset><legend>Institutos</legend><label><input data-action='institutes-all' type='checkbox'"+checkedAttr(len(view.Institutes)==0)+"> todos</label> ")
	for _,n:=range insts { b.WriteString("<label><input data-action='institute' data-name='"+esc(n)+"' type='checkbox'"+checkedAttr(len(view.Institutes)==0 || view.Institutes[n])+"> "+esc(n)+"</label> ") }
	b.WriteString("</fieldset><fieldset><legend>Linhas</legend>")
	for _,k:=range allCandidateKeys(view.Round) { b.WriteString("<label><input data-action='hidden' data-name='"+esc(k)+"' type='checkbox'"+checkedAttr(!view.Hidden[k])+"> "+esc(k)+"</label> ") }
	b.WriteString("</fieldset><fieldset><legend>Overlays</legend>")
	for _,o:=range overlayOptions() { b.WriteString("<label><input data-action='overlay' data-name='"+o.ID+"' type='checkbox'"+checkedAttr(view.Overlays[o.ID])+"> "+esc(o.Label)+"</label> ") }
	b.WriteString("</fieldset>")
	b.WriteString("<p><button data-action='zoom-out'>−</button> <button data-action='zoom-in'>+</button> <button data-action='zoom-reset'>Resetar eixos</button> <button data-action='fullscreen'>⛶ Tela cheia</button> <button data-action='share'>Copiar link</button> <button data-action='csv'>CSV</button> <button data-action='json'>JSON</button></p>")
	if view.Status!="" { b.WriteString("<p role='status'><b>"+esc(view.Status)+"</b></p>") }
	b.WriteString(fmt.Sprintf("<p style='color:%s'>Modelo %d · Zoom %.1fx · %s</p>",muted,view.Model,view.Zoom,tr(en,"A faixa é estimada e não substitui a margem de erro individual.","The band is estimated and is not the individual poll margin of error.")))
	b.WriteString(chartSVG())
	if view.SelectedPoll!="" { b.WriteString(renderSelectedPoll(view.SelectedPoll,en)) }
	b.WriteString("</section>")
	b.WriteString(renderCards())
	b.WriteString(fmt.Sprintf("<section id='pollsPanel'><h2>%s</h2><input id='tableQuery' value='%s' placeholder='%s'> <span>%d registros filtrados</span>",tr(en,"Resultados das pesquisas","Poll results"),esc(view.TableQuery),tr(en,"instituto, cenário, campo, TSE…","pollster, scenario, fieldwork, TSE…"),len(rows)))
	b.WriteString(renderTable(rows,view.Round,surface,en)+"</section>")
	if len(regionalPolls)>0 { b.WriteString(renderRegional(surface,en)) }
	b.WriteString(renderMethodology(en))
	b.WriteString("<footer><hr><p>Site estático · GitHub Pages · dados e métodos documentados no repositório.</p></footer></div>")
	return b.String()
}
func nationalRows() []Poll {
	out:=[]Poll{}
	q:=strings.ToLower(strings.TrimSpace(view.TableQuery))
	for _,p:=range polls {
		if pollRound(p)!=view.Round || (view.Geo!="ALL" && p.Geo!=view.Geo) || (len(view.Institutes)>0 && !view.Institutes[p.Institute]) { continue }
		if view.Candidate!="ALL" {
			found:=false; for _,c:=range p.Candidates { if normalizeCandidate(c.Name)==view.Candidate {found=true;break} }; if !found {continue}
		}
		if q!="" {
			hay:=strings.ToLower(p.Institute+" "+p.Scenario+" "+p.Geo+" "+p.FieldworkEnd+" "+p.PublishedDate+" "+p.TSERegistration+" "+p.MethodologyNote)
			ok:=strings.Contains(hay,q); if !ok { for _,c:=range p.Candidates { if strings.Contains(strings.ToLower(c.Name),q){ok=true;break} } }; if !ok {continue}
		}
		out=append(out,p)
	}
	sortPolls(out); return out
}
func modelValueList() []string { out:=[]string{}; for _,m:=range modelOptions(){out=append(out,strconv.Itoa(m.ID))}; return out }
func modelLabelList() []string { out:=[]string{}; for _,m:=range modelOptions(){out=append(out,m.Label)}; return out }

func chartSVG() string {
	type sData struct{ key string; raw []TrendPoint; trend []SeriesPoint; band []UncertaintyPoint; proj,pl,ph []SeriesPoint; overlays []OverlayResult }
	series:=[]sData{}; minD:=int64(1<<62); maxD:=int64(-1<<62); maxY:=25.0
	for _,k:=range allCandidateKeys(view.Round) {
		if view.Hidden[k] {continue}
		raw:=trendForCandidate(polls,k,view.Round,view.Geo,view.Institutes); if len(raw)==0 {continue}
		tr:=averageTrend(raw,float64(view.WindowDays),view.Model); bd:=uncertaintyBand(raw,float64(view.WindowDays),1.645)
		if raw[0].T<minD {minD=raw[0].T}; if raw[len(raw)-1].T>maxD {maxD=raw[len(raw)-1].T}
		for _,p:=range raw {if p.Y>maxY {maxY=p.Y}}; for _,p:=range tr {if p.Y>maxY {maxY=p.Y}}; for _,p:=range bd {if p.High>maxY {maxY=p.High}}
		var proj,pl,ph []SeriesPoint
		if view.Projection {
			election:=electionRound1MS; if view.Round==2 {election=electionRound2MS}
			if view.Model==1 { ok,_,l,lo,hi,_,_,_:=projectTrend(tr,max(7,view.WindowDays),14,election,0.12,2,0.25); if ok {proj,pl,ph=l,lo,hi} }
			if view.Model==2 { ok,_,l,lo,hi,_,_,_,hold,_:=projectionV2(raw,14,14,election); if ok&&hold {proj,pl,ph=l,lo,hi} }
		}
		ov:=[]OverlayResult{}; for _,o:=range overlayOptions(){if view.Overlays[o.ID]{r:=computeOverlay(o.ID,tr,raw);if len(r.Mid)>0 {ov=append(ov,r)}}}
		series=append(series,sData{k,raw,tr,bd,proj,pl,ph,ov})
	}
	if len(series)==0 {return "<p>Sem dados para o gráfico.</p>"}
	if view.RangeDays>0 {minD=maxI64(minD,maxD-int64(view.RangeDays)*dayMS)}
	maxX:=maxD+dayMS; if view.Projection {maxX+=14*dayMS}
	c:=(float64(minD)+float64(maxX))/2; span:=math.Max(7,(float64(maxX)-float64(minD))/math.Max(1,view.Zoom)); minD=int64(c-span/2); maxX=int64(c+span/2)
	width,height,left,right,top,bottom:=1200.0,460.0,70.0,35.0,25.0,55.0
	yLow,yHigh:=0.0,math.Min(100,math.Max(50,maxY*1.1))
	xf:=func(t int64)float64{return left+(float64(t)-float64(minD))/math.Max(1,float64(maxX-minD))*(width-left-right)}
	yf:=func(v float64)float64{return top+(1-(v-yLow)/math.Max(1,yHigh-yLow))*(height-top-bottom)}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("<svg id='chart' viewBox='0 0 %.0f %.0f' width='100%%' height='460' role='img' aria-label='Tendência de intenção de voto'>",width,height))
	b.WriteString(fmt.Sprintf("<rect x='0' y='0' width='%.0f' height='%.0f' fill='none' stroke='#777'/>",width,height))
	for i:=0;i<=5;i++{v:=yHigh-float64(i)/5*(yHigh-yLow);y:=yf(v);b.WriteString(fmt.Sprintf("<line x1='%f' x2='%f' y1='%f' y2='%f' stroke='#ddd'/><text x='8' y='%f' font-size='12'>%.0f%%</text>",left,width-right,y,y,y+4,v))}
	for _,s:=range series {
		col:=candidateColor(s.key); if col=="" {col="#444"}
		if len(s.band)>1 {low,high:=[]string{},[]string{};for _,p:=range s.band{if p.X>=minD&&p.X<=maxX{low=append(low,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Low)));high=append(high,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.High)))}};if len(low)>1{pts:=append(low,reverseStrings(high)...);b.WriteString(fmt.Sprintf("<polygon points='%s' fill='%s' opacity='.10' stroke='none'/>",strings.Join(pts," "),col))}}
		if len(s.trend)>1 {pts:=[]string{};for _,p:=range s.trend{if p.X>=minD&&p.X<=maxX{pts=append(pts,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)))}};if len(pts)>1{b.WriteString(fmt.Sprintf("<polyline fill='none' stroke='%s' stroke-width='3' points='%s'/>",col,strings.Join(pts," ")))}}
		for _,p:=range s.raw{if p.T<minD||p.T>maxX{continue};b.WriteString(fmt.Sprintf("<circle data-poll-id='%s' cx='%.1f' cy='%.1f' r='4' fill='#fff' stroke='%s'><title>%s · %.2f%% · %s</title></circle>",esc(p.PollID),xf(p.T),yf(p.Y),col,esc(s.key),p.Y,esc(p.Institute)))}
		if len(s.pl)>1 && len(s.ph)==len(s.pl){low,high:=[]string{},[]string{};for i,p:=range s.pl{if p.X>=minD&&p.X<=maxX{low=append(low,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)));high=append(high,fmt.Sprintf("%.1f,%.1f",xf(s.ph[i].X),yf(s.ph[i].Y)))}};if len(low)>1{pts:=append(low,reverseStrings(high)...);b.WriteString(fmt.Sprintf("<polygon points='%s' fill='%s' opacity='.08' stroke='none'/>",strings.Join(pts," "),col))}}
		if len(s.proj)>1{pts:=[]string{};for _,p:=range s.proj{pts=append(pts,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)))};b.WriteString(fmt.Sprintf("<polyline fill='none' stroke='%s' stroke-width='2' stroke-dasharray='8 6' points='%s'/>",col,strings.Join(pts," ")))}
		for _,o:=range s.overlays{pts:=[]string{};for _,p:=range o.Mid{if p.X>=minD&&p.X<=maxX{pts=append(pts,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)))}};if len(pts)>1{b.WriteString(fmt.Sprintf("<polyline fill='none' stroke='#333' stroke-width='1.5' opacity='.7' points='%s'/>",strings.Join(pts," "))) };if len(o.Low)>1&&len(o.High)==len(o.Low){low,high:=[]string{},[]string{};for i,p:=range o.Low{if p.X>=minD&&p.X<=maxX{low=append(low,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)));high=append(high,fmt.Sprintf("%.1f,%.1f",xf(o.High[i].X),yf(o.High[i].Y)))}};if len(low)>1{pts:=append(low,reverseStrings(high)...);b.WriteString(fmt.Sprintf("<polygon points='%s' fill='#333' opacity='.06' stroke='none'/>",strings.Join(pts," ")))}}}
	}
	for i:=0;i<=4;i++{d:=minD+int64(float64(i)/4*float64(maxD-minD));b.WriteString(fmt.Sprintf("<text x='%f' y='%f' font-size='11' text-anchor='middle'>%s</text>",left+float64(i)/4*(width-left-right),height-10,formatDate(time.Unix(d/1000,0).UTC().Format("2006-01-02"))))}
	b.WriteString("</svg>"); return b.String()
}
func maxI64(a,b int64)int64{if a>b{return a};return b}
func reverseStrings(v []string)[]string{out:=append([]string(nil),v...);for i,j:=0,len(out)-1;i<j;i,j=i+1,j-1{out[i],out[j]=out[j],out[i]};return out}

func renderCards() string {
	var b strings.Builder; b.WriteString("<section id='cards'><h2>Resumo</h2><div style='display:flex;flex-wrap:wrap;gap:10px'>")
	for _,k:=range allCandidateKeys(view.Round){pts:=trendForCandidate(polls,k,view.Round,view.Geo,view.Institutes);tr:=averageTrend(pts,float64(view.WindowDays),view.Model);cur,ok:=trendAt(tr,latestT(pts));prior,ok2:=trendAt(tr,latestT(pts)-30*dayMS);delta:="—";if ok&&ok2{d:=cur-prior;sign:="";if d>0{sign="+"};delta=fmt.Sprintf("%s%.2f pp vs 30d",sign,d)}
		spark:=""; if len(tr)>1{last:=tr;if len(last)>8{last=last[len(last)-8:]};minV,maxV:=last[0].Y,last[0].Y;for _,p:=range last{minV=math.Min(minV,p.Y);maxV=math.Max(maxV,p.Y)};span:=math.Max(1,maxV-minV);pts:=[]string{};for i,p:=range last{x:=float64(i)/float64(len(last)-1)*100;y:=28-(p.Y-minV)/span*22;pts=append(pts,fmt.Sprintf("%.1f,%.1f",x,y))};spark="<svg viewBox='0 0 100 30' width='160' height='38'><polyline fill='none' stroke='"+candidateColor(k)+"' stroke-width='1.7' points='"+strings.Join(pts," ")+"'/></svg>"}
		b.WriteString("<article style='flex:1;min-width:190px;border:1px solid #aaa;border-top:4px solid "+candidateColor(k)+";padding:10px;border-radius:8px'><b>"+esc(k)+"</b><br><strong style='font-size:1.4em'>"+fmtPct(cur,ok)+"</strong><br><small>"+esc(delta)+" · média "+strconv.Itoa(view.WindowDays)+"d</small><br>"+spark+"</article>")
	}
	b.WriteString("</div></section>");return b.String()
}
func latestT(pts []TrendPoint)int64{if len(pts)==0{return 0};return pts[len(pts)-1].T}

func renderSelectedPoll(id string,en bool) string {
	for _,p:=range append(append([]Poll{},polls...),regionalPolls...){if pollID(p)==id{return fmt.Sprintf("<aside style='border:1px solid #aaa;padding:12px;margin-top:10px'><h3>%s</h3><p><b>%s</b> · %s · %s · %s</p><p>%s</p><p>TSE: %s · N: %.0f · %s</p><p><a href='%s' target='_blank' rel='noopener'>%s</a></p></aside>",
		tr(en,"Pesquisa selecionada","Selected poll"),esc(p.Institute),esc(p.Geo),esc(formatDate(p.FieldworkEnd)),esc(p.Scenario),esc(firstNonEmpty(p.MethodologyNote,"—")),esc(firstNonEmpty(p.TSERegistration,p.TSEProtocol)),p.N,esc(firstNonEmpty(p.MarginOfError,"—")),safeURL(p.SourceURL),tr(en,"abrir fonte","open source"))}}
	return ""
}
func renderTable(rows []Poll,round int,surface string,en bool) string {
	var b strings.Builder;b.WriteString("<div style='overflow:auto'><table border='1' cellpadding='6' cellspacing='0' bgcolor='"+surface+"'><thead><tr><th>Campo</th><th>Publicação</th><th>Instituto</th><th>Geo</th><th>Cenário</th><th>TSE</th>")
	for _,k:=range allCandidateKeys(round){b.WriteString("<th>"+esc(k)+"</th>")};b.WriteString("<th>N</th><th>Margem</th><th>Fonte</th></tr></thead><tbody>")
	n:=0;for _,p:=range rows{b.WriteString("<tr><td>"+esc(formatDate(p.FieldworkEnd))+"</td><td>"+esc(formatDate(p.PublishedDate))+"</td><td>"+esc(p.Institute)+"</td><td>"+esc(p.Geo)+"</td><td>"+esc(p.Scenario)+"</td><td>"+esc(firstNonEmpty(p.TSERegistration,p.TSEProtocol))+"</td>");for _,k:=range allCandidateKeys(round){v:="—";for _,c:=range p.Candidates{if normalizeCandidate(c.Name)==k{v=fmt.Sprintf("%.2f%%",c.Percentage)}};b.WriteString("<td align='right'>"+v+"</td>")};b.WriteString(fmt.Sprintf("<td align='right'>%.0f</td><td>%s</td><td><a href='%s' target='_blank' rel='noopener'>ver</a></td></tr>",p.N,esc(firstNonEmpty(p.MarginOfError,"—")),safeURL(p.SourceURL)));n++;if n>=160{break}}
	if n==0{b.WriteString("<tr><td colspan='20'>"+tr(en,"Nenhuma pesquisa corresponde.","No polls match.")+"</td></tr>")};b.WriteString("</tbody></table></div>");return b.String()
}
func safeURL(s string)string{low:=strings.ToLower(strings.TrimSpace(s));if strings.HasPrefix(low,"https://")||strings.HasPrefix(low,"http://"){return esc(s)};return "#"}

func renderRegional(surface string,en bool) string {
	rows:=[]Poll{};for _,p:=range regionalPolls{if pollRound(p)==view.RegionalRound&&(len(view.RegionalGeos)==0||view.RegionalGeos[p.Geo]){rows=append(rows,p)}};geos:=uniqueStrings(regionalPolls,func(p Poll)string{return p.Geo})
	var b strings.Builder;b.WriteString("<section id='allSourcesPanel'><h2>"+tr(en,"Todas as fontes (nacional + estados)","All sources (national + states)")+"</h2><p>"+tr(en,"O painel regional permanece separado do agregado nacional.","The regional panel remains separate from the national aggregate.")+"</p>")
	b.WriteString(selectControl("regionalRound","Turno regional",[]string{"1","2"},[]string{"1º turno","2º turno"},strconv.Itoa(view.RegionalRound)))
	b.WriteString("<fieldset><legend>Geografias</legend><label><input data-action='regional-all' type='checkbox'"+checkedAttr(len(view.RegionalGeos)==0)+"> todas</label> ")
	for _,g:=range geos{b.WriteString("<label><input data-action='regional-geo' data-name='"+esc(g)+"' type='checkbox'"+checkedAttr(len(view.RegionalGeos)==0||view.RegionalGeos[g])+"> "+esc(g)+"</label> ")}
	b.WriteString(fmt.Sprintf("</fieldset><p>%d observações</p>",len(rows)))
	b.WriteString(regionalChartSVG(rows));b.WriteString(renderTable(rows,view.RegionalRound,surface,en));b.WriteString("</section>");return b.String()
}
func regionalChartSVG(rows []Poll) string {
	keys:=allCandidateKeys(view.RegionalRound); minD:=int64(1<<62);maxD:=int64(-1<<62);maxY:=25.0;type sd struct{k string;r []TrendPoint;t []SeriesPoint};ss:=[]sd{}
	for _,k:=range keys{r:=trendForCandidate(rows,k,view.RegionalRound,"ALL",map[string]bool{});if len(r)==0{continue};t:=averageTrend(r,14,1);if r[0].T<minD{minD=r[0].T};if r[len(r)-1].T>maxD{maxD=r[len(r)-1].T};for _,p:=range r{maxY=math.Max(maxY,p.Y)};ss=append(ss,sd{k,r,t})}
	if len(ss)==0{return "<p>Sem dados regionais.</p>"};width,height,left,right,top,bottom:=1200.,400.,70.,35.,25.,50.;xf:=func(t int64)float64{return left+(float64(t-minD)/math.Max(1,float64(maxD-minD)))*(width-left-right)};hi:=math.Min(100,math.Max(50,maxY*1.1));yf:=func(v float64)float64{return top+(1-v/hi)*(height-top-bottom)}
	var b strings.Builder;b.WriteString(fmt.Sprintf("<svg id='regionalChart' viewBox='0 0 %.0f %.0f' width='100%%' height='400' role='img' aria-label='Gráfico regional'>",width,height));b.WriteString(fmt.Sprintf("<rect x='0' y='0' width='%.0f' height='%.0f' fill='none' stroke='#777'/>",width,height))
	for i:=0;i<=5;i++{v:=hi-float64(i)/5*hi;y:=yf(v);b.WriteString(fmt.Sprintf("<line x1='%f' x2='%f' y1='%f' y2='%f' stroke='#ddd'/><text x='8' y='%f' font-size='12'>%.0f%%</text>",left,width-right,y,y,y+4,v))}
	for _,s:=range ss{col:=candidateColor(s.k);pts:=[]string{};for _,p:=range s.t{pts=append(pts,fmt.Sprintf("%.1f,%.1f",xf(p.X),yf(p.Y)))};if len(pts)>1{b.WriteString(fmt.Sprintf("<polyline fill='none' stroke='%s' stroke-width='2.5' points='%s'/>",col,strings.Join(pts," ")))};for _,p:=range s.r{b.WriteString(fmt.Sprintf("<circle data-poll-id='%s' cx='%.1f' cy='%.1f' r='3.5' fill='#fff' stroke='%s'><title>%s · %.2f%% · %s</title></circle>",esc(p.PollID),xf(p.T),yf(p.Y),col,esc(s.k),p.Y,esc(p.Institute)))}}
	b.WriteString("</svg>");return b.String()
}
func renderMethodology(en bool) string {
	var b strings.Builder;b.WriteString("<section id='methodology'><h2>Metodologia</h2><p>"+tr(en,"Fim de campo é a data usada no eixo. Data de publicação é metadado. TSE é usado na identidade quando disponível. Faixas são estimativas do modelo, não margem de erro individual nem probabilidade.","Fieldwork end is the axis date. Publication date is metadata. TSE is used for identity when available. Bands are model estimates, not individual margins of error or probabilities.")+"</p><h3>Modelos</h3><ul>")
	for _,m:=range modelOptions(){b.WriteString(fmt.Sprintf("<li><b>%d</b> — %s</li>",m.ID,esc(m.Label)))};b.WriteString("</ul><h3>Overlays</h3><ul>");for _,o:=range overlayOptions(){b.WriteString("<li>"+esc(o.Label)+"</li>")};b.WriteString("</ul><h3>Regras de migração</h3><ul><li>Modelos 1–12 permanecem selecionáveis.</li><li>Dados estaduais ficam separados do agregado nacional.</li><li>Exportações preservam os filtros da visão.</li><li>O antigo controle de foco não é transportado.</li></ul></section>");return b.String()
}

func bindControls() {
	bindRoot("click",func(ev js.Value){
		el:=targetElement(ev);action:=attr(el,"data-action")
		switch action {
		case "lang": view.Language=attr(el,"data-value");localSet("pebr-language",view.Language);setLanguageDoc(view.Language);render()
		case "refresh": win().Get("location").Call("reload")
		case "zoom-in": view.Zoom=math.Min(5,view.Zoom*1.25);render()
		case "zoom-out": view.Zoom=math.Max(1,view.Zoom/1.25);render()
		case "zoom-reset": view.Zoom=1;render()
		case "fullscreen": if !toggleFullscreen("appFrame"){view.Status="Tela cheia indisponível";render()}
		case "share": if copyText(shareURL(view)){view.Status="Link copiado"}else{view.Status="Clipboard indisponível"};render()
		case "csv": if downloadCSV(nationalRows()){view.Status="CSV exportado"}else{view.Status="Export indisponível"};render()
		case "json": if downloadJSON(nationalRows()){view.Status="JSON exportado"}else{view.Status="Export indisponível"};render()
		case "institutes-all": if checked(el){view.Institutes=map[string]bool{}};render()
		case "institute": updateSelection(&view.Institutes,attr(el,"data-name"),checked(el),uniqueStrings(polls,func(p Poll)string{return p.Institute}));render()
		case "hidden": if checked(el){delete(view.Hidden,attr(el,"data-name"))}else{view.Hidden[attr(el,"data-name")]=true};saveJSONMap("pebr-hidden",view.Hidden);render()
		case "overlay": view.Overlays[attr(el,"data-name")]=checked(el);saveJSONMap("pebr-overlays",view.Overlays);render()
		case "regional-all": if checked(el){view.RegionalGeos=map[string]bool{}};render()
		case "regional-geo": updateSelection(&view.RegionalGeos,attr(el,"data-name"),checked(el),uniqueStrings(regionalPolls,func(p Poll)string{return p.Geo}));render()
		}
		if id:=attr(el,"data-poll-id");id!=""{view.SelectedPoll=id;render()}
	})
	bindRoot("change",func(ev js.Value){el:=ev.Get("target");id:=el.Get("id").String();switch id{
	case "round":view.Round,_=strconv.Atoi(valueOf(el));view.Candidate="Lula";view.SelectedPoll="";render()
	case "geo":view.Geo=valueOf(el);render()
	case "candidate":view.Candidate=valueOf(el);render()
	case "range":view.RangeDays,_=strconv.Atoi(valueOf(el));render()
	case "window":view.WindowDays,_=strconv.Atoi(valueOf(el));localSet("pebr-window",strconv.Itoa(view.WindowDays));render()
	case "windowCustom":if n,e:=strconv.Atoi(valueOf(el));e==nil&&n>0{view.WindowDays=n};render()
	case "model":view.Model,_=strconv.Atoi(valueOf(el));localSet("pebr-model",strconv.Itoa(view.Model));render()
	case "theme":view.Theme=valueOf(el);localSet("pebr-theme",view.Theme);render()
	case "projection":view.Projection=checked(el);render()
	case "regionalRound":view.RegionalRound,_=strconv.Atoi(valueOf(el));render()
	}})
	bindRoot("change",func(ev js.Value){el:=ev.Get("target");if el.Get("id").String()=="tableQuery"{view.TableQuery=valueOf(el);render()}})
}
func updateSelection(m *map[string]bool,name string,on bool,all []string){if len(*m)==0&&!on{*m=map[string]bool{};for _,x:=range all{if x!=name{(*m)[x]=true}};return};if on{(*m)[name]=true}else{delete(*m,name)}}

func downloadCSV(rows []Poll) bool {
	var sb strings.Builder;cw:=csv.NewWriter(&sb);cw.Comma=';';head:=append([]string{"Fim de campo","Publicação","Instituto","Geo","Cenário","TSE","N","Margem"},allCandidateKeys(view.Round)...);head=append(head,"Fonte");_ = cw.Write(head)
	for _,p:=range rows{r:=[]string{p.FieldworkEnd,p.PublishedDate,p.Institute,p.Geo,p.Scenario,firstNonEmpty(p.TSERegistration,p.TSEProtocol),fmt.Sprintf("%.0f",p.N),p.MarginOfError};for _,k:=range allCandidateKeys(view.Round){v:="";for _,c:=range p.Candidates{if normalizeCandidate(c.Name)==k{v=fmt.Sprintf("%.2f",c.Percentage)}};r=append(r,v)};r=append(r,p.SourceURL);_ = cw.Write(r)};cw.Flush();return downloadText("pesquisas-eleitorais-"+todayStamp()+".csv","text/csv",sb.String())
}
func downloadJSON(rows []Poll) bool {
	payload:=map[string]any{"schema_version":2,"exported_at":todayStamp(),"source":"go-wasm","view":map[string]any{"round":view.Round,"range_days":view.RangeDays,"averaging_window_days":view.WindowDays,"model":view.Model,"projection":view.Projection,"candidate":view.Candidate,"geo":view.Geo,"institutes":view.Institutes},"record_count":len(rows),"polls":rows}
	raw,e:=json.MarshalIndent(payload,"","  ");if e!=nil{return false};return downloadText("pesquisas-eleitorais-"+todayStamp()+".json","application/json",string(raw))
}

func sortStrings(v []string){sort.Strings(v)}
func formatDayMS(ms int64)string{return time.Unix(ms/1000,0).UTC().Format("02/01")}
