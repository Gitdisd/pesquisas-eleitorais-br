package main

import (
	"math"
	"sort"
	"strings"
	"time"
)

const dayMS int64 = 86400000
const minSample = 100.0
const maxSample = 4000.0
const nRef = 2000.0

type TrendPoint struct { T int64; Y float64; N float64; Moe float64; Institute, PollID string }
type SeriesPoint struct { X int64; Y float64 }
type UncertaintyPoint struct { X int64; Low, High, SE float64 }
type OverlayResult struct { ID string; Label string; Mid, Low, High []SeriesPoint }

type ModelOption struct { ID int; Label string }
func modelOptions() []ModelOption {
	return []ModelOption{
		{1,"Exp"},{2,"Casa"},{3,"Erro"},{4,"Kalman"},{5,"Rápido"},{6,"Dia"},{7,"Local"},
		{8,"Média"},{9,"Peso"},{10,"Mediana"},{11,"Moda"},{12,"Corta"},
	}
}
func modelLabel(id int) string { for _,m:=range modelOptions(){if m.ID==id{return m.Label}};return "Exp" }

func candidateKeys() []string {
	set:=map[string]bool{}
	for _,p:=range polls{for _,c:=range p.Candidates{set[normalizeCandidate(c.Name)]=true}}
	out:=[]string{};for k:=range set{out=append(out,k)}
	sort.Strings(out);return out
}
func normalizeCandidate(s string) string {
	x:=strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.Contains(x,"lula"): return "Lula"
	case strings.Contains(x,"flávio")||strings.Contains(x,"flavio"): return "Flávio Bolsonaro"
	case strings.Contains(x,"branco")||strings.Contains(x,"nulo")||strings.Contains(x,"não sabe")||strings.Contains(x,"nao sabe"): return "Branco/Nulo"
	case strings.Contains(x,"cury"): return "Augusto Cury"
	case strings.Contains(x,"caiado"): return "Ronaldo Caiado"
	case strings.Contains(x,"renan"): return "Renan Santos"
	case strings.Contains(x,"zema"): return "Romeu Zema"
	case strings.Contains(x,"samara"): return "Samara Martins"
	case strings.Contains(x,"hertz"): return "Hertz Dias"
	case strings.Contains(x,"edmilson"): return "Edmilson Costa"
	case strings.Contains(x,"rui costa"): return "Rui Costa Pimenta"
	case strings.Contains(x,"clariana"): return "Clariana Barão"
	case strings.Contains(x,"grassi"): return "Veterinário Wilson Grassi"
	default: return s
	}
}

func sampleN(n float64) float64 { if !isFinite(n)||n<=0{return 800}; return math.Min(maxSample,math.Max(minSample,n)) }
func weight(p TrendPoint,t int64,half float64,flood float64) float64 {
	h:=math.Max(1,half); days:=math.Abs(float64(t-p.T))/float64(dayMS)
	return math.Sqrt(sampleN(p.N)/nRef)*math.Pow(2,-days/h)/math.Max(1,flood)
}
func weightedTrend(points []TrendPoint,half float64) []SeriesPoint {
	if len(points)==0{return nil}; s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T})
	out:=[]SeriesPoint{};start,end:=s[0].T,s[len(s)-1].T;h:=math.Max(1,half)
	for t:=start;t<=end;t+=dayMS {num,den:=0.,0.;near:=1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d>h*2.5{continue};w:=weight(p,t,h,1);num+=w*p.Y;den+=w};if den>0&&near<=h{out=append(out,SeriesPoint{t,round2(num/den)})}}
	return out
}
func houseEffects(points []TrendPoint) map[string]float64 {
	type acc struct{s,n float64}; a:=map[string]acc{}
	for _,p:=range points{if p.Institute==""{continue};num,den:=0.,0.;for _,q:=range points{if q.Institute==""||q.Institute==p.Institute{continue};d:=math.Abs(float64(q.T-p.T))/float64(dayMS);if d>14{continue};w:=math.Sqrt(sampleN(q.N)/nRef);num+=w*q.Y;den+=w};if den>0{x:=a[p.Institute];x.s+=p.Y-num/den;x.n++;a[p.Institute]=x}}
	out:=map[string]float64{};for k,v:=range a{raw:=v.s/v.n;if math.Abs(raw)<.05{raw=0};out[k]=raw*v.n/(v.n+4)};return out
}
func weightedV2(points []TrendPoint,half float64) []SeriesPoint {
	h:=math.Max(1,half); flood:=map[string]int{}
	for _,p:=range points{if p.Institute==""{continue};d:=p.T/dayMS;for off:=-int(math.Ceil(math.Max(14,h)));off<=int(math.Ceil(math.Max(14,h)));off++{flood[fmtKey(p.Institute,d+int64(off))]++}}
	s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});if len(s)==0{return nil}
	out:=[]SeriesPoint{};for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{num,den,near:=0.,0.,1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d>h*2.5{continue};f:=1.;if p.Institute!=""{f=float64(maxInt(1,flood[fmtKey(p.Institute,t/dayMS)]))};w:=weight(p,t,h,f);num+=w*p.Y;den+=w};if den>0&&near<=h{out=append(out,SeriesPoint{t,round2(num/den)})}}
	return out
}
func fmtKey(inst string,day int64)string{return inst+"|"+strconv.FormatInt(day,10)}
func maxInt(a,b int)int{if a>b{return a};return b}

