// v2-parts.jsx — Verdict, face height, metric card, wind rose, chips, best window, hourly list (with row-expand), tide curve, level matrix, footer.

/* ─────────── Verdict hero (uses coherent verdict) ─────────── */
function VerdictHero({verdict, hour, swapKey, onOpenScore}){
  const score = Math.round(window.useTween(hour.score, 380));
  return (<div key={swapKey} className="swap-enter">
    <div className="verdict-row">
      <div className="verdict-word" style={{color:verdict.color}}>{verdict.label}</div>
      <button className="score-box" onClick={onOpenScore} style={{color:verdict.color, borderColor:verdict.color+"55"}}>
        <span className="score-num">{score}</span>
        <span className="score-den">/100</span>
        <span className="score-info" aria-hidden="true">ⓘ</span>
      </button>
    </div>
    <button className="score-how" onClick={onOpenScore}>How is this calculated? <span className="chev">→</span></button>
  </div>);
}

/* ─────────── Animated wave illustration for face height ─────────── */
function WaveGlyph({heightFt}){
  // Height scales line amplitude. 0–12 ft maps to amplitude 2–10
  const amp = Math.max(2, Math.min(10, heightFt*0.9));
  // two crests, offset, drifting
  return (<svg width="150" height="34" viewBox="0 0 150 34" style={{display:"block",margin:"10px auto 0"}}>
    <defs>
      <linearGradient id="wg" x1="0" x2="1">
        <stop offset="0" stopColor="rgba(45,122,110,0)"/><stop offset="0.3" stopColor="rgba(45,122,110,0.55)"/>
        <stop offset="0.7" stopColor="rgba(45,122,110,0.55)"/><stop offset="1" stopColor="rgba(45,122,110,0)"/>
      </linearGradient>
    </defs>
    <path d={`M0,17 Q25,${17-amp} 50,17 T100,17 T150,17`} fill="none" stroke="url(#wg)" strokeWidth="1.6" strokeLinecap="round">
      <animate attributeName="d" dur="4s" repeatCount="indefinite"
        values={`M0,17 Q25,${17-amp} 50,17 T100,17 T150,17;
                 M0,17 Q25,${17+amp} 50,17 T100,17 T150,17;
                 M0,17 Q25,${17-amp} 50,17 T100,17 T150,17`}/>
    </path>
    <path d={`M0,23 Q25,${23-amp*0.7} 50,23 T100,23 T150,23`} fill="none" stroke="rgba(45,122,110,0.25)" strokeWidth="1.2" strokeLinecap="round">
      <animate attributeName="d" dur="5.5s" repeatCount="indefinite"
        values={`M0,23 Q25,${23+amp*0.7} 50,23 T100,23 T150,23;
                 M0,23 Q25,${23-amp*0.7} 50,23 T100,23 T150,23;
                 M0,23 Q25,${23+amp*0.7} 50,23 T100,23 T150,23`}/>
    </path>
  </svg>);
}

/* ─────────── StickyInfoBar — persistent summary that sticks to top on scroll.
   Shows: intro line (from reason), expected face height (hero), then 6 compact
   metrics in two rows: Swell · Wind | Air · Water · Tide · Daylight.
   Crossfades values on swapKey change. Adds .stuck class when pinned. ─────────── */
