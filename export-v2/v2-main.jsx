// v2-main.jsx — main screen, now with coherent verdict logic, level quick-picker, row-expand, and dynamic elements.

/* ───── Palette override: warm paper + jade ───── */
(function overridePalette(){
  window.SCORE_SCALE = [
    { key:"pumping", min: 75, max: 100, color: "#1d6a5b", label: "Pumping", sub: "Prime, memorable conditions" },
    { key:"great",   min: 55, max: 74,  color: "#2d9178", label: "Great",   sub: "Clean, well-shaped" },
    { key:"good",    min: 45, max: 54,  color: "#62a06a", label: "Good",    sub: "Solid session" },
    { key:"fun",     min: 35, max: 44,  color: "#a4a558", label: "Fun",     sub: "Surfable but unremarkable" },
    { key:"small",   min: 15, max: 34,  color: "#d47559", label: "Small",   sub: "Longboard or skip" },
    { key:"flat",    min: 0,  max: 14,  color: "#b54c3f", label: "Flat",    sub: "Nothing to surf" },
  ];
  window.getLevel = (s)=> window.SCORE_SCALE.find(x=>s>=x.min && s<=x.max) || window.SCORE_SCALE[5];
})();

/* ───── Coherent verdict: label derived from BOTH score and conditions ───── */
window.coherentVerdict = function(h){
  const face = (h.faceFtLow + h.faceFtHigh)/2;
  const cross = (h.windType||"").toLowerCase().includes("cross");
  const on    = (h.windType||"").toLowerCase().includes("onshore");
  const hardWind = h.windKmh >= 25;
  const isWrecked = (cross||on) && hardWind;
  const scale = window.SCORE_SCALE;

  // If actual waves exist but wind wrecks them, call it "Blown out"
  if(isWrecked && face >= 1.5){
    return { key:"blown", label:"Blown out", color:"#b54c3f",
             sub:"There are waves, but wind makes it unsurfable." };
  }
  // Very small waves: "Small" regardless of a lucky RNG score
  if(face < 1.5){
    return { key:"small", label:"Small", color:"#d47559",
             sub:"Tiny waves — groms or longboard only." };
  }
  // If genuinely no wave energy
  if(h.swellHeight < 0.4){
    return { key:"flat", label:"Flat", color:"#b54c3f",
             sub:"Nothing to surf." };
  }
  // Otherwise trust the score band
  const s = window.getLevel(h.score);
  const labelMap = { pumping:"Pumping", great:"Great", good:"Good", fun:"Fun", small:"Small", flat:"Flat" };
  const subMap = {
    pumping:"Everything aligned — go now.",
    great:"Clean, well-organized waves. Worth rearranging your morning.",
    good:"Solid fun session. Not memorable but you'll enjoy it.",
    fun:"Surfable but unremarkable. Worth a paddle if you have nothing better.",
    small:"Little wave energy — longboard only.",
    flat:"Nothing to surf.",
  };
  return { key:s.key, label:labelMap[s.key]||s.label, color:s.color, sub:subMap[s.key]||s.sub };
};