func pollSE(p TrendPoint) float64 { if p.Moe>0{return math.Max(.4,p.Moe/1.96)};n:=sampleN(p.N);y:=math.Min(95,math.Max(5,p.Y));return math.Max(.5,1.3*math.Sqrt((y*(100-y))/n)) }
func tau2(items []struct{y,se,rw float64}) float64 {
	if len(items)==0{return 0};sw,swy:=0.,0.;for _,it:=range items{w:=1/math.Max(1e-6,it.se*it.se);sw+=w;swy+=w*it.y};if sw<=0{return 0};mu:=swy/sw;q,sw2:=0.,0.;for _,it:=range items{w:=1/math.Max(1e-6,it.se*it.se);d:=it.y-mu;q+=w*d*d;sw2+=w*w};c:=sw-sw2/sw;if c<=0{return 0};return math.Min(25,math.Max(0,(q-math.Max(1,float64(len(items)-1)))/c))
}
func model3(points []TrendPoint,half float64) []SeriesPoint {
	if len(points)==0{return nil};s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});h:=math.Max(1,half);out:=[]SeriesPoint{}
	for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{bag:=[]struct{y,se,rw float64}{};near:=1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d>h*2.5{continue};bag=append(bag,struct{y,se,rw float64}{p.Y,pollSE(),math.Pow(2,-d/h)})};if len(bag)==0||near>h{continue};tt:=tau2(bag);num,den:=0.,0.;for _,b:=range bag{w:=b.rw/(b.se*b.se+tt);num+=w*b.y;den+=w};if den>0{out=append(out,SeriesPoint{t,round2(num/den)})}}
	return out
}
func model4(points []TrendPoint) []SeriesPoint {
	if len(points)==0{return nil};house:=houseEffects(points);s:=append([]TrendPoint(nil),points...);for i:=range s{s[i].Y-=house[s[i].Institute]};sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T})
	start,end:=s[0].T,s[len(s)-1].T;by:=map[int64][]TrendPoint{};for _,p:=range s{by[p.T/dayMS]=append(by[p.T/dayMS],p)}
	theta:=s[0].Y;P:=9.;q:=.16*.16;fwd:=[]struct{x int64;m,P float64}{};for t:=start;t<=end;t+=dayMS{P+=q;for _,p:=range by[t/dayMS]{R:=pollSE(p)*pollSE(p);K:=P/(P+R);theta+=K*(p.Y-theta);P=(1-K)*P};fwd=append(fwd,struct{x int64;m,P float64}{t,theta,P})}
	sm:=make([]float64,len(fwd));sm[len(sm)-1]=fwd[len(fwd)-1].m;for i:=len(fwd)-2;i>=0;i--{pp:=fwd[i].P+q;C:=fwd[i].P/math.Max(1e-9,pp);sm[i]=fwd[i].m+C*(sm[i+1]-fwd[i].m)}
	out:=make([]SeriesPoint,len(sm));for i,v:=range sm{out[i]=SeriesPoint{fwd[i].x,round2(math.Min(100,math.Max(0,v)))}};return out
}
func model5(points []TrendPoint,half float64) []SeriesPoint {
	if len(points)==0{return nil};s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});h:=math.Max(2,half/5);reach:=math.Max(8,h*4);out:=[]SeriesPoint{}
	for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{num,den,near:=0.,0.,1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d>reach{continue};w:=math.Sqrt(sampleN(p.N)/nRef)*math.Pow(2,-d/h)*(1+2*math.Exp(-d/1.8));num+=w*p.Y;den+=w};if den>0&&near<=math.Max(3,h*1.5){out=append(out,SeriesPoint{t,round2(num/den)})}}
	return out
}
func model6(points []TrendPoint) []SeriesPoint {
	if len(points)==0{return nil};type x struct{y,w float64};by:=map[int64]map[string]x{};for _,p:=range points{m:=by[p.T/dayMS];if m==nil{m=map[string]x{};by[p.T/dayMS]=m};k:=p.Institute;if k==""{k="_"};w:=math.Sqrt(sampleN(p.N)/nRef);c:=m[k];nw:=c.w+w;m[k]=x{(c.y*c.w+p.Y*w)/nw,nw}}
	days:=[]int64{};for d:=range by{days=append(days,d)};sort.Slice(days,func(i,j int)bool{return days[i]<days[j]});out:=[]SeriesPoint{};for _,d:=range days{num,den:=0.,0.;for _,c:=range by[d]{num+=c.w*c.y;den+=c.w};if den>0{out=append(out,SeriesPoint{d*dayMS,round2(num/den)})}};return out
}
func localModel(points []TrendPoint,half float64) []SeriesPoint {
	if len(points)==0{return nil};s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});h:=math.Max(3,half);out:=[]SeriesPoint{};for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{sw,sx,sy,sxx,sxy:=0.,0.,0.,0.,0.;near:=1e9;n:=0;for _,p:=range s{d:=float64(p.T-t)/float64(dayMS);ad:=math.Abs(d);if ad<near{near=ad};if ad>h{continue};u:=ad/h;k:=math.Pow(1-u*u*u,3)*math.Sqrt(sampleN(p.N)/nRef);sw+=k;sx+=k*d;sy+=k*p.Y;sxx+=k*d*d;sxy+=k*d*p.Y;n++};if sw<=0||near>h{continue};y:=sy/sw;det:=sw*sxx-sx*sx;if n>=3&&det>1e-6{y=(sxx*sy-sx*sxy)/det};out=append(out,SeriesPoint{t,round2(math.Min(100,math.Max(0,y)))})};return out
}
func median(vals []float64)float64{if len(vals)==0{return 0};v:=append([]float64(nil),vals...);sort.Float64s(v);m:=len(v)/2;if len(v)%2==1{return v[m]};return (v[m-1]+v[m])/2}
func centerModel(points []TrendPoint,half float64,kind int) []SeriesPoint {
	if len(points)==0{return nil};s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});out:=[]SeriesPoint{};h:=math.Max(1,half)
	for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{groups:=map[string][]TrendPoint{};near:=1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d<=h{k:=p.Institute;if k==""{k="_"};groups[k]=append(groups[k],p)}};if near>h{continue};ys:=[]float64{};for _,g:=range groups{num,den:=0.,0.;for _,p:=range g{w:=math.Sqrt(sampleN(p.N)/nRef);num+=w*p.Y;den+=w};if den>0{ys=append(ys,num/den)}};if len(ys)==0{continue};var y float64;switch kind{case 8:y=mean(ys);case 9:y=weightedY(groups);case 10:y=median(ys);case 11:y=mode(ys);default:y=trim(ys)};out=append(out,SeriesPoint{t,round2(y)})};return out
}
func mean(v []float64)float64{if len(v)==0{return 0};s:=0.;for _,x:=range v{s+=x};return s/float64(len(v))}
func weightedY(groups map[string][]TrendPoint)float64{num,den:=0.,0.;for _,g:=range groups{n,d:=0.,0.;for _,p:=range g{w:=math.Sqrt(sampleN(p.N)/nRef);n+=w*p.Y;d+=w};if d>0{y:=n/d;num+=d*y;den+=d}};if den==0{return 0};return num/den}
func mode(v []float64)float64{if len(v)==0{return 0};bins:=map[float64]int{};best:=0;wins:=[]float64{};for _,x:=range v{b:=math.Round(x*2)/2;bins[b]++};for b,n:=range bins{if n>best{best=n;wins=[]float64{b}}else if n==best{wins=append(wins,b)}};if best<=1{return median(v)};return median(wins)}
func trim(v []float64)float64{if len(v)<4{return median(v)};s:=append([]float64(nil),v...);sort.Float64s(s);d:=int(math.Floor(float64(len(s))*.2));if d<1{d=1};core:=s[d:len(s)-d];return mean(core)}

