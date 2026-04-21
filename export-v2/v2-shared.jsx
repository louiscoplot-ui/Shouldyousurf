// v2-shared.jsx — status bar, phone frame, icons, useScrubTween hook

function StatusBar(){ return (<div className="status">
  <span>9:41</span>
  <div className="glyphs">
    <svg width="15" height="11" viewBox="0 0 16 11"><path d="M3 9 L8 5 L13 9 M5 10.5 L8 8 L11 10.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
    <div className="bars"><span/><span/><span/><span/></div>
    <div className="batt"><span style={{width:"78%"}}/></div>
  </div>
</div>); }

function Phone({children}){ return (<div className="phone"><StatusBar/><div className="viewport">{children}</div></div>); }

function SwellIcon(){return(<svg className="mi" viewBox="0 0 24 24"><path d="M3 14c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/><path d="M3 19c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/></svg>);}
function WindIcon(){return(<svg className="mi" viewBox="0 0 24 24"><path d="M3 9h12a3 3 0 1 0-3-3"/><path d="M3 14h17a3 3 0 1 1-3 3"/></svg>);}
function TideIcon(){return(<svg className="mi" viewBox="0 0 24 24"><path d="M3 12c3 0 3-6 6-6s3 6 6 6 3-6 6-6"/></svg>);}
function SunIcon(){return(<svg className="mi" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5"/></svg>);}
function DropIcon(){return(<svg className="mi" viewBox="0 0 24 24"><path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"/></svg>);}
function ArrowIcon({deg=0}){return(<svg className="mi" viewBox="0 0 24 24" style={{transform:`rotate(${deg}deg)`}}><path d="M12 4v16M6 10l6-6 6 6"/></svg>);}

// Counts a number up/down smoothly
function useTween(target, dur=400){
  const [v,setV] = React.useState(target);
  const ref = React.useRef({from:target,to:target,t0:0,raf:0});
  React.useEffect(()=>{
    const r = ref.current; r.from = v; r.to = target; r.t0 = performance.now();
    cancelAnimationFrame(r.raf);
    const tick=(t)=>{ const p=Math.min(1,(t-r.t0)/dur); const e=1-Math.pow(1-p,3);
      const val = r.from + (r.to-r.from)*e; setV(val);
      if(p<1) r.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(r.raf);
  },[target]);
  return v;
}

// Bumps a key every time deps change so children can rerun swap animations
function useSwapKey(dep){
  const [k,setK] = React.useState(0);
  React.useEffect(()=>{ setK(x=>x+1); },[dep]);
  return k;
}

Object.assign(window,{StatusBar,Phone,SwellIcon,WindIcon,TideIcon,SunIcon,DropIcon,ArrowIcon,useTween,useSwapKey});