/* ───── Score breakdown: explains the 0-100 score with weighted factors ───── */
window.scoreBreakdown = function(h){
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const period = h.swellPeriod;
  const wind = h.windKmh;
  const dir = h.swellDir;
  const type = (h.windType || "").toLowerCase();

  // SIZE: weight 30, ideal 3-6ft
  let sizePts = 0, sizeNote = "";
  if (face < 1) { sizePts = 4;  sizeNote = "Almost flat"; }
  else if (face < 2) { sizePts = 12; sizeNote = "Small"; }
  else if (face < 3) { sizePts = 22; sizeNote = "Knee–waist, learn-friendly"; }
  else if (face <= 6) { sizePts = 30; sizeNote = "Sweet spot"; }
  else if (face <= 9) { sizePts = 24; sizeNote = "Overhead — for confident surfers"; }
  else { sizePts = 14; sizeNote = "Big — limits the crowd"; }

  // PERIOD: weight 25, ideal 12s+
  let perPts = 0, perNote = "";
  if (period < 8)       { perPts = 6;  perNote = "Short period — windswell"; }
  else if (period < 11) { perPts = 14; perNote = "Mixed swell"; }
  else if (period < 14) { perPts = 22; perNote = "Decent groundswell"; }
  else                  { perPts = 25; perNote = "Long-period groundswell"; }

  // DIRECTION: weight 20
  let dirPts = 0, dirNote = "";
  const ideal = ["SW","WSW","S","SSW"];
  if (ideal.includes(dir)) { dirPts = 20; dirNote = `${dir} — ideal angle`; }
  else if (["W","SE"].includes(dir)) { dirPts = 14; dirNote = `${dir} — workable angle`; }
  else { dirPts = 8;  dirNote = `${dir} — off-axis`; }

  // WIND: weight 25
  let windPts = 0, windNote = "";
  if (type.includes("offshore") && wind < 12) { windPts = 25; windNote = "Light offshore — glassy"; }
  else if (type.includes("offshore"))         { windPts = 22; windNote = "Offshore"; }
  else if (wind < 10)                          { windPts = 20; windNote = "Light winds"; }
  else if (type.includes("cross") && wind < 20){ windPts = 14; windNote = "Cross-shore, manageable"; }
  else if (type.includes("cross"))             { windPts = 8;  windNote = "Strong cross-shore"; }
  else if (wind < 18)                          { windPts = 10; windNote = "Light onshore"; }
  else                                         { windPts = 3;  windNote = "Onshore — blown out"; }

  const total = sizePts + perPts + dirPts + windPts;
  return {
    total,
    factors: [
      { key:"size",   label:"Wave size",       value:`${h.faceFtLow}–${h.faceFtHigh} ft`,  pts:sizePts, max:30, note:sizeNote },
      { key:"period", label:"Swell period",    value:`${period.toFixed(0)}s`,              pts:perPts,  max:25, note:perNote  },
      { key:"dir",    label:"Swell direction", value:dir,                                  pts:dirPts,  max:20, note:dirNote  },
      { key:"wind",   label:"Wind",            value:`${Math.round(wind)} km/h ${type||""}`.trim(), pts:windPts, max:25, note:windNote },
    ],
  };
};

/* ───── Driving chips, coherent with verdict ───── */
window.drivingChipsFor = function(h){
  const chips = [];
  if(h.swellPeriod<9) chips.push({t:"Short-period swell",k:"neg"}); else if(h.swellPeriod>=12) chips.push({t:"Long-period groundswell",k:"pos"});
  if(h.swellHeight>=0.9 && h.swellHeight<=2.0) chips.push({t:"Good size",k:"pos"});
  else if(h.swellHeight<0.6) chips.push({t:"Small swell",k:"neg"});
  if(["SW","WSW","W","SSW"].includes(h.swellDir)) chips.push({t:"Ideal swell direction",k:"pos"});
  if(h.windKmh>=25) chips.push({t:"Strong cross-shore",k:"neg"});
  else if(h.windKmh<=10) chips.push({t:"Light winds",k:"pos"});
  else if((h.windType||"").toLowerCase().includes("off")) chips.push({t:"Offshore wind",k:"pos"});
  chips.push({t:"Tide in the sweet spot",k:"pos"});
  return chips;
};