function StickyInfoBar({hour, swapKey, reasonText, sentinelRef, stuck, userLevel}){
  const low = hour.faceFtLow, high = hour.faceFtHigh;
  const midM = hour.swellHeight.toFixed(1);
  const per = Math.round(hour.swellPeriod);
  const descriptors = [
    {max:1.5,text:"Knee- to waist-high — beginner or longboard."},
    {max:3,text:"Waist to chest-high — easy, rolling waves."},
    {max:5,text:"Chest to head-high — proper intermediate waves, duck-diving required."},
    {max:7,text:"Head to overhead — solid and powerful."},
    {max:12,text:"Well overhead — experienced surfers only."},
  ];
  const trans = descriptors.find(d=>high<=d.max)?.text || "Well overhead — experts only.";
  const tideDir = hour.hour < 11 ? "↗" : (hour.hour < 17 ? "↘" : "↗");
  const tideNext = hour.hour < 11 ? "↑ 11:00am" : (hour.hour < 17 ? "↓ 5:12pm" : "↑ 11:20pm");
  const tideVal = (0.5 + 0.45*Math.sin((hour.hour-5)/24*Math.PI*2)).toFixed(1);

  // Per-level advice — shown as a compact pill when bar is stuck (scrolled past)
  const matrix = window.levelMatrixFor ? window.levelMatrixFor(hour) : [];
  const levelIdx = (userLevel && window.LEVEL_TO_MATRIX_IDX) ? window.LEVEL_TO_MATRIX_IDX[userLevel] : -1;
  const myLevel = levelIdx >= 0 ? matrix[levelIdx] : null;
  const verdictText = { yes: "GO", ok: "WORTH IT", no: "SKIP" };
  const levelLabel = userLevel ? { beg:"Beginner", eint:"Early Int", int:"Intermediate", adv:"Advanced", exp:"Expert" }[userLevel] : null;

  return (<div className={`sib ${stuck?"stuck":""}`}>
    {/* Intro / reason — stays visible even when stuck (just truncates) */}
    <div key={"sib-r-"+swapKey} className="sib-reason swap-enter">{reasonText}</div>

    {/* Face height hero */}
    <div key={"sib-f-"+swapKey} className="sib-face swap-enter">
      <div className="sib-face-lbl">Expected face height</div>
      <div className="sib-face-val">{low}–{high}<span className="unit">ft</span></div>
      <div className="sib-face-conv">{midM} m · {(hour.swellHeight*0.9).toFixed(1)}m @ {per}s</div>
      <div className="sib-face-trans">{trans}</div>
    </div>

    {/* Row 1 — Swell + Wind (bigger) */}
    <div key={"sib-a-"+swapKey} className="sib-grid sib-grid-2 swap-enter">
      <div className="sib-m">
        <div className="sib-m-lbl">Swell</div>
        <div className="sib-m-val">{hour.swellHeight.toFixed(1)}<span className="unit">m</span></div>
        <div className="sib-m-sub">from {hour.swellDir} · {per}s</div>
      </div>
      <div className="sib-m">
        <div className="sib-m-lbl">Wind</div>
        <div className="sib-m-val">{Math.round(hour.windKmh)}<span className="unit">km/h</span></div>
        <div className="sib-m-sub">{hour.windDir} · {hour.windType} · 0% rain</div>
      </div>
    </div>

    {/* Row 2 — Air · Water · Tide · Daylight */}
    <div key={"sib-b-"+swapKey} className="sib-grid sib-grid-4 swap-enter">
      <div className="sib-m sib-m-sm">
        <div className="sib-m-lbl">Air</div>
        <div className="sib-m-val sm">{hour.airTemp||18}<span className="unit">°C</span></div>
      </div>
      <div className="sib-m sib-m-sm">
        <div className="sib-m-lbl">Water</div>
        <div className="sib-m-val sm">{hour.seaTemp||22}<span className="unit">°C</span></div>
      </div>
      <div className="sib-m sib-m-sm">
        <div className="sib-m-lbl">Tide</div>
        <div className="sib-m-val sm">{tideDir} {tideVal}<span className="unit">m</span></div>
        <div className="sib-m-sub mono">{tideNext}</div>
      </div>
      <div className="sib-m sib-m-sm">
        <div className="sib-m-lbl">Daylight</div>
        <div className="sib-m-val sm sib-daylight">
          <span>↑6:41am</span>
          <span>↓5:50pm</span>
        </div>
      </div>
    </div>

    {/* Invisible sentinel — when it scrolls off the top, the bar becomes stuck */}
    <div ref={sentinelRef} className="sib-sentinel" aria-hidden="true"/>
  </div>);
}

function FaceHeightHero({hour, swapKey}){
  const low = hour.faceFtLow, high = hour.faceFtHigh;
  const midM = (hour.swellHeight).toFixed(1);
  const per = Math.round(hour.swellPeriod);
  const descriptors = [
    {max:1.5,text:"Knee- to waist-high — beginner or longboard."},
    {max:3,text:"Waist to chest-high — easy, rolling waves."},
    {max:5,text:"Chest to head-high — proper intermediate waves, duck-diving required."},
    {max:7,text:"Head to overhead — solid and powerful."},
    {max:12,text:"Well overhead — experienced surfers only."},
  ];
  const trans = descriptors.find(d=>high<=d.max)?.text || "Well overhead — experts only.";
  return (<div key={swapKey} className="fh-block swap-enter">
    <div className="fh-lbl">Expected face height</div>
    <div className="fh-val">{low}–{high}<span className="unit">ft</span></div>
    <WaveGlyph heightFt={(low+high)/2}/>
    <div className="fh-conv">{midM} m · {(hour.swellHeight*0.9).toFixed(1)}m @ {per}s</div>
    <div className="fh-trans">{trans}</div>
  </div>);
}

