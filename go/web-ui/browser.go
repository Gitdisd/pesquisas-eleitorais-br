package main

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
	"syscall/js"
	"time"
)

var callbacks []js.Func
var autoRefreshCallback js.Func

func doc() js.Value { return js.Global().Get("document") }
func win() js.Value { return js.Global() }
func releaseCallbacks() { for _, fn := range callbacks { fn.Release() }; callbacks = nil }

func bindRoot(event string, fn func(js.Value)) {
	f := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args)>0 { fn(args[0]) }
		return nil
	})
	callbacks=append(callbacks,f)
	doc().Get("body").Call("addEventListener",event,f)
}
func targetElement(ev js.Value) js.Value {
	t:=ev.Get("target")
	for t.Truthy() && t.Get("nodeType").Int()!=1 { t=t.Get("parentElement") }
	return t
}
func attr(el js.Value, key string) string { if !el.Truthy(){return ""}; v:=el.Call("getAttribute",key); if !v.Truthy(){return ""}; return v.String() }
func checked(el js.Value) bool { return el.Truthy() && el.Get("checked").Bool() }
func valueOf(el js.Value) string { if !el.Truthy(){return ""}; return el.Get("value").String() }

func localGet(key string) string {
	v:=win().Get("localStorage"); if !v.Truthy(){return ""}
	x:=v.Call("getItem",key); if !x.Truthy(){return ""}; return x.String()
}
func localSet(key,value string) { v:=win().Get("localStorage"); if v.Truthy(){v.Call("setItem",key,value)} }

func queryParams() url.Values {
	s:=win().Get("location").Get("search").String()
	v,_:=url.ParseQuery(strings.TrimPrefix(s,"?")); return v
}
func setLanguageDoc(lang string) {
	d:=doc(); if !d.Truthy(){return}
	d.Get("documentElement").Set("lang",lang)
	if lang=="en" { d.Set("title","Brazilian Electoral Polls — 2026") } else { d.Set("title","Pesquisas Eleitorais BR — 2026") }
}
func copyText(text string) bool {
	n:=win().Get("navigator"); if !n.Truthy(){return false}; c:=n.Get("clipboard"); if !c.Truthy(){return false}
	c.Call("writeText",text); return true
}
func downloadText(filename,mime,text string) bool {
	a:=doc().Call("createElement","a"); if !a.Truthy(){return false}
	a.Set("href","data:"+mime+","+js.Global().Call("encodeURIComponent",text).String()); a.Set("download",filename); a.Call("click"); return true
}
func toggleFullscreen(id string) bool {
	d:=doc(); if !d.Truthy(){return false}
	if d.Get("fullscreenElement").Truthy(){d.Call("exitFullscreen");return true}
	el:=d.Call("getElementById",id); if !el.Truthy(){return false}; el.Call("requestFullscreen"); return true
}
func todayStamp() string { return time.Now().UTC().Format("2006-01-02") }
func shareURL(s state) string {
	u,_:=url.Parse(win().Get("location").Get("href").String()); q:=u.Query()
	q.Set("round",strconv.Itoa(s.Round)); if s.RangeDays<=0{q.Set("range","all")}else{q.Set("range",strconv.Itoa(s.RangeDays))}
	q.Set("window",strconv.Itoa(s.WindowDays)); q.Set("model",strconv.Itoa(s.Model)); if s.Projection{q.Set("projection","1")}else{q.Set("projection","0")}
	q.Set("candidate",s.Candidate); q.Set("geo",s.Geo)
	ins:=[]string{}; for k,on:=range s.Institutes{if on{ins=append(ins,k)}}; sortStrings(ins)
	if len(ins)>0{q.Set("institutes",strings.Join(ins,","))}else{q.Del("institutes")}
	u.RawQuery=q.Encode(); u.Fragment=""; return u.String()
}
func saveJSONMap(key string,m map[string]bool) { b,_:=json.Marshal(m); localSet(key,string(b)) }
func loadJSONMap(key string) map[string]bool {
	out:=map[string]bool{}; raw:=localGet(key); if raw==""{return out}; _=json.Unmarshal([]byte(raw),&out); return out
}
func scrollTo(id string) { if el:=doc().Call("getElementById",id);el.Truthy(){el.Call("scrollIntoView")} }

func startAutoRefresh() {
	if autoRefreshCallback.Truthy() { return }
	autoRefreshCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		win().Get("location").Call("reload")
		return nil
	})
	win().Call("setInterval", autoRefreshCallback, int64(60*60*1000))
}