func averageTrend(points []TrendPoint,half float64,model int) []SeriesPoint {
	switch model{case 2:return weightedV2(adjustHouse(points),half);case 3:return model3(points,half);case 4:return model4(points);case 5:return model5(points,half);case 6:return model6(points);case 7:return localModel(points,half);case 8,9,10,11,12:return centerModel(points,half,model);default:return weightedTrend(points,half)}
}
func adjustHouse(points []TrendPoint) []TrendPoint{h:=houseEffects(points);out:=append([]TrendPoint(nil),points...);for i:=range out{out[i].Y-=h[out[i].Institute]};return out}

func uncertaintyBand(points []TrendPoint,half,z float64) []UncertaintyPoint {
	if len(points)==0{return nil};s:=append([]TrendPoint(nil),points...);sort.Slice(s,func(i,j int)bool{return s[i].T<s[j].T});h:=math.Max(1,half);out:=[]UncertaintyPoint{}
	for t:=s[0].T;t<=s[len(s)-1].T;t+=dayMS{bag:=[]struct{y,w,se float64}{};near:=1e9;for _,p:=range s{d:=math.Abs(float64(t-p.T))/float64(dayMS);if d<near{near=d};if d>h*2.5{continue};bag=append(bag,struct{y,w,se float64}{p.Y,weight(p,t,h,1),pollSE(p)})};if len(bag)==0||near>h{continue};den,mu:=0.,0.;w2:=0.;for _,b:=range bag{den+=b.w;mu+=b.w*b.y;w2+=b.w*b.w};if den<=0{continue};mu/=den;neff:=math.Max(1,den*den/math.Max(1e-9,w2));between:=0.;meas:=0.;for _,b:=range bag{between+=b.w*(b.y-mu)*(b.y-mu);meas+=b.w*b.w*b.se*b.se};se:=math.Max(.75,math.Sqrt(math.Max(0,between/den/neff+meas/(den*den))));band:=math.Max(.75,z*se);out=append(out,UncertaintyPoint{t,round2(math.Max(0,mu-band)),round2(math.Min(100,mu+band)),se})};return out
}