/* ─────────── Swell direction inline tag (mini animated compass arrow) ─────────── */
function SwellDirTag({dir}){
  const deg = ({N:0,NE:45,E:90,SE:135,S:180,SSW:202,SW:225,WSW:247,W:270,NW:315})[dir] ?? 225;
  return (<span style={{display:"inline-flex",alignItems:"center",gap:4,fontWeight:600,color:"var(--text)"}}>
    <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:`rotate(${deg}deg)`,transition:"transform 0.5s cubic-bezier(.3,.8,.3,1)"}}>
      <path d="M6 1 L6 11 M3 4 L6 1 L9 4" fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    {dir}
  </span>);
}

/* ─────────── Metric card (expandable) ─────────── */
function MetricCard({icon,label,val,unit,sub,expanded,onToggle,children}){
  return (<div className="m-card-expandable" onClick={onToggle}>
    <div className="m-lbl">{icon}{label}</div>
    <div className="m-val">{val}{unit && <span className="unit">{unit}</span>}</div>
    <div className="m-sub">{sub}</div>
    <div className={`m-expand ${expanded?"open":""}`}><div className="m-expand-inner">{children}</div></div>
  </div>);
}

/* ─────────── Wind rose ─────────── */
function WindRose({deg}){
  const rad = (deg-90)*Math.PI/180;
  const r = 26; const x = 40+Math.cos(rad)*r, y = 40+Math.sin(rad)*r;
  return (<svg className="wind-rose" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="32"/>
    <circle cx="40" cy="40" r="18"/>
    <text x="40" y="9" textAnchor="middle">N</text>
    <text x="74" y="43" textAnchor="middle">E</text>
    <text x="40" y="78" textAnchor="middle">S</text>
    <text x="7" y="43" textAnchor="middle">W</text>
    <line className="arrow" x1="40" y1="40" x2={x} y2={y}/>
    <circle cx={x} cy={y} r="3" fill="var(--accent)" stroke="none"/>
  </svg>);
}

/* ─────────── Driving chips ─────────── */
function DrivingChips({hour}){
  const chips = window.drivingChipsFor(hour);
  return (<div className="drv">
    <div className="drv-h">What's driving the score</div>
    <div className="drv-chips">{chips.map((c,i)=>(<span key={i} className={`chip ${c.k}`}>{c.t}</span>))}</div>
  </div>);
}

/* ─────────── Best window ─────────── */
function BestWindow({day}){
  const best = day.bestHour;
  return (<div className="best">
    <div className="best-lbl">Best window</div>
    <div className="best-val">Around {window.fmtHour(best.hour)} · <span className="score">{best.score} score</span></div>
    <div className="best-sub">{best.swellHeight.toFixed(1)}m @ {Math.round(best.swellPeriod)}s · {Math.round(best.windKmh)}km/h {best.windDir}</div>
  </div>);
}