function MainScreen(){
  const spot = window.BREAKS[0];
  const days = React.useMemo(()=>window.makeForecast(spot.id),[spot.id]);
  const [dayIdx, setDayIdx] = React.useState(days.findIndex(d=>d.label==="Today"));
  const day = days[dayIdx];
  const currentHour = 15;
  const [selectedIdx, setSelectedIdx] = React.useState(()=>{
    const i = day.hours.findIndex(h=>h.hour===currentHour);
    return i>=0 ? i : day.hours.indexOf(day.bestHour);
  });
  React.useEffect(()=>{
    const i = day.hours.findIndex(h=>h.hour===currentHour);
    setSelectedIdx(i>=0 ? i : day.hours.indexOf(day.bestHour));
  },[dayIdx]);

  const hour = day.hours[selectedIdx];
  const swapKey = window.useSwapKey(`${dayIdx}-${selectedIdx}`);

  const [expanded, setExpanded] = React.useState(null);
  const tog = (k)=> setExpanded(e=> e===k?null:k);

  const [userLevel, setUserLevel] = React.useState("int");

  const hlyWrapRef = React.useRef(null);
  React.useEffect(()=>{
    const el = hlyWrapRef.current?.querySelector(".hly-row.selected");
    if(el) el.scrollIntoView?.({block:"nearest", behavior:"smooth"});
  },[selectedIdx]);

  const [ago,setAgo] = React.useState(3);
  React.useEffect(()=>{ const t = setInterval(()=>setAgo(a=>a+1), 60000); return ()=>clearInterval(t); },[]);

  const verdict = window.coherentVerdict(hour);
  const [scoreOpen, setScoreOpen] = React.useState(false);

  // Sticky info-bar: watch a sentinel at the top of the bar. When it scrolls past
  // the top of the viewport, the bar becomes stuck (position:sticky via class).
  const sibSentinelRef = React.useRef(null);
  const [sibStuck, setSibStuck] = React.useState(false);
  React.useEffect(()=>{
    const el = sibSentinelRef.current;
    if(!el) return;
    const root = el.closest('.viewport');
    if(!root) return;
    // Poll scroll — more reliable than IntersectionObserver for this case
    // (the sentinel sits just above the bar; when it scrolls above the viewport top,
    // the bar pins).
    function onScroll(){
      const rect = el.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setSibStuck(rect.top <= rootRect.top);
    }
    root.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
    return ()=>root.removeEventListener('scroll', onScroll);
  },[]);

  return (<div className="wrap">
    {/* Header */}
    <div className="hdr rise-1">
      <div className="brand-row"><span className="now-dot"/><span className="brand">should you surf?</span></div>
      <div className="hdr-actions">
        <button className="ibtn">?</button>
        <button className="ibtn lang"><span>AU</span><span className="on">EN</span></button>
        <button className="ibtn fav">★</button>
      </div>
    </div>

    {/* Spot */}
    <div className="rise-1">
      <button className="spot-btn">
        <span className="spot-name">{spot.name}</span>
        <span className="spot-chev">▾</span>
      </button>
      <div className="spot-region">{spot.region} · {spot.type}</div>
    </div>

    {/* Day tabs */}
    <div className="rise-2">
      <div className="day-tabs">
        {days.map((d,i)=>(<button key={i} onClick={()=>setDayIdx(i)} className={`dt ${i===dayIdx?"active":""} ${d.isPast?"past":""}`}>
          <div className="dt-day">{d.label}</div><div className="dt-date">{d.dateLabel}</div>
          <div className="dt-dot" style={{background:d.bestLevel.color}}/>
        </button>))}
      </div>
    </div>

    {/* Time pill + ticker */}
    <div className="rise-2" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <button className="time-pill">
        <span className="dayw">{days[dayIdx].label}</span>
        <span className="hr">{window.fmtHour(hour.hour)}</span>
        <span style={{color:"var(--text-dim)"}}>▾</span>
      </button>
      <span className="mono" style={{fontSize:9.5,color:"var(--text-dim)",letterSpacing:"0.12em"}}>UPDATED {ago}M AGO</span>
    </div>

    {/* Verdict hero (coherent) */}
    <VerdictHero verdict={verdict} hour={hour} swapKey={swapKey} onOpenScore={()=>setScoreOpen(true)}/>

    {/* Score sheet (modal) */}
    {scoreOpen && <ScoreSheet hour={hour} verdict={verdict} onClose={()=>setScoreOpen(false)}/>}

    {/* Level quick picker (replaces the 🚫) */}
    <div className="lvl-inline rise-3">
      <button className="lvl-me-btn" onClick={()=>{}}>Your level <span className="chev">▾</span></button>
      <div className="lvl-quick" role="tablist">
        {[["beg","BEG"],["eint","E·INT"],["int","INT"],["adv","ADV"],["exp","EXP"]].map(([k,lbl])=>(
          <button key={k} className={userLevel===k?"on":""} onClick={()=>setUserLevel(k)}>{lbl}</button>
        ))}
      </div>
    </div>

    {/* Sentinel must sit JUST BEFORE the sticky bar — when it scrolls above
       viewport top, the bar pins. Height 1px, invisible. */}
    <div ref={sibSentinelRef} aria-hidden="true" style={{height:1,margin:"16px 0 -17px"}}/>

    {/* Sticky info bar — the always-visible summary from the reference.
       Includes the reason intro + face height + 6 compact metrics.
       Sticks to the top when scrolled past. */}
    <StickyInfoBar
      hour={hour}
      swapKey={swapKey}
      reasonText={verdict.sub}
      sentinelRef={null}
      stuck={sibStuck}
    />

    {/* Driving chips */}
    <DrivingChips hour={hour}/>

    {/* Best window */}
    <BestWindow day={day}/>

    {/* Hourly list (scrubber + row expand) */}
    <div ref={hlyWrapRef}>
      <HourlyList hours={day.hours} selectedIdx={selectedIdx} onSelect={setSelectedIdx} currentHour={currentHour}/>
    </div>

    {/* Tide curve */}
    <TideCurve hours={day.hours} selectedIdx={selectedIdx} onSelect={setSelectedIdx}/>

    {/* Level matrix */}
    <LevelMatrix hour={hour}/>

    {/* Footer */}
    <Footer/>
  </div>);
}

Object.assign(window,{MainScreen});