func projectTrend(series []SeriesPoint,fitDays,horizon int,election int64,processSd,bandFloor,maxAbsSlope float64)(bool,string,[]SeriesPoint,[]SeriesPoint,[]SeriesPoint,float64,float64,int64){
	if len(series)==0{return false,"empty_series",nil,nil,nil,0,0,0};s:=append([]SeriesPoint(nil),series...);sort.Slice(s,func(i,j int)bool{return s[i].X<s[j].X});last:=s[len(s)-1];cut:=last.X-int64(maxI(fitDays,1))*dayMS;w:=[]SeriesPoint{};for _,p:=range s{if p.X>=cut{w=append(w,p)}};if len(w)<4{return false,"insufficient_points",nil,nil,nil,0,0,last.X};h:=horizon;if election>last.X{d:=int((election-last.X)/dayMS);if d<h{h=d}}else if election>0{return false,"past_or_on_election",nil,nil,nil,0,0,last.X};if h<1{return false,"horizon_zero",nil,nil,nil,0,0,last.X}
	t0:=w[0].X;st,sy,stt,sty:=0.,0.,0.,0.;for _,p:=range w{d:=float64(p.X-t0)/float64(dayMS);st+=d;sy+=p.Y;stt+=d*d;sty+=d*p.Y};n:=float64(len(w));den:=n*stt-st*st;b:=0.;if den!=0{b=(n*sty-st*sy)/den};b=math.Max(-maxAbsSlope,math.Min(maxAbsSlope,b));a:=(sy-b*st)/n;sse:=0.;for _,p:=range w{d:=float64(p.X-t0)/float64(dayMS);e:=p.Y-(a+b*d);sse+=e*e};rmse:=math.Sqrt(sse/math.Max(1,n-2))
	line:=[]SeriesPoint{last};lo:=[]SeriesPoint{last};hi:=[]SeriesPoint{last};for d:=1;d<=h;d++{x:=last.X+int64(d)*dayMS;delta:=b*10*(1-math.Exp(-float64(d)/10));y:=math.Max(0,math.Min(100,last.Y+delta));wide:=1.645*math.Sqrt(rmse*rmse*(1+float64(d)/float64(fitDays))+bandFloor*bandFloor+processSd*processSd*float64(d));line=append(line,SeriesPoint{x,round1(y)});lo=append(lo,SeriesPoint{x,round1(math.Max(0,y-wide))});hi=append(hi,SeriesPoint{x,round1(math.Min(100,y+wide))}}
	return true,"",line,lo,hi,b,rmse,last.X
}
func projectionV2(raw []TrendPoint,fitDays,horizon int,election int64)(bool,string,[]SeriesPoint,[]SeriesPoint,[]SeriesPoint,int64,float64,float64,bool,string){
	h:=houseEffects(raw);deb:=append([]TrendPoint(nil),raw...);for i:=range deb{deb[i].Y-=h[deb[i].Institute]};trend:=weightedV2(deb,float64(fitDays));if len(trend)<8{return false,"insufficient_points",nil,nil,nil,0,0,0,false,"short_series"};last:=trend[len(trend)-1].X;cut:=last-7*dayMS;train,test:=[]SeriesPoint{},[]SeriesPoint{};for _,p:=range trend{if p.X<=cut{train=append(train,p)}else{test=append(test,p)}};if len(train)<4||len(test)<2{return false,"thin_holdout",nil,nil,nil,last,0,0,false,"thin_holdout"};persist:=train[len(train)-1].Y;ok,reason,l,lo,hi,sl,rm:=projectTrend(train,fitDays,horizon,0,.18,2.4,.2);if !ok{return false,"proj_failed",nil,nil,nil,last,sl,rm,false,reason};seM,seP:=0.,0.;for _,p:=range test{pred:=l[len(l)-1].Y;best:=math.MaxFloat64;for _,q:=range l{d:=math.Abs(float64(q.X-p.X));if d<best{best=d;pred=q.Y}};seM+=(pred-p.Y)*(pred-p.Y);seP+=(persist-p.Y)*(persist-p.Y)};rmM:=math.Sqrt(seM/float64(len(test)));rmP:=math.Sqrt(seP/float64(len(test)));pass:=rmM+1e-6<rmP;if !pass{return false,"holdout_fail",nil,nil,nil,last,sl,rmM,false,"holdout_fail"};return true,"",l,lo,hi,last,sl,rmM,true,""
}

type OverlayOption struct{ID,Label string}
func overlayOptions() []OverlayOption{return []OverlayOption{{"sma7","SMA 7"},{"sma21","SMA 21"},{"ema9","EMA 9"},{"ema21","EMA 21"},{"hma","HMA 16"},{"vwma","VWMA 14"},{"kama","KAMA 10"},{"bb","Bollinger 20"}}}
func computeOverlay(id string,series []SeriesPoint,raw []TrendPoint) OverlayResult {
	r:=OverlayResult{ID:id,Label:id};v:=[]float64{};for _,p:=range series{v=append(v,p.Y)}
	pack:=func(vals []float64)[]SeriesPoint{out:=[]SeriesPoint{};for i,y:=range vals{if !math.IsNaN(y){out=append(out,SeriesPoint{series[i].X,round2(y)})}};return out}
	switch id{
	case "sma7":return OverlayResult{id,"SMA 7",pack(windowAvg(v,7)),nil,nil}
	case "sma21":return OverlayResult{id,"SMA 21",pack(windowAvg(v,21)),nil,nil}
	case "ema9":return OverlayResult{id,"EMA 9",pack(ema(v,9)),nil,nil}
	case "ema21":return OverlayResult{id,"EMA 21",pack(ema(v,21)),nil,nil}
	case "hma":return OverlayResult{id,"HMA 16",pack(hma(v,16)),nil,nil}
	case "kama":return OverlayResult{id,"KAMA 10",pack(kama(v,10,2,30)),nil,nil}
	case "vwma":{pts:=append([]TrendPoint(nil),raw...);sort.Slice(pts,func(i,j int)bool{return pts[i].T<pts[j].T});m:=[]SeriesPoint{};for i:=13;i<len(pts);i++{num,den:=0.,0.;for _,p:=range pts[i-13:i+1]{w:=math.Max(800,p.N);num+=p.Y*w;den+=w};if den>0{m=append(m,SeriesPoint{pts[i].T,round2(num/den)})}};return OverlayResult{id,"VWMA 14",m,nil,nil}}
	case "bb":{mid,lo,hi:=[]SeriesPoint{},[]SeriesPoint{},[]SeriesPoint{};for i:=19;i<len(v);i++{m:=mean(v[i-19:i+1]);ss:=0.;for _,x:=range v[i-19:i+1]{d:=x-m;ss+=d*d};sd:=math.Sqrt(ss/20);mid=append(mid,SeriesPoint{series[i].X,round2(m)});lo=append(lo,SeriesPoint{series[i].X,round2(math.Max(0,m-2*sd))});hi=append(hi,SeriesPoint{series[i].X,round2(math.Min(100,m+2*sd))})};return OverlayResult{id,"Bollinger 20",mid,lo,hi}}
	}
	return r
}
func windowAvg(v []float64,n int)[]float64{out:=make([]float64,len(v));for i:=range out{out[i]=math.NaN();if i+1>=n{out[i]=mean(v[i+1-n:i+1])}};return out}
func ema(v []float64,n int)[]float64{out:=make([]float64,len(v));for i:=range out{out[i]=math.NaN()};if len(v)==0{return out};a:=2/float64(n+1);e:=v[0];out[0]=e;for i:=1;i<len(v);i++{e=a*v[i]+(1-a)*e;out[i]=e};return out}
func wma(v []float64,i,n int)float64{if i+1<n{return math.NaN()};num,den:=0.,0.;for k:=0;k<n;k++{w:=float64(k+1);num+=v[i+1-n+k]*w;den+=w};return num/den}
func hma(v []float64,n int)[]float64{half:=n/2;if half<2{half=2};sq:=int(math.Round(math.Sqrt(float64(n))));if sq<2{sq=2};raw:=make([]float64,len(v));for i:=range raw{a,b:=wma(v,i,half),wma(v,i,n);raw[i]=math.NaN();if !math.IsNaN(a)&&!math.IsNaN(b){raw[i]=2*a-b}};out:=make([]float64,len(v));for i:=range out{out[i]=math.NaN();if i+1>=sq{ok:=true;for j:=i+1-sq;j<=i;j++{if math.IsNaN(raw[j]){ok=false}};if ok{out[i]=wma(raw,i,sq)}}};return out}
func kama(v []float64,n,fast,slow int)[]float64{out:=make([]float64,len(v));for i:=range out{out[i]=math.NaN()};if len(v)<n+1{return out};cur:=v[n];out[n]=cur;f:=2/float64(fast+1);s:=2/float64(slow+1);for i:=n+1;i<len(v);i++{change:=math.Abs(v[i]-v[i-n]);vol:=0.;for k:=i-n+1;k<=i;k++{vol+=math.Abs(v[k]-v[k-1])};er:=0.;if vol>1e-9{er=change/vol};sc:=math.Pow(er*(f-s)+s,2);cur+=sc*(v[i]-cur);out[i]=cur};return out}

func parseDay(s string)(int64,bool){if len(s)<10{return 0,false};t,e:=time.Parse("2006-01-02",s[:10]);if e!=nil{return 0,false};return t.Unix()*1000,true}
func trendAt(series []SeriesPoint,x int64)(float64,bool){if len(series)==0{return 0,false};best:=series[0];d:=math.Abs(float64(best.X-x));for _,p:=range series{dd:=math.Abs(float64(p.X-x));if dd<d{best=p;d=dd}};return best.Y,true}
func round1(v float64)float64{return math.Round(v*10)/10}
func round2(v float64)float64{return math.Round(v*100)/100}
func isFinite(v float64)bool{return !math.IsNaN(v)&&!math.IsInf(v,0)}
func maxI(a,b int)int{if a>b{return a};return b}