/* ─────────── Hourly list — each row can expand inline with more detail ─────────── */
function HourlyList({hours, selectedIdx, onSelect, currentHour}){
  const [openIdx, setOpenIdx] = React.useState(null);
  const handleClick = (i)=>{
    onSelect(i);
    setOpenIdx(o=> o===i ? null : i);
  };
  return (<div className="hly">
    <div className="hly-h"><span className="t">Hourly</span><span className="i">ⓘ</span></div>
    <div>{hours.map((h,i)=>{
      const v = window.coherentVerdict(h);
      const wpct = Math.max(4, h.score);
      const past = h.hour < currentHour;
      const isOpen = openIdx===i;
      return (<div key={i} className={`hly-row-wrap ${isOpen?"open":""}`}>
        <div className={`hly-row ${selectedIdx===i?"selected":""} ${past?"past":""}`} onClick={()=>handleClick(i)}>
          <div className="hly-time">{window.fmtHour(h.hour)}</div>
          <div className="hly-bar"><div className="hly-fill" style={{width:wpct+"%", background:v.color, animationDelay:`${i*0.015}s`}}/></div>
          <div className="hly-right">
            <div style={{textAlign:"right"}}>
              <div className="hly-score" style={{color:v.color}}>{h.score}</div>
              <div className="hly-verd" style={{color:v.color}}>{v.label.toUpperCase()}</div>
            </div>
            <div className="hly-meta">{h.faceFtLow}-{h.faceFtHigh}ft<br/>{Math.round(h.windKmh)}km/h</div>
          </div>
        </div>
        <div className={`hly-expand ${isOpen?"open":""}`}>
          <div className="hly-expand-inner">
            <div className="hly-ex-grid">
              <div><div className="m-lbl">Swell</div><div className="hly-ex-val">{h.swellHeight.toFixed(1)}<span className="unit">m</span></div><div className="hly-ex-sub">{h.swellDir} · {Math.round(h.swellPeriod)}s</div></div>
              <div><div className="m-lbl">Wind</div><div className="hly-ex-val">{Math.round(h.windKmh)}<span className="unit">km/h</span></div><div className="hly-ex-sub">{h.windDir} · {h.windType}</div></div>
              <div><div className="m-lbl">Face</div><div className="hly-ex-val">{h.faceFtLow}–{h.faceFtHigh}<span className="unit">ft</span></div><div className="hly-ex-sub">{(h.swellHeight*0.9).toFixed(1)}m face</div></div>
              <div><div className="m-lbl">Score</div><div className="hly-ex-val" style={{color:v.color}}>{h.score}</div><div className="hly-ex-sub" style={{color:v.color}}>{v.label}</div></div>
            </div>
            <div className="hly-ex-note">{v.sub}</div>
          </div>
        </div>
      </div>);
    })}</div>
  </div>);
}

/* ─────────── Tide curve (draggable) ─────────── */
function TideCurve({hours, selectedIdx, onSelect}){
  const W=340, H=110, pad=14;
  const base = hours[0].hour;
  const xs = (hr)=> pad + ((hr-base)/(hours[hours.length-1].hour-base))*(W-pad*2);
  const tideVal = (hr)=>{ const t = (hr-5)/24*Math.PI*2; return 0.5 + 0.45*Math.sin(t); };
  const ys = (v)=> H-20 - v*(H-36);
  const pts = hours.map(h=>[xs(h.hour), ys(tideVal(h.hour))]);
  const d = pts.map((p,i)=>`${i?"L":"M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = d + ` L ${pts[pts.length-1][0]},${H-16} L ${pts[0][0]},${H-16} Z`;
  const sel = pts[selectedIdx];
  const peaks = [];
  for(let i=1;i<hours.length-1;i++){
    const v0=tideVal(hours[i-1].hour), v1=tideVal(hours[i].hour), v2=tideVal(hours[i+1].hour);
    if((v1>v0 && v1>v2) || (v1<v0 && v1<v2)) peaks.push({idx:i, hi:v1>v0});
  }
  const svgRef = React.useRef(null);
  const handleDrag = (e)=>{
    const svg = svgRef.current; if(!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = (e.touches?e.touches[0].clientX:e.clientX) - rect.left;
    const px = (cx/rect.width)*W;
    let best=0, bd=Infinity;
    hours.forEach((h,i)=>{ const d=Math.abs(xs(h.hour)-px); if(d<bd){bd=d;best=i;} });
    onSelect(best);
  };
  return (<div className="tide">
    <div className="tide-h">Tide across the day</div>
    <svg ref={svgRef} className="tide-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
         onMouseDown={(e)=>{handleDrag(e); const up=()=>{window.removeEventListener("mousemove",handleDrag);window.removeEventListener("mouseup",up);}; window.addEventListener("mousemove",handleDrag); window.addEventListener("mouseup",up);}}
         onTouchStart={handleDrag} onTouchMove={handleDrag}>
      <path className="tide-fill" d={area}/>
      <path className="tide-path" d={d}/>
      {peaks.map((p,i)=>(<g key={i}>
        <circle cx={pts[p.idx][0]} cy={pts[p.idx][1]} r="2.5" fill="var(--accent)"/>
        <text className="tide-label peak" x={pts[p.idx][0]} y={pts[p.idx][1]-8} textAnchor="middle">{p.hi?"H":"L"} {window.fmtHour(hours[p.idx].hour).replace(":00","")}</text>
      </g>))}
      <line className="tide-marker" x1={sel[0]} y1="10" x2={sel[0]} y2={H-16}/>
      <circle className="tide-dot" cx={sel[0]} cy={sel[1]} r="5.5"/>
      <text className="tide-axis" x={pad} y={H-3} textAnchor="start">{hours[0].hour>=12?(hours[0].hour-12)+"pm":hours[0].hour+"am"}</text>
      <text className="tide-axis" x={W/2} y={H-3} textAnchor="middle">12pm</text>
      <text className="tide-axis" x={W-pad} y={H-3} textAnchor="end">{hours[hours.length-1].hour>=12?(hours[hours.length-1].hour-12)+"pm":hours[hours.length-1].hour+"am"}</text>
    </svg>
  </div>);
}

/* ─────────── Level matrix ─────────── */
function LevelMatrix({hour}){
  const m = window.levelMatrixFor(hour);
  const text = { yes:"GO", ok:"WORTH IT", no:"SKIP" };
  return (<div className="lvl-block">
    <div className="lvl-head"><span className="lvl-h">Can you surf?</span>
      <button className="lvl-me-btn">Your level <span className="chev">▾</span></button></div>
    {m.map((l,i)=>(<div key={i} className="lvl-row">
      <div><div className="lvl-name">{l.name}</div><div className="lvl-reason">{l.reason}</div></div>
      <span className={`pill ${l.verdict}`}>{text[l.verdict]}</span>
    </div>))}
  </div>);
}

/* ─────────── Footer ─────────── */
function Footer(){ return (<div className="footer">
  <p>Forecast based on public weather APIs (Open-Meteo / ECMWF / GFS).<br/>Ocean conditions can shift fast — always recheck on the morning of your session and trust what you see at the beach.</p>
  <div className="attr">marine data · open-meteo</div>
</div>); }

/* ─────────── Score sheet (modal explainer with breakdown) ─────────── */
function ScoreSheet({hour, verdict, onClose}){
  const bd = window.scoreBreakdown(hour);
  const scale = window.SCORE_SCALE;
  return (<div className="sheet-backdrop" onClick={onClose}>
    <div className="sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-grip"/>
      <div className="sheet-head">
        <div className="sheet-eyebrow mono">HOW THIS SCORE IS BUILT</div>
        <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* Big number */}
      <div className="sheet-bignum">
        <span className="sheet-num" style={{color:verdict.color}}>{bd.total}</span>
        <span className="sheet-den">/100</span>
        <span className="sheet-verd" style={{color:verdict.color}}>{verdict.label}</span>
      </div>
      <div className="sheet-intro">We weigh <b>size</b>, <b>swell period</b>, <b>swell direction</b> and <b>wind</b> against this spot's profile. Long-period groundswell with light offshore wind scores highest.</div>

      {/* Factor bars */}
      <div className="sheet-bars">
        {bd.factors.map(f => (
          <div key={f.key} className="sf-row">
            <div className="sf-top">
              <span className="sf-label">{f.label}</span>
              <span className="sf-value mono">{f.value}</span>
              <span className="sf-pts mono"><b>{f.pts}</b><span className="sf-max">/{f.max}</span></span>
            </div>
            <div className="sf-bar"><div className="sf-fill" style={{width:`${(f.pts/f.max)*100}%`, background:verdict.color}}/></div>
            <div className="sf-note">{f.note}</div>
          </div>
        ))}
      </div>

      {/* Scale legend */}
      <div className="sheet-scale">
        <div className="sheet-eyebrow mono" style={{marginBottom:8}}>SCORE BANDS</div>
        {scale.map((s,i) => (
          <div key={i} className="ssc-row">
            <span className="ssc-dot" style={{background:s.color}}/>
            <span className="ssc-range mono">{s.min}–{s.max}</span>
            <span className="ssc-name" style={{color:s.color}}>{s.label}</span>
            <span className="ssc-sub">{s.sub}</span>
          </div>
        ))}
      </div>

      <button className="sheet-cta" onClick={onClose}>Got it</button>
    </div>
  </div>);
}

Object.assign(window,{VerdictHero,FaceHeightHero,StickyInfoBar,SwellDirTag,WaveGlyph,MetricCard,WindRose,DrivingChips,BestWindow,HourlyList,TideCurve,LevelMatrix,ScoreSheet,Footer});
