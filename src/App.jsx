import { useState, useEffect, useRef } from "react";

const B = {
  amber:       "#E8A020",
  amberLight:  "#FDF3E3",
  amberPale:   "#FDFAF6",
  amberDark:   "#B87010",
  nearBlack:   "#1C1510",
  warmGrey:    "#8C7B6B",
  lightGrey:   "#F0EBE3",
  midGrey:     "#D4C9BB",
  success:     "#4A8C5C",
  successLight:"#E8F5E9",
  danger:      "#C0392B",
  dangerLight: "#FDECEA",
  white:       "#FFFFFF",
};

// ─── LOGO SVG ─────────────────────────────────────────────────────────────────
function Logo({ size = 24, dark = false }) {
  const s = size;
  const pts = `${s*0.08},${s*0.72} ${s*0.27},${s*0.92} ${s*0.50},${s*0.28} ${s*0.70},${s*0.68} ${s*0.95},${s*0.12}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{flexShrink:0}}>
      <polyline points={pts} fill="none" stroke={dark?"#ffffff":B.amber}
        strokeWidth={s*0.11} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={s*0.95} cy={s*0.12} r={s*0.08} fill={dark?"#ffffff":B.amber}/>
    </svg>
  );
}

function LogoWordmark({ size = 22, onDark = false }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <Logo size={size} dark={onDark}/>
      <span style={{
        fontFamily:"system-ui,-apple-system,sans-serif",
        fontSize:size*0.85,fontWeight:600,letterSpacing:"-0.01em",
        color:onDark?B.white:B.nearBlack,
      }}>
        <span style={{color:onDark?B.amber:B.amber}}>W</span>ageSave
      </span>
    </div>
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_MULT = {Mon:0.72,Tue:0.78,Wed:0.88,Thu:0.95,Fri:1.22,Sat:1.35,Sun:1.08};
const WEEK_VARIANCE = [1.0,0.93,1.08,0.97,1.12,0.89,1.05,0.98,1.14,0.91,1.03,0.96,1.10,0.86];

// Seasonal multipliers by month (Jan=0 ... Dec=11)
// Summer multipliers tuned from Barry's real Square data:
// Jan avg ~$5,300/day vs Apr avg ~$1,670/day = 3.17x
// Jan=3.2, Feb=2.8, Mar=1.8, Apr=1.0(baseline), May=0.85, Jun=0.72,
// Jul=0.68, Aug=0.70, Sep=0.80, Oct=0.95, Nov=1.40, Dec=2.80
const SEASON_MULT_SUMMER = [3.20,2.80,1.80,1.0,0.85,0.72,0.68,0.70,0.80,0.95,1.40,2.80];
const SEASON_MULT_WINTER  = [0.75,0.78,0.88,0.95,1.05,1.20,1.30,1.25,1.10,0.95,0.85,0.80];
const SEASON_MULT_FLAT    = [1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0];

const HOURS_LIST = Array.from({length:24},(_,i)=>{
  const h=i%12===0?12:i%12;
  return {value:i,label:`${h}${i<12?"am":"pm"}`};
});

const VIC_HOLIDAYS = {
  "2026-01-01":"New Year's Day","2026-01-26":"Australia Day",
  "2026-03-09":"Labour Day","2026-04-03":"Good Friday",
  "2026-04-04":"Easter Saturday","2026-04-05":"Easter Sunday",
  "2026-04-06":"Easter Monday","2026-04-25":"Anzac Day",
  "2026-06-08":"King's Birthday","2026-11-03":"Melbourne Cup Day",
  "2026-12-25":"Christmas Day","2026-12-26":"Boxing Day",
  "2026-12-28":"Boxing Day (substitute)",
};

// ─── VIC SCHOOL HOLIDAYS 2026 ────────────────────────────────────────────────
// Each entry is [start, end] inclusive
const VIC_SCHOOL_HOLIDAYS_2026 = [
  ["2026-01-01","2026-01-27"],  // Summer holidays
  ["2026-03-28","2026-04-13"],  // Easter / Term 1 break
  ["2026-06-27","2026-07-13"],  // Winter holidays
  ["2026-09-19","2026-10-05"],  // Spring holidays
  ["2026-12-19","2026-12-31"],  // Summer holidays start
];

function isSchoolHoliday(date) {
  const dk = dateKey(date);
  return VIC_SCHOOL_HOLIDAYS_2026.some(([start, end]) => dk >= start && dk <= end);
}

function isLongWeekend(date) {
  const dk = dateKey(date);
  const dow = date.getDay(); // 0=Sun, 1=Mon, 5=Fri, 6=Sat
  // Check if adjacent to a public holiday
  const prev = new Date(date); prev.setDate(date.getDate()-1);
  const next = new Date(date); next.setDate(date.getDate()+1);
  const prevKey = dateKey(prev);
  const nextKey = dateKey(next);
  // Friday before a Monday public holiday
  if (dow === 5 && VIC_HOLIDAYS[nextKey + "skip"] === undefined && isHolidayKey(nextKey) === false) {
    const mon = new Date(date); mon.setDate(date.getDate()+3);
    if (VIC_HOLIDAYS[dateKey(mon)]) return true;
  }
  // Friday before a Monday holiday (standard long weekend)
  if (dow === 5) {
    const sat = new Date(date); sat.setDate(date.getDate()+1);
    const sun = new Date(date); sun.setDate(date.getDate()+2);
    const mon = new Date(date); mon.setDate(date.getDate()+3);
    if (VIC_HOLIDAYS[dateKey(mon)]) return true;
  }
  // Saturday or Sunday of a long weekend
  if (dow === 6 || dow === 0) {
    const mon = new Date(date);
    mon.setDate(date.getDate() + (dow === 6 ? 2 : 1));
    if (VIC_HOLIDAYS[dateKey(mon)]) return true;
  }
  // Tuesday after a Monday holiday
  if (dow === 2 && VIC_HOLIDAYS[prevKey]) return true;
  return false;
}

function isHolidayKey(dk) {
  return !!VIC_HOLIDAYS[dk];
}

// ─── LOCAL EVENTS SYSTEM ─────────────────────────────────────────────────────
// Each event: { id, name, icon, dates:["YYYY-MM-DD",...], impact, mult, recurrence }
const DEFAULT_LOCAL_EVENTS = [
  { id:"bh-jet-1",    name:"JET — Barwon Heads Hotel",          icon:"🎸", dates:["2026-05-14"], impact:"+25%", mult:1.25, recurrence:"one-off" },
  { id:"bh-jet-2",    name:"JET SOLD OUT — Barwon Heads Hotel",  icon:"🎸", dates:["2026-05-15"], impact:"+35%", mult:1.35, recurrence:"one-off" },
  { id:"bh-cap",      name:"Fabulous Caprettos — BH Hotel",      icon:"🎸", dates:["2026-05-29"], impact:"+25%", mult:1.25, recurrence:"one-off" },
];

function dateToLocal(dateStr){
  // Parse YYYY-MM-DD as local date, not UTC — avoids timezone offset shifting day
  const[y,m,d]=dateStr.split("-").map(Number);
  return new Date(y,m-1,d);
}

function getLocalEvents(date, localEvents=[]) {
  const dk = dateKey(date);

  return localEvents.filter(ev => {
    if (!ev.dates || ev.dates.length === 0) return false;
    const startDk = ev.dates[0];

    if (ev.recurrence === "one-off") {
      return startDk === dk;
    }

    // Must be on or after the start date
    const startLocal = dateToLocal(startDk);
    const checkLocal = dateToLocal(dk);
    if (checkLocal < startLocal) return false;

    const diffMs = checkLocal.getTime() - startLocal.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (ev.recurrence === "weekly")      return diffDays % 7 === 0;
    if (ev.recurrence === "fortnightly") return diffDays % 14 === 0;
    if (ev.recurrence === "monthly") {
      return startLocal.getDate() === checkLocal.getDate();
    }
    return startDk === dk;
  });
}

function impactToMult(impact) {
  const p = parseFloat((impact||"0").replace("%","")) / 100;
  return 1 + p;
}

const RECURRENCE_OPTIONS = [
  { key:"one-off",  label:"One-off" },
  { key:"weekly",   label:"Every week" },
  { key:"fortnightly", label:"Every fortnight" },
  { key:"monthly",  label:"Monthly" },
];

const EVENT_ICONS = ["🎸","🎪","🏉","🏏","🎭","🎨","🌊","🏄","🎯","🍺","🎉","🏪","📅"];


const DEFAULT_HOURS = {
  Mon:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Tue:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Wed:{open:false,openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Thu:{open:true, openTime:8, closeTime:15,hasDinner:true, dinnerOpen:17,dinnerClose:21},
  Fri:{open:true, openTime:8, closeTime:15,hasDinner:true, dinnerOpen:17,dinnerClose:22},
  Sat:{open:true, openTime:8, closeTime:22,hasDinner:false,dinnerOpen:17,dinnerClose:22},
  Sun:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
};

// Default per-day revenue ranges — min/max are the slider bounds, low/high are the selected range
const DEFAULT_DAY_REVENUE = {
  Mon:{min:200,  max:3000,  low:600,  high:1200},
  Tue:{min:200,  max:3000,  low:600,  high:1200},
  Wed:{min:200,  max:3000,  low:600,  high:1200},
  Thu:{min:500,  max:5000,  low:1000, high:2000},
  Fri:{min:500,  max:8000,  low:1400, high:3000},
  Sat:{min:1000, max:12000, low:2500, high:5500},
  Sun:{min:500,  max:6000,  low:1200, high:2800},
};

// ─── ROLE MODEL ───────────────────────────────────────────────────────────────
function calcRoles(rev, hasKitchen, servesAlcohol) {
  if (rev < 500)  return {roles:[{role:"All-rounder",count:1}],total:1,note:"Quiet day — one person can manage"};
  if (rev < 1500) return {roles:[{role:"All-rounder",count:2}],total:2,note:"Two covering all bases"};
  if (rev < 3000) {
    if (hasKitchen) return {roles:[{role:"Kitchen",count:1},{role:"Coffee & Floor",count:1},{role:"Floor",count:1}],total:3,note:"Roles starting to split"};
    return {roles:[{role:"Coffee",count:1},{role:"Floor",count:2}],total:3,note:"Busy café floor"};
  }
  if (rev < 5000) {
    if (hasKitchen) return {roles:[{role:"Kitchen",count:1},{role:"Coffee",count:1},{role:"Floor",count:2}],total:4,note:"Full service team"};
    return {roles:[{role:"Coffee",count:1},{role:"Floor",count:2},...(servesAlcohol?[{role:"Bar",count:1}]:[])],total:servesAlcohol?4:3,note:"Peak café service"};
  }
  if (rev < 7000) {
    return {
      roles:[...(hasKitchen?[{role:"Kitchen",count:2}]:[]),{role:"Coffee",count:1},{role:"Floor",count:2},...(servesAlcohol?[{role:"Bar",count:1}]:[])],
      total:(hasKitchen?2:0)+3+(servesAlcohol?1:0),note:"Big day — all stations"
    };
  }
  return {
    roles:[...(hasKitchen?[{role:"Kitchen",count:2}]:[]),{role:"Coffee",count:2},{role:"Floor",count:3},...(servesAlcohol?[{role:"Bar",count:1}]:[])],
    total:(hasKitchen?2:0)+5+(servesAlcohol?1:0),note:"Peak trading — all hands"
  };
}

// ─── SHIFT TIMING — respects actual service periods ───────────────────────────
function calcShifts(roles, hours) {
  if (!hours || !hours.open) return [];
  const {openTime:open, closeTime:close, hasDinner, dinnerOpen, dinnerClose} = hours;
  const shifts = [];

  roles.roles.forEach(({role, count}) => {
    for (let i = 0; i < count; i++) {
      if (role === "Kitchen") {
        if (hasDinner && count > 1) {
          // Two kitchen — one for day service, one for dinner
          if (i === 0) shifts.push({role, start:open, end:close, label:"Kitchen — day"});
          else shifts.push({role, start:dinnerOpen - 1, end:dinnerClose, label:"Kitchen — dinner"});
        } else if (hasDinner) {
          // One kitchen covers both — split shift
          shifts.push({role, start:open, end:close, label:"Kitchen (day)"});
          shifts.push({role, start:dinnerOpen - 1, end:dinnerClose, label:"Kitchen (dinner)"});
        } else {
          // Day service only — starts 30min before open for prep, modelled as same hour
          shifts.push({role, start:open, end:close, label:"Kitchen"});
        }
      } else if (role === "Coffee") {
        // Coffee peaks morning — finish before or at close of day service
        const coffeeEnd = hasDinner ? close : Math.min(close, open + 6);
        if (i === 0) shifts.push({role, start:open, end:coffeeEnd, label:"Coffee"});
        else shifts.push({role, start:open + 1, end:hasDinner?dinnerClose:close, label:"Coffee"});
      } else if (role === "Coffee & Floor") {
        shifts.push({role, start:open, end:close, label:"Coffee & Floor"});
      } else if (role === "Floor") {
        const totalHours = hasDinner ? (close - open) + (dinnerClose - dinnerOpen) : close - open;
        if (count === 1) {
          shifts.push({role, start:open, end:hasDinner?dinnerClose:close, label:"Floor"});
        } else if (count === 2) {
          // Stagger — opener and closer
          shifts.push({role, start:open, end:hasDinner?Math.floor((close+dinnerOpen)/2):close, label:"Floor — opener"});
          shifts.push({role, start:open+2, end:hasDinner?dinnerClose:close, label:"Floor — closer"});
        } else {
          // 3 floor — morning, mid, dinner
          shifts.push({role, start:open, end:close, label:"Floor — morning"});
          shifts.push({role, start:open+2, end:hasDinner?dinnerClose:close, label:"Floor — mid"});
          shifts.push({role, start:hasDinner?dinnerOpen:Math.floor((open+close)/2), end:hasDinner?dinnerClose:close, label:"Floor — dinner"});
        }
      } else if (role === "Bar") {
        shifts.push({role, start:hasDinner?dinnerOpen:Math.floor((open+close)/2), end:hasDinner?dinnerClose:close, label:"Bar"});
      } else if (role === "All-rounder") {
        if (i === 0) shifts.push({role, start:open, end:hasDinner?dinnerClose:close, label:"All-rounder"});
        else shifts.push({role, start:open+1, end:hasDinner?dinnerClose:close, label:"All-rounder"});
      }
    }
  });
  return shifts;
}

function formatHour(h) {
  const hour = h%12===0?12:h%12;
  return `${hour}${h<12?"am":"pm"}`;
}

function calcDay(day, baseRev, hasKitchen, servesAlcohol, tradingHours, seasonality, weatherMult=1.0, eventMult=1.0, weekVar=1.0, date, dayRevenue=null) {
  const h = tradingHours[day];
  if (!h || !h.open) return {adj:0,laborBudget:0,byHour:new Array(24).fill(0),roles:{roles:[],total:0,note:"Closed today"},shifts:[],closed:true};

  // Use per-day revenue midpoint if set, otherwise fall back to baseRev * day multipliers
  const dr = dayRevenue && dayRevenue[day];
  const month = date ? date.getMonth() : new Date().getMonth();
  const seasonMults = seasonality==="summer"?SEASON_MULT_SUMMER:seasonality==="winter"?SEASON_MULT_WINTER:SEASON_MULT_FLAT;
  const seasonMult = seasonMults[month];
  const dayBase = (dr && (dr.low || dr.high))
    ? Math.round((dr.low + dr.high) / 2)
    : baseRev * DAY_MULT[day] * weekVar * seasonMult;
  const adj = (dr && (dr.low || dr.high))
    ? dayBase * weatherMult * eventMult
    : dayBase * weatherMult * eventMult;
  const laborBudget = adj * 0.30;
  const totalHours = laborBudget / 29;

  const curve = new Array(24).fill(0);
  const {openTime:open, closeTime:close, hasDinner, dinnerOpen, dinnerClose} = h;

  for (let i=0; i<24; i++) {
    const inDay = i>=open && i<close;
    const inDinner = hasDinner && i>=dinnerOpen && i<dinnerClose;
    if (inDay || inDinner) {
      if (i>=12&&i<=13) curve[i]=1.0;
      else if (hasDinner&&i>=18&&i<=20) curve[i]=inDinner?1.0:0.8;
      else if (i>=9&&i<=11) curve[i]=0.75;
      else if (i===open) curve[i]=0.4;
      else curve[i]=0.55;
    }
  }

  const sum = curve.reduce((a,b)=>a+b,0);
  const byHour = curve.map(v=>sum>0?Math.max(0,Math.round((v/sum)*totalHours)):0);
  const roles = calcRoles(adj, hasKitchen, servesAlcohol);
  const shifts = calcShifts(roles, h);

  // Peak cover — max staff on floor at any one time
  // Derived from roles model: total roles active at peak service period
  // Kitchen splits don't count twice — only roles active simultaneously
  const peakCover = roles.total;

  // Total shift count — may be more than peak cover due to split shifts and staggering
  const totalShifts = shifts.length;

  // Total labour hours across all shifts
  const totalLabourHours = shifts.reduce((sum, s) => sum + (s.end - s.start), 0);

  return {adj, laborBudget, byHour, roles, shifts, peakCover, totalShifts, totalLabourHours, closed:false, seasonMult};
}

function weatherFromCode(code, temp=18){
  if(code>=200&&code<600) return{mult:0.85,label:"🌧 Rain",short:"Rain"};
  if(code>=600&&code<700) return{mult:0.80,label:"🌨 Snow",short:"Snow"};
  if(code>=700&&code<800) return{mult:0.90,label:"🌫 Overcast",short:"Overcast"};
  if(code===800){
    // Perfect beach day — clear + warm = bigger UV/beach multiplier for coastal venues
    if(temp>=24) return{mult:1.35,label:"🏖 Perfect beach day",short:"Beach day",uvBoost:true};
    if(temp>=20) return{mult:1.20,label:"☀️ Sunny & warm",short:"Sunny",uvBoost:true};
    return{mult:1.10,label:"☀️ Clear",short:"Clear"};
  }
  if(code>800) return{mult:1.00,label:"🌥 Cloudy",short:"Cloudy"};
  return{mult:1.00,label:"🌥 Neutral",short:"Neutral"};
}

function greeting(){const h=new Date().getHours();return h<12?"Good morning.":h<17?"Good afternoon.":"Good evening.";}
function getWeekDates(offset=0){const now=new Date(),day=now.getDay(),mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1)+offset*7);return DAYS.map((_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});}
function dateKey(d){
  // Use local date to avoid UTC timezone shifting the day
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function getHoliday(d){return VIC_HOLIDAYS[dateKey(d)]||null;}
function getEvents(d, localEvents=[]){
  // Combine venue local events
  return getLocalEvents(d, localEvents);
}

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
function Label({text}){
  return <p style={{fontSize:11,letterSpacing:"0.1em",color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",fontWeight:600,marginBottom:8}}>{text}</p>;
}

function Stepper({value,onChange,min=0,max=100,step=1,prefix="",suffix=""}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <button onClick={()=>onChange(Math.max(min,value-step))} style={{width:40,height:40,borderRadius:"50%",border:`1.5px solid ${B.midGrey}`,background:B.white,color:B.nearBlack,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
      <span style={{fontSize:24,fontWeight:600,color:B.nearBlack,minWidth:110,textAlign:"center",fontFamily:"system-ui,-apple-system,sans-serif"}}>{prefix}{typeof value==="number"?value.toLocaleString():value}{suffix}</span>
      <button onClick={()=>onChange(Math.min(max,value+step))} style={{width:40,height:40,borderRadius:"50%",border:`1.5px solid ${B.midGrey}`,background:B.white,color:B.nearBlack,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
    </div>
  );
}

function AmberBtn({label,onClick,disabled=false,outline=false,small=false}){
  const[p,setP]=useState(false);
  return(
    <button onClick={onClick} disabled={disabled}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
      onTouchStart={()=>setP(true)} onTouchEnd={()=>setP(false)}
      style={{width:"100%",padding:small?"11px 0":"17px 0",background:outline?"transparent":p?B.amberDark:disabled?"#D4C9BB":B.amber,color:outline?B.amber:B.white,border:outline?`1.5px solid ${B.amber}`:"none",borderRadius:14,fontSize:small?13:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"system-ui,-apple-system,sans-serif",boxShadow:outline?"none":`0 4px 16px rgba(232,160,32,${p||disabled?0.1:0.3})`,transform:p?"scale(0.98)":"scale(1)",transition:"all 0.12s ease",opacity:disabled?0.6:1}}>
      {label}
    </button>
  );
}

function Toggle({value,onChange,yes="Yes",no="No"}){
  return(
    <div style={{display:"flex",gap:10}}>
      {[yes,no].map(opt=>{
        const active=(value===true&&opt===yes)||(value===false&&opt===no);
        return<button key={opt} onClick={()=>onChange(opt===yes)} style={{flex:1,padding:"13px 0",borderRadius:14,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:B.white,color:active?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{opt}</button>;
      })}
    </div>
  );
}

function TimeSelect({value,onChange,label}){
  return(
    <div style={{flex:1}}>
      <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</p>
      <select value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${B.midGrey}`,fontSize:14,fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",cursor:"pointer"}}>
        {HOURS_LIST.map(h=><option key={h.value} value={h.value}>{h.label}</option>)}
      </select>
    </div>
  );
}

function RoleBadge({role,count}){
  const colors={"Kitchen":{bg:"#FFF3E0",text:"#E65100"},"Coffee":{bg:"#E8F5E9",text:"#2E7D32"},"Floor":{bg:"#E3F2FD",text:"#1565C0"},"Coffee & Floor":{bg:"#F3E5F5",text:"#6A1B9A"},"Bar":{bg:"#FCE4EC",text:"#880E4F"},"All-rounder":{bg:B.amberLight,text:B.amberDark}};
  const c=colors[role]||{bg:B.lightGrey,text:B.warmGrey};
  return<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:c.bg,borderRadius:10,padding:"11px 16px",marginBottom:8}}><span style={{fontSize:14,fontWeight:600,color:c.text,fontFamily:"system-ui,-apple-system,sans-serif"}}>{role}</span><span style={{fontSize:20,fontWeight:700,color:c.text,fontFamily:"system-ui,-apple-system,sans-serif"}}>{count}×</span></div>;
}

function ShiftRow({shift}){
  const colors={"Kitchen":{bg:"#FFF3E0",text:"#E65100",dot:"#E65100"},"Coffee":{bg:"#E8F5E9",text:"#2E7D32",dot:"#2E7D32"},"Floor":{bg:"#E3F2FD",text:"#1565C0",dot:"#1565C0"},"Coffee & Floor":{bg:"#F3E5F5",text:"#6A1B9A",dot:"#6A1B9A"},"Bar":{bg:"#FCE4EC",text:"#880E4F",dot:"#880E4F"},"All-rounder":{bg:B.amberLight,text:B.amberDark,dot:B.amber}};
  const c=colors[shift.role]||{bg:B.lightGrey,text:B.warmGrey,dot:B.midGrey};
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:c.bg,borderRadius:10,padding:"11px 14px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:c.dot}}/>
        <span style={{fontSize:14,fontWeight:600,color:c.text,fontFamily:"system-ui,-apple-system,sans-serif"}}>{shift.label}</span>
      </div>
      <span style={{fontSize:13,fontWeight:600,color:c.text,fontFamily:"system-ui,-apple-system,sans-serif",opacity:0.85}}>{formatHour(shift.start)} → {formatHour(shift.end)}</span>
    </div>
  );
}

function MiniBar({byHour}){
  const max=Math.max(...byHour,1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height:18,marginTop:10}}>
      {byHour.map((s,i)=>s>0?<div key={i} style={{flex:1,height:`${Math.max((s/max)*18,2)}px`,background:`${B.amber}66`,borderRadius:2}}/>:byHour.some(x=>x>0)?<div key={i} style={{flex:1,height:2,background:B.lightGrey,borderRadius:2}}/>:null)}
    </div>
  );
}

// ─── FEEDBACK ────────────────────────────────────────────────────────────────
const FEEDBACK_OPTIONS = [
  {key:"right", icon:"✅", label:"Staffing was right",          color:B.success,  bg:B.successLight},
  {key:"over",  icon:"⬆️", label:"Overstaffed — sent someone home", color:B.danger,   bg:B.dangerLight},
  {key:"under", icon:"⬇️", label:"Understaffed — got slammed",  color:"#E65100",  bg:"#FFF3E0"},
];

function FeedbackPanel({feedback, onSave}){
  const[note,setNote]=useState(feedback?.note||"");
  const[saved,setSaved]=useState(!!feedback?.outcome);

  if(saved&&feedback?.outcome){
    const opt=FEEDBACK_OPTIONS.find(o=>o.key===feedback.outcome);
    return(
      <div style={{background:opt.bg,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>{opt.icon}</span>
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:600,color:opt.color,fontFamily:"system-ui,-apple-system,sans-serif"}}>{opt.label}</p>
          {feedback.note&&<p style={{fontSize:12,color:B.warmGrey,marginTop:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>{feedback.note}</p>}
        </div>
        <button onClick={()=>setSaved(false)} style={{fontSize:12,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>Edit</button>
      </div>
    );
  }

  return(
    <div>
      <Label text="How did staffing go?"/>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {FEEDBACK_OPTIONS.map(opt=>(
          <button key={opt.key} onClick={()=>{onSave({outcome:opt.key,note,savedAt:new Date().toISOString()});setSaved(true);}} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:12,border:`1.5px solid ${B.midGrey}`,background:B.white,cursor:"pointer",textAlign:"left",fontFamily:"system-ui,-apple-system,sans-serif",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.background=opt.bg;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=B.midGrey;e.currentTarget.style.background=B.white;}}>
            <span style={{fontSize:20}}>{opt.icon}</span>
            <span style={{fontSize:14,fontWeight:600,color:opt.color}}>{opt.label}</span>
          </button>
        ))}
      </div>
      <textarea placeholder="Optional notes — e.g. 'AFL crowd came in late'" value={note} onChange={e=>setNote(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${B.midGrey}`,fontSize:14,resize:"none",fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",minHeight:64,boxSizing:"border-box"}}/>
    </div>
  );
}

// ─── DUAL RANGE SLIDER ───────────────────────────────────────────────────────
function RangeSlider({min, max, low, high, onChange, step=100}){
  const containerRef = useRef(null);
  // Use internal state for smooth visual during drag
  const [internalLow,  setInternalLow]  = useState(low);
  const [internalHigh, setInternalHigh] = useState(high);
  const dragging = useRef(null);

  // Sync if parent changes
  useEffect(()=>{ setInternalLow(low);  },[low]);
  useEffect(()=>{ setInternalHigh(high);},[high]);

  function snap(val){ return Math.round(val/step)*step; }
  function clamp(val,lo,hi){ return Math.min(Math.max(val,lo),hi); }
  function toPct(val){ return ((val-min)/(max-min))*100; }

  function valFromX(clientX){
    if(!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return snap(clamp(min + clamp((clientX-rect.left)/rect.width,0,1)*(max-min), min, max));
  }

  function startDrag(handle, e){
    e.preventDefault();
    e.stopPropagation();
    dragging.current = handle;

    function move(ev){
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const val = valFromX(clientX);
      if(val===null) return;
      // Update internal state only — fast, no parent re-render
      if(dragging.current==="low")  setInternalLow(v  => clamp(val, min, internalHigh-step));
      if(dragging.current==="high") setInternalHigh(v => clamp(val, internalLow+step, max));
    }

    function end(ev){
      const clientX = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
      const val = valFromX(clientX);
      dragging.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      // Only call onChange once at the end
      if(val!==null){
        const finalLow  = handle==="low"  ? clamp(val,min,high-step)  : internalLow;
        const finalHigh = handle==="high" ? clamp(val,low+step,max)   : internalHigh;
        onChange(finalLow, finalHigh);
      }
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", move, {passive:false});
    window.addEventListener("touchend", end);
  }

  function clickTrack(e){
    if(dragging.current) return;
    const val = valFromX(e.clientX);
    if(val===null) return;
    const distLow  = Math.abs(val-internalLow);
    const distHigh = Math.abs(val-internalHigh);
    if(distLow<=distHigh){
      const newLow = clamp(val,min,internalHigh-step);
      setInternalLow(newLow);
      onChange(newLow, internalHigh);
    } else {
      const newHigh = clamp(val,internalLow+step,max);
      setInternalHigh(newHigh);
      onChange(internalLow, newHigh);
    }
  }

  const lowPct  = toPct(internalLow);
  const highPct = toPct(internalHigh);
  const handle  = {
    position:"absolute",top:"50%",
    width:26,height:26,borderRadius:"50%",
    background:B.amber,border:"3px solid white",
    boxShadow:"0 2px 8px rgba(232,160,32,0.45)",
    cursor:"grab",zIndex:3,touchAction:"none",
    transform:"translate(-50%,-50%)",
  };

  return(
    <div ref={containerRef} onClick={clickTrack}
      style={{position:"relative",height:44,userSelect:"none",touchAction:"none",cursor:"pointer"}}>
      {/* Track */}
      <div style={{position:"absolute",top:"50%",left:0,right:0,
        height:4,background:B.lightGrey,borderRadius:2,transform:"translateY(-50%)"}}>
        <div style={{position:"absolute",left:`${lowPct}%`,
          width:`${highPct-lowPct}%`,height:"100%",
          background:B.amber,borderRadius:2}}/>
      </div>
      {/* Low handle */}
      <div style={{...handle,left:`${lowPct}%`}}
        onMouseDown={e=>startDrag("low",e)}
        onTouchStart={e=>startDrag("low",e)}/>
      {/* High handle */}
      <div style={{...handle,left:`${highPct}%`}}
        onMouseDown={e=>startDrag("high",e)}
        onTouchStart={e=>startDrag("high",e)}/>
    </div>
  );
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const[step,setStep]=useState(0);
  const[data,setData]=useState({
    name:"",suburb:"",hasKitchen:null,servesAlcohol:null,
    seasonality:"flat",
    busyPeriods:[],bigDays:[],
    quietRevenue:1200,busyRevenue:4500,
    tradingHours:{...DEFAULT_HOURS},
    dayRevenue:JSON.parse(JSON.stringify(DEFAULT_DAY_REVENUE)),
  });

  const inputStyle={width:"100%",padding:"15px 16px",borderRadius:14,border:`1.5px solid ${B.midGrey}`,fontSize:16,fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box",transition:"border-color 0.15s"};
  function updateHours(day,key,val){setData(d=>({...d,tradingHours:{...d.tradingHours,[day]:{...d.tradingHours[day],[key]:val}}}));}
  function finish(){onComplete({
    ...data,
    baseRevenue:Math.round((data.quietRevenue+data.busyRevenue)/2),
  });}

  const steps=[
    // 0: Welcome
    <div key={0} style={{textAlign:"center",paddingTop:32}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:32}}>
        <Logo size={64}/>
      </div>
      <p style={{fontSize:17,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>{greeting()}</p>
      <h1 style={{fontSize:36,fontWeight:700,letterSpacing:"-0.02em",color:B.nearBlack,marginBottom:16,lineHeight:1.15,fontFamily:"system-ui,-apple-system,sans-serif"}}>It's time to<br/><span style={{color:B.amber}}>WageSave.</span></h1>
      <p style={{fontSize:16,color:B.warmGrey,lineHeight:1.65,marginBottom:48,fontFamily:"system-ui,-apple-system,sans-serif"}}>Stop paying for staff<br/>you don't need.</p>
      <AmberBtn label="Get started →" onClick={()=>setStep(1)}/>
      <p style={{fontSize:13,color:B.midGrey,marginTop:16,fontFamily:"system-ui,-apple-system,sans-serif"}}>Free for 1 month · No credit card needed</p>
    </div>,

    // 1: Venue details
    <div key={1}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>1 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>Tell us about<br/>your venue</h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:32,fontFamily:"system-ui,-apple-system,sans-serif"}}>This is what makes WageSave yours.</p>
      <div style={{marginBottom:18}}><Label text="Venue name"/><input style={inputStyle} placeholder="e.g. Barry's" value={data.name} onFocus={e=>e.target.style.borderColor=B.amber} onBlur={e=>e.target.style.borderColor=B.midGrey} onChange={e=>setData(d=>({...d,name:e.target.value}))}/></div>
      <div style={{marginBottom:28}}><Label text="Suburb or town"/><input style={inputStyle} placeholder="e.g. Barwon Heads" value={data.suburb} onFocus={e=>e.target.style.borderColor=B.amber} onBlur={e=>e.target.style.borderColor=B.midGrey} onChange={e=>setData(d=>({...d,suburb:e.target.value}))}/></div>
      <div style={{marginBottom:24}}><Label text="Do you have a kitchen?"/><Toggle value={data.hasKitchen} onChange={v=>setData(d=>({...d,hasKitchen:v}))}/></div>
      <div style={{marginBottom:36}}><Label text="Do you serve alcohol?"/><Toggle value={data.servesAlcohol} onChange={v=>setData(d=>({...d,servesAlcohol:v}))}/></div>
      <AmberBtn label="Next →" onClick={()=>setStep(2)} disabled={!data.name||!data.suburb||data.hasKitchen===null||data.servesAlcohol===null}/>
    </div>,

    // 2: Seasonality
    <div key={2}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>2 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>Is your venue<br/>seasonal?</h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:32,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>This affects how WageSave predicts revenue across the year.</p>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:36}}>
        {[
          {key:"summer", icon:"☀️", title:"Busier in summer", desc:"Coastal, beach, tourist venue — Dec/Jan are your biggest months"},
          {key:"winter",  icon:"🏔", title:"Busier in winter",  desc:"Ski town, alpine, or cold-weather destination"},
          {key:"flat",    icon:"📅", title:"Consistent year round", desc:"City venue or suburb with steady local trade"},
        ].map(opt=>{
          const active=data.seasonality===opt.key;
          return(
            <button key={opt.key} onClick={()=>setData(d=>({...d,seasonality:opt.key}))} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"16px",borderRadius:16,border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:B.white,cursor:"pointer",textAlign:"left",transition:"all 0.15s",boxShadow:active?`0 2px 12px rgba(232,160,32,0.2)`:"none"}}>
              <span style={{fontSize:24,marginTop:2}}>{opt.icon}</span>
              <div>
                <p style={{fontSize:15,fontWeight:600,color:active?B.amberDark:B.nearBlack,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{opt.title}</p>
                <p style={{fontSize:13,color:B.warmGrey,lineHeight:1.4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{opt.desc}</p>
              </div>
              {active&&<div style={{marginLeft:"auto",width:20,height:20,borderRadius:"50%",background:B.amber,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:B.white,fontSize:12}}>✓</span></div>}
            </button>
          );
        })}
      </div>
      <AmberBtn label="Next →" onClick={()=>setStep(3)}/>
    </div>,

    // 3: Trading hours
    <div key={3}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>3 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>Your trading hours</h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:24,fontFamily:"system-ui,-apple-system,sans-serif"}}>Set per day — closed days show no staff predictions.</p>
      {DAYS.map(day=>{
        const h=data.tradingHours[day];
        return(
          <div key={day} style={{marginBottom:12,background:B.white,borderRadius:16,padding:16,border:`1.5px solid ${h.open?B.lightGrey:B.midGrey}`,boxShadow:"0 1px 4px rgba(28,21,16,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:h.open?14:0}}>
              <p style={{fontSize:15,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
              <button onClick={()=>updateHours(day,"open",!h.open)} style={{padding:"6px 14px",borderRadius:100,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${h.open?B.amber:B.midGrey}`,background:h.open?B.amberLight:"transparent",color:h.open?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{h.open?"Open":"Closed"}</button>
            </div>
            {h.open&&(
              <>
                <div style={{display:"flex",gap:12,marginBottom:12}}><TimeSelect label="Opens" value={h.openTime} onChange={v=>updateHours(day,"openTime",v)}/><TimeSelect label="Closes" value={h.closeTime} onChange={v=>updateHours(day,"closeTime",v)}/></div>
                <button onClick={()=>updateHours(day,"hasDinner",!h.hasDinner)} style={{padding:"7px 14px",borderRadius:100,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${h.hasDinner?B.amber:B.midGrey}`,background:h.hasDinner?B.amberLight:"transparent",color:h.hasDinner?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>🌙 Dinner service</button>
                {h.hasDinner&&<div style={{display:"flex",gap:12,marginTop:10}}><TimeSelect label="Dinner opens" value={h.dinnerOpen} onChange={v=>updateHours(day,"dinnerOpen",v)}/><TimeSelect label="Dinner closes" value={h.dinnerClose} onChange={v=>updateHours(day,"dinnerClose",v)}/></div>}
              </>
            )}
          </div>
        );
      })}
      <div style={{marginTop:8}}><AmberBtn label="Next →" onClick={()=>setStep(4)}/></div>
    </div>,

    // 4: Busy periods
    <div key={4}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>4 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>When are you busiest?</h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:28,fontFamily:"system-ui,-apple-system,sans-serif"}}>Select all that apply.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28}}>
        {[["☀️ Morning","Morning"],["🍽 Lunch","Lunch"],["☕ Afternoon","Afternoon"],["🌙 Dinner","Dinner"],["🍺 Late night","Late night"],["📅 Weekends","Weekends"]].map(([label,val])=>{
          const active=data.busyPeriods.includes(val);
          return<button key={val} onClick={()=>setData(d=>({...d,busyPeriods:active?d.busyPeriods.filter(x=>x!==val):[...d.busyPeriods,val]}))} style={{padding:"14px 12px",borderRadius:14,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:B.white,color:active?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{label}</button>;
        })}
      </div>
      <div style={{marginBottom:36}}>
        <Label text="Your biggest days"/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          {DAYS.map(d=>{const active=(data.bigDays||[]).includes(d);return<button key={d} onClick={()=>setData(v=>({...v,bigDays:active?(v.bigDays||[]).filter(x=>x!==d):[...(v.bigDays||[]),d]}))} style={{padding:"9px 16px",borderRadius:100,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:B.white,color:active?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{d}</button>;})}
        </div>
      </div>
      <AmberBtn label="Next →" onClick={()=>setStep(5)}/>
    </div>,

    // 5: Per-day revenue sliders
    <div key={5}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>5 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>
        What does a typical<br/>{new Date().toLocaleString("en-AU",{month:"long"})} week look like?
      </h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:28,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>
        Slide each day to where it typically sits. WageSave adjusts for weather, events and school holidays on top.
      </p>

      {DAYS.map(day=>{
        const h=data.tradingHours[day];
        if(!h||!h.open) return null;
        const dr=data.dayRevenue[day];
        const mid=Math.round((dr.low+dr.high)/2);
        return(
          <div key={day} style={{marginBottom:20,background:B.white,borderRadius:14,padding:16,boxShadow:"0 1px 6px rgba(28,21,16,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <p style={{fontSize:15,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
              <p style={{fontSize:14,fontWeight:600,color:B.amber,fontFamily:"system-ui,-apple-system,sans-serif"}}>${dr.low.toLocaleString()} — ${dr.high.toLocaleString()}</p>
            </div>
            <RangeSlider
              min={dr.min} max={dr.max}
              low={dr.low} high={dr.high}
              onChange={(lo,hi)=>setData(d=>({...d,dayRevenue:{...d.dayRevenue,[day]:{...dr,low:lo,high:hi}}}))}
            />
            <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
              <span style={{fontSize:11,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Quiet ${dr.min.toLocaleString()}</span>
              <span style={{fontSize:11,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Busy ${dr.max.toLocaleString()}</span>
            </div>
            <p style={{fontSize:11,color:B.warmGrey,marginTop:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{calcRoles(mid,data.hasKitchen,data.servesAlcohol).note}</p>
          </div>
        );
      })}

      <div style={{background:B.amberPale,borderRadius:16,padding:18,border:`1.5px dashed ${B.midGrey}`,marginBottom:28,marginTop:8}}>
        <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>📊 Have last year's sales data?</p>
        <p style={{fontSize:13,color:B.warmGrey,marginBottom:12,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>Upload a CSV from Square, Lightspeed or Xero and WageSave learns your venue's patterns instantly.</p>
        <AmberBtn label="Upload CSV →" onClick={finish} outline small/>
      </div>
      <AmberBtn label={`Set up ${data.name} →`} onClick={finish}/>
    </div>,
  ];

  return(
    <div style={{minHeight:"100vh",background:B.amberPale}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}.fade-up{animation:fadeUp 0.38s cubic-bezier(.23,1,.32,1) forwards;}input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:${B.midGrey};outline:none;}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${B.amber};cursor:pointer;}select:focus{outline:none;}`}</style>
      {step>0&&<div style={{height:3,background:B.lightGrey}}><div style={{height:"100%",background:B.amber,borderRadius:"0 2px 2px 0",width:`${(step/5)*100}%`,transition:"width 0.4s ease"}}/></div>}
      <div style={{maxWidth:440,margin:"0 auto",padding:"40px 24px 80px"}}>
        {step===0&&<div style={{display:"flex",justifyContent:"center",marginBottom:0}}/>}
        {step>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40}}><LogoWordmark size={20}/>{step>1&&<button onClick={()=>setStep(s=>s-1)} style={{fontSize:13,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>← Back</button>}</div>}
        <div className="fade-up" key={step}>{steps[step]}</div>
      </div>
    </div>
  );
}

// ─── DAY DRAWER ──────────────────────────────────────────────────────────────
function DayDrawer({dayData,onActualChange,actual,feedback,onFeedback,onClose,venueName,localEvents=[]}){
  const{day,date,roles,adj,laborBudget,byHour,shifts,closed}=dayData;
  const holiday=getHoliday(date);
  const events=getEvents(date, localEvents);
  const flags=[...events];
  if(holiday) flags.unshift({icon:"🎉",label:holiday,impact:"+25%"});
  if(isSchoolHoliday(date)&&!holiday) flags.push({icon:"🏫",label:"School holidays",impact:"+15%"});
  if(isLongWeekend(date)&&!holiday) flags.push({icon:"📅",label:"Long weekend",impact:"+20%"});
  const peakForComparison = dayData.peakCover||roles.total;
  const diff=actual>0?actual-peakForComparison:0;
  const waste=diff>0?diff*8*29:0;
  const isPast=new Date(date)<new Date(new Date().setHours(0,0,0,0));

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(28,21,16,0.5)",zIndex:500,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:B.white,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"88vh",overflowY:"auto",animation:"drawerUp 0.32s cubic-bezier(.23,1,.32,1)"}}>
        <style>{`@keyframes drawerUp{from{transform:translateY(100%);opacity:0;}to{transform:translateY(0);opacity:1;}}`}</style>
        <div style={{padding:"14px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:36,height:4,background:B.lightGrey,borderRadius:2}}/></div>
        <div style={{padding:"12px 24px 48px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <p style={{fontSize:13,letterSpacing:"0.07em",color:B.warmGrey,textTransform:"uppercase",fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day} · {date.toLocaleDateString("en-AU",{day:"numeric",month:"long"})}</p>
            {holiday&&<span style={{fontSize:11,background:B.amberLight,color:B.amberDark,padding:"2px 10px",borderRadius:100,fontWeight:700,fontFamily:"system-ui,-apple-system,sans-serif"}}>{holiday}</span>}
          </div>

          {closed?(
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <p style={{fontSize:48}}>🔒</p>
              <p style={{fontSize:22,fontWeight:700,color:B.nearBlack,marginTop:12,fontFamily:"system-ui,-apple-system,sans-serif"}}>Closed today</p>
            </div>
          ):(
            <>
              {/* Peak cover — the hero number */}
              <div style={{marginBottom:20}}>
                <p style={{fontSize:56,fontWeight:700,color:B.amber,lineHeight:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  {dayData.peakCover||roles.total}
                  <span style={{fontSize:18,color:B.warmGrey,fontWeight:400,marginLeft:8}}>peak at once</span>
                </p>
                <p style={{fontSize:13,color:B.warmGrey,marginTop:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{roles.note}</p>
              </div>

              {/* Shift spread */}
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                <div style={{flex:1,background:B.amberPale,borderRadius:12,padding:"12px 14px"}}>
                  <Label text="Shifts across day"/>
                  <p style={{fontSize:22,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{dayData.totalShifts||roles.total}</p>
                  <p style={{fontSize:11,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>people on roster</p>
                </div>
                <div style={{flex:1,background:B.amberPale,borderRadius:12,padding:"12px 14px"}}>
                  <Label text="Total labour hrs"/>
                  <p style={{fontSize:22,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{dayData.totalLabourHours||0}h</p>
                  <p style={{fontSize:11,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>${Math.round((dayData.totalLabourHours||0)*29)} est. wages</p>
                </div>
              </div>

              <div style={{display:"flex",gap:12,marginBottom:20}}>
                <div style={{flex:1,background:B.amberPale,borderRadius:14,padding:14}}><Label text="Predicted revenue"/><p style={{fontSize:20,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>${Math.round(adj).toLocaleString()}</p></div>
                <div style={{flex:1,background:B.amberPale,borderRadius:14,padding:14}}><Label text="Labour budget"/><p style={{fontSize:20,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>${Math.round(laborBudget).toLocaleString()}</p></div>
              </div>

              {shifts.length>0&&(
                <div style={{marginBottom:20}}>
                  <Label text="Suggested shifts"/>
                  {shifts.map((s,i)=><ShiftRow key={i} shift={s}/>)}
                </div>
              )}

              <div style={{marginBottom:20}}>
                <Label text="Roles needed"/>
                {roles.roles.map((r,i)=><RoleBadge key={i} role={r.role} count={r.count}/>)}
              </div>

              {flags.length>0&&(
                <div style={{marginBottom:20}}>
                  <Label text="What's affecting today"/>
                  {flags.map((f,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:B.amberPale,borderRadius:12,padding:"10px 14px",marginBottom:8}}>
                      <span style={{fontSize:14,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{f.icon} {f.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:B.amberDark,fontFamily:"system-ui,-apple-system,sans-serif"}}>{f.impact}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{background:B.amberPale,borderRadius:14,padding:16,marginBottom:20}}>
                <Label text="Demand across the day"/>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:44,marginTop:10}}>
                  {byHour.map((s,i)=>{
                    if(s===0) return null;
                    const max=Math.max(...byHour,1);
                    return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:"100%",height:`${Math.max((s/max)*40,3)}px`,background:B.amber,borderRadius:3,opacity:0.85}}/><span style={{fontSize:7,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>{HOURS_LIST[i].label}</span></div>;
                  })}
                </div>
              </div>

              <div style={{background:B.amberPale,borderRadius:14,padding:16,marginBottom:20}}>
                <Label text={`Actual staff at ${venueName}`}/>
                <p style={{fontSize:12,color:B.warmGrey,marginBottom:14,fontFamily:"system-ui,-apple-system,sans-serif"}}>Helps WageSave learn your venue</p>
                <Stepper value={actual} onChange={onActualChange} min={0} max={30} step={1} suffix=" staff"/>
                {actual>0&&(
                  <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${B.lightGrey}`}}>
                    {diff>0?(<><p style={{fontSize:13,color:B.danger,fontWeight:600,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>⚠️ Overstaffed by {diff}</p><p style={{fontSize:30,fontWeight:700,color:B.danger,fontFamily:"system-ui,-apple-system,sans-serif"}}>−${waste.toLocaleString()}<span style={{fontSize:14,fontWeight:400,color:B.warmGrey,marginLeft:8}}>wage waste</span></p></>)
                    :diff<0?<p style={{fontSize:14,color:B.success,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>✓ Understaffed by {Math.abs(diff)}</p>
                    :<p style={{fontSize:14,color:B.success,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>✓ Staffing looks right</p>}
                  </div>
                )}
              </div>

              {/* Feedback — prominent, for past days and today */}
              {isPast&&(
                <div style={{background:B.amberPale,borderRadius:14,padding:16,border:`1.5px solid ${B.midGrey}`}}>
                  <FeedbackPanel feedback={feedback} onSave={onFeedback}/>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STAFF PROFILES ──────────────────────────────────────────────────────────
const ROLES = ["Kitchen","Coffee","Floor","Bar"];
const SHIFT_PREFS = [
  {key:"opener",   label:"Opener",   icon:"🌅", desc:"Prefers early starts (8am–2pm)"},
  {key:"mid",      label:"Mid",      icon:"☀️", desc:"Flexible, lunch through afternoon"},
  {key:"closer",   label:"Closer",   icon:"🌙", desc:"Prefers late shifts (midday onwards)"},
  {key:"flexible", label:"Flexible", icon:"🔄", desc:"No preference"},
];

const ABILITY_LEVELS = [
  {key:0, label:"—",       short:"—",  color:B.midGrey},
  {key:1, label:"Learning", short:"⭐",  color:"#E65100"},
  {key:2, label:"Competent",short:"⭐⭐", color:B.amberDark},
  {key:3, label:"Strong",   short:"⭐⭐⭐",color:B.success},
];

function newStaffMember(name=""){
  return {
    id: `staff-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    name,
    roles: { Kitchen:0, Coffee:0, Floor:0, Bar:0 },
    preferredHours: 20,
    shiftPreference: "flexible",
    preferredDays: [],
    unavailableDays: [],
    unavailableDates: [],
  };
}

function StaffAbilityPicker({role, value, onChange}){
  return(
    <div style={{display:"flex",gap:6}}>
      {ABILITY_LEVELS.map(level=>(
        <button key={level.key} onClick={()=>onChange(level.key)} style={{
          flex:1,padding:"8px 4px",borderRadius:10,fontSize:12,fontWeight:600,
          cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
          border:`1.5px solid ${value===level.key?level.color:B.lightGrey}`,
          background:value===level.key?`${level.color}18`:B.white,
          color:value===level.key?level.color:B.warmGrey,
          transition:"all 0.15s",
        }}>{level.key===0?"—":level.short}</button>
      ))}
    </div>
  );
}

function StaffCard({member, onEdit, onDelete}){
  const activeRoles = ROLES.filter(r=>member.roles[r]>0);
  return(
    <div style={{background:B.white,borderRadius:14,padding:16,marginBottom:10,
      border:`1.5px solid ${B.lightGrey}`,
      boxShadow:"0 1px 4px rgba(28,21,16,0.05)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p style={{fontSize:15,fontWeight:700,color:B.nearBlack,marginBottom:4,
            fontFamily:"system-ui,-apple-system,sans-serif"}}>{member.name}</p>
          <p style={{fontSize:12,color:B.warmGrey,marginBottom:4,
            fontFamily:"system-ui,-apple-system,sans-serif"}}>
            {activeRoles.map(r=>{
              const a=ABILITY_LEVELS.find(l=>l.key===member.roles[r]);
              return `${r} ${a?.short||""}`;
            }).join(" · ")||"No roles set"}
          </p>
          <p style={{fontSize:12,color:B.warmGrey,
            fontFamily:"system-ui,-apple-system,sans-serif"}}>
            {member.preferredHours}h/week
            {" · "}{SHIFT_PREFS.find(s=>s.key===(member.shiftPreference||"flexible"))?.icon}
            {" "}{SHIFT_PREFS.find(s=>s.key===(member.shiftPreference||"flexible"))?.label}
            {(member.preferredDays||[]).length>0?` · ${member.preferredDays.join(", ")}` :""}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onEdit} style={{fontSize:13,color:B.amber,background:"none",
            border:`1px solid ${B.amber}`,borderRadius:8,padding:"4px 10px",
            cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",fontWeight:600}}>
            Edit
          </button>
          <button onClick={onDelete} style={{fontSize:13,color:B.danger,background:"none",
            border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffEditor({member, onSave, onCancel}){
  const[local,setLocal]=useState({...member,roles:{...member.roles}});

  const inputStyle={width:"100%",padding:"11px 14px",borderRadius:10,
    border:`1.5px solid ${B.midGrey}`,fontSize:15,
    fontFamily:"system-ui,-apple-system,sans-serif",
    color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box"};

  return(
    <div style={{background:B.white,borderRadius:16,padding:20,marginBottom:12,
      border:`1.5px solid ${B.amber}`,
      boxShadow:`0 2px 12px rgba(232,160,32,0.15)`}}>

      {/* Name */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Name</p>
        <input style={inputStyle} placeholder="e.g. Jill"
          value={local.name} onChange={e=>setLocal(l=>({...l,name:e.target.value}))}
          onFocus={e=>e.target.style.borderColor=B.amber}
          onBlur={e=>e.target.style.borderColor=B.midGrey}/>
      </div>

      {/* Role abilities */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:10,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Role ability</p>
        {ROLES.map(role=>(
          <div key={role} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,width:64,flexShrink:0,
              fontFamily:"system-ui,-apple-system,sans-serif"}}>{role}</p>
            <div style={{flex:1}}>
              <StaffAbilityPicker role={role} value={local.roles[role]||0}
                onChange={v=>setLocal(l=>({...l,roles:{...l.roles,[role]:v}}))}/>
            </div>
          </div>
        ))}
      </div>

      {/* Hours */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>
          How many hours a week are you looking for?
        </p>
        <input type="number" min={0} max={40} style={inputStyle}
          value={local.preferredHours}
          onChange={e=>setLocal(l=>({...l,preferredHours:Number(e.target.value)}))}
          onFocus={e=>e.target.style.borderColor=B.amber}
          onBlur={e=>e.target.style.borderColor=B.midGrey}/>
        <p style={{fontSize:12,color:B.warmGrey,marginTop:6,
          fontFamily:"system-ui,-apple-system,sans-serif"}}>
          WageSave will try to get as close to this as possible each week.
        </p>
      </div>

      {/* Shift preference */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Shift preference</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {SHIFT_PREFS.map(pref=>{
            const active=(local.shiftPreference||"flexible")===pref.key;
            return(
              <button key={pref.key} onClick={()=>setLocal(l=>({...l,shiftPreference:pref.key}))}
                style={{
                  display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
                  borderRadius:12,border:`1.5px solid ${active?B.amber:B.midGrey}`,
                  background:active?B.amberLight:B.white,cursor:"pointer",
                  textAlign:"left",transition:"all 0.15s",
                  boxShadow:active?`0 2px 8px rgba(232,160,32,0.2)`:"none",
                }}>
                <span style={{fontSize:18}}>{pref.icon}</span>
                <div>
                  <p style={{fontSize:14,fontWeight:600,
                    color:active?B.amberDark:B.nearBlack,
                    fontFamily:"system-ui,-apple-system,sans-serif"}}>{pref.label}</p>
                  <p style={{fontSize:12,color:B.warmGrey,
                    fontFamily:"system-ui,-apple-system,sans-serif"}}>{pref.desc}</p>
                </div>
                {active&&<span style={{marginLeft:"auto",color:B.amber,fontSize:16}}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred days */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Preferred days</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>{
            const active=(local.preferredDays||[]).includes(d);
            return(
              <button key={d} onClick={()=>setLocal(l=>({...l,
                preferredDays:active
                  ?(l.preferredDays||[]).filter(x=>x!==d)
                  :[...(l.preferredDays||[]),d]
              }))} style={{
                padding:"7px 12px",borderRadius:100,fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
                border:`1.5px solid ${active?B.amber:B.midGrey}`,
                background:active?B.amberLight:B.white,
                color:active?B.amberDark:B.warmGrey,
                transition:"all 0.15s",
              }}>{d}</button>
            );
          })}
        </div>
      </div>

      {/* Unavailable — days of week */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Can't work — regular days</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>{
            const active=(local.unavailableDays||[]).includes(d);
            return(
              <button key={d} onClick={()=>setLocal(l=>({...l,
                unavailableDays:active
                  ?(l.unavailableDays||[]).filter(x=>x!==d)
                  :[...(l.unavailableDays||[]),d]
              }))} style={{
                padding:"7px 12px",borderRadius:100,fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
                border:`1.5px solid ${active?"#C0392B":B.midGrey}`,
                background:active?"#FDECEA":B.white,
                color:active?"#C0392B":B.warmGrey,
                transition:"all 0.15s",
              }}>{d}</button>
            );
          })}
        </div>
      </div>

      {/* Unavailable — specific dates */}
      <div style={{marginBottom:20}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",
          textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Can't work — specific dates</p>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input type="date" id={`unavail-date-${local.id}`}
            style={{flex:1,padding:"10px 12px",borderRadius:10,
              border:`1.5px solid ${B.midGrey}`,fontSize:14,
              fontFamily:"system-ui,-apple-system,sans-serif",
              color:B.nearBlack,background:B.white,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=B.amber}
            onBlur={e=>e.target.style.borderColor=B.midGrey}/>
          <button onClick={()=>{
            const inp=document.getElementById(`unavail-date-${local.id}`);
            if(!inp?.value) return;
            const dates=local.unavailableDates||[];
            if(!dates.includes(inp.value)){
              setLocal(l=>({...l,unavailableDates:[...(l.unavailableDates||[]),inp.value]}));
            }
            inp.value="";
          }} style={{
            padding:"10px 16px",borderRadius:10,background:B.amber,
            border:"none",color:B.white,fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
          }}>Add</button>
        </div>
        {(local.unavailableDates||[]).length>0&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(local.unavailableDates||[]).map(d=>(
              <div key={d} style={{
                display:"inline-flex",alignItems:"center",gap:6,
                background:"#FDECEA",borderRadius:8,padding:"6px 12px",
                marginBottom:6,marginRight:6,
              }}>
                <span style={{
                  fontSize:12,color:"#C0392B",
                  fontFamily:"system-ui,-apple-system,sans-serif",
                  fontWeight:600,whiteSpace:"nowrap",
                }}>{d}</span>
                <button onClick={()=>setLocal(l=>({...l,
                  unavailableDates:(l.unavailableDates||[]).filter(x=>x!==d)
                }))} style={{
                  fontSize:14,color:"#C0392B",background:"none",
                  border:"none",cursor:"pointer",lineHeight:1,
                  flexShrink:0,padding:0,
                }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>local.name?onSave(local):null} style={{
          flex:2,padding:"13px 0",borderRadius:12,
          background:local.name?B.amber:"#D4C9BB",
          color:B.white,border:"none",fontSize:15,fontWeight:700,
          cursor:local.name?"pointer":"not-allowed",
          fontFamily:"system-ui,-apple-system,sans-serif",
          boxShadow:local.name?`0 4px 16px rgba(232,160,32,0.3)`:"none",
        }}>Save</button>
        <button onClick={onCancel} style={{
          flex:1,padding:"13px 0",borderRadius:12,
          background:"transparent",border:`1.5px solid ${B.midGrey}`,
          color:B.warmGrey,fontSize:14,fontWeight:600,cursor:"pointer",
          fontFamily:"system-ui,-apple-system,sans-serif",
        }}>Cancel</button>
      </div>
    </div>
  );
}

function StaffManager({staff, onStaffChange}){
  const[editing,setEditing]=useState(null); // id or "new"
  const[newMember,setNewMember]=useState(null);

  function addNew(){
    const m=newStaffMember();
    setNewMember(m);
    setEditing("new");
  }

  function saveNew(member){
    onStaffChange([...staff,member]);
    setEditing(null);
    setNewMember(null);
  }

  function saveEdit(updated){
    onStaffChange(staff.map(s=>s.id===updated.id?updated:s));
    setEditing(null);
  }

  function deleteMember(id){
    if(window.confirm("Remove this staff member?"))
      onStaffChange(staff.filter(s=>s.id!==id));
  }

  return(
    <div>
      {staff.map(member=>(
        editing===member.id?(
          <StaffEditor key={member.id} member={member}
            onSave={saveEdit}
            onCancel={()=>setEditing(null)}/>
        ):(
          <StaffCard key={member.id} member={member}
            onEdit={()=>setEditing(member.id)}
            onDelete={()=>deleteMember(member.id)}/>
        )
      ))}

      {editing==="new"&&newMember?(
        <StaffEditor member={newMember}
          onSave={saveNew}
          onCancel={()=>{setEditing(null);setNewMember(null);}}/>
      ):(
        <button onClick={addNew} style={{
          width:"100%",padding:"12px 0",borderRadius:12,
          border:`1.5px dashed ${B.amber}`,background:"transparent",
          color:B.amberDark,fontSize:14,fontWeight:600,
          cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
        }}>+ Add staff member</button>
      )}
    </div>
  );
}

// ─── LOCAL EVENTS LIST ───────────────────────────────────────────────────────
function LocalEventsList({events, onChange}){
  const[editing,setEditing]=useState(null);

  function saveEdit(updated){
    onChange(events.map(e=>e.id===updated.id?updated:e));
    setEditing(null);
  }

  function deleteEvent(id){
    onChange(events.filter(e=>e.id!==id));
  }

  return(
    <div>
      {events.map(ev=>(
        editing===ev.id?(
          <EventForm key={ev.id}
            initial={{...ev,date:ev.dates?.[0]||""}}
            onSave={updated=>{saveEdit(updated);}}
            onCancel={()=>setEditing(null)}/>
        ):(
          <div key={ev.id} style={{background:B.amberPale,borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${B.lightGrey}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{ev.icon}</span>
                <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{ev.name}</p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setEditing(ev.id)} style={{fontSize:13,color:B.amber,
                  background:"none",border:`1px solid ${B.amber}`,borderRadius:8,
                  padding:"3px 10px",cursor:"pointer",
                  fontFamily:"system-ui,-apple-system,sans-serif",fontWeight:600}}>Edit</button>
                <button onClick={()=>deleteEvent(ev.id)} style={{fontSize:16,color:B.warmGrey,
                  background:"none",border:"none",cursor:"pointer",padding:"0 4px"}}>×</button>
              </div>
            </div>
            <p style={{fontSize:12,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>
              {ev.dates?.join(", ")} · {ev.impact} · {ev.recurrence}
            </p>
          </div>
        )
      ))}
      <AddEventForm onAdd={ev=>onChange([...events,ev])}/>
    </div>
  );
}

// ─── ADD EVENT FORM ──────────────────────────────────────────────────────────
function EventForm({initial=null, onSave, onCancel}){
  const[form,setForm]=useState(initial||{
    name:"",icon:"🎸",date:"",impact:"+20%",recurrence:"one-off",
  });

  function submit(){
    if(!form.name||!form.date) return;
    onSave({
      id:initial?.id||`custom-${Date.now()}`,
      name:form.name,
      icon:form.icon,
      dates:[form.date],
      impact:form.impact,
      mult:impactToMult(form.impact),
      recurrence:form.recurrence,
    });
  }

  const inputStyle={width:"100%",padding:"11px 14px",borderRadius:10,
    border:`1.5px solid ${B.midGrey}`,fontSize:14,
    fontFamily:"system-ui,-apple-system,sans-serif",
    color:B.nearBlack,background:B.white,outline:"none",
    boxSizing:"border-box"};

  return(
    <div style={{background:B.white,borderRadius:14,padding:16,border:`1.5px solid ${B.amber}`,marginBottom:10}}>
      <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,marginBottom:14,
        fontFamily:"system-ui,-apple-system,sans-serif"}}>{initial?"Edit event":"New local event"}</p>

      {/* Icon picker */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Icon</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {EVENT_ICONS.map(ic=>(
            <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))} style={{
              width:36,height:36,borderRadius:8,fontSize:18,
              border:`1.5px solid ${form.icon===ic?B.amber:B.lightGrey}`,
              background:form.icon===ic?B.amberLight:"transparent",
              cursor:"pointer",
            }}>{ic}</button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Event name</p>
        <input style={inputStyle} placeholder="e.g. JET — Barwon Heads Hotel"
          value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
          onFocus={e=>e.target.style.borderColor=B.amber}
          onBlur={e=>e.target.style.borderColor=B.midGrey}/>
      </div>

      {/* Date */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Date</p>
        <input type="date" style={inputStyle} value={form.date}
          onChange={e=>setForm(f=>({...f,date:e.target.value}))}
          onFocus={e=>e.target.style.borderColor=B.amber}
          onBlur={e=>e.target.style.borderColor=B.midGrey}/>
      </div>

      {/* Impact */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>
          Expected impact on trade
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["+10%","+20%","+30%","+40%","-10%","-20%"].map(imp=>(
            <button key={imp} onClick={()=>setForm(f=>({...f,impact:imp}))} style={{
              padding:"8px 14px",borderRadius:100,fontSize:13,fontWeight:600,
              cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
              border:`1.5px solid ${form.impact===imp?B.amber:B.midGrey}`,
              background:form.impact===imp?B.amberLight:"transparent",
              color:form.impact===imp?B.amberDark:B.warmGrey,
              transition:"all 0.15s",
            }}>{imp}</button>
          ))}
        </div>
      </div>

      {/* Recurrence */}
      <div style={{marginBottom:16}}>
        <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>How often?</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {RECURRENCE_OPTIONS.map(r=>(
            <button key={r.key} onClick={()=>setForm(f=>({...f,recurrence:r.key}))} style={{
              padding:"8px 14px",borderRadius:100,fontSize:13,fontWeight:600,
              cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
              border:`1.5px solid ${form.recurrence===r.key?B.amber:B.midGrey}`,
              background:form.recurrence===r.key?B.amberLight:"transparent",
              color:form.recurrence===r.key?B.amberDark:B.warmGrey,
              transition:"all 0.15s",
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:10}}>
        <button onClick={submit} disabled={!form.name||!form.date} style={{
          flex:2,padding:"12px 0",borderRadius:12,
          background:form.name&&form.date?B.amber:"#D4C9BB",
          color:B.white,border:"none",fontSize:14,fontWeight:700,
          cursor:form.name&&form.date?"pointer":"not-allowed",
          fontFamily:"system-ui,-apple-system,sans-serif",
        }}>{initial?"Save changes":"Add event"}</button>
        <button onClick={onCancel} style={{
          flex:1,padding:"12px 0",borderRadius:12,
          background:"transparent",border:`1.5px solid ${B.midGrey}`,
          color:B.warmGrey,fontSize:14,fontWeight:600,cursor:"pointer",
          fontFamily:"system-ui,-apple-system,sans-serif",
        }}>Cancel</button>
      </div>
    </div>
  );
}

function AddEventForm({onAdd}){
  const[open,setOpen]=useState(false);
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{
      width:"100%",padding:"12px 0",borderRadius:12,
      border:`1.5px dashed ${B.amber}`,background:"transparent",
      color:B.amberDark,fontSize:14,fontWeight:600,
      cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
    }}>+ Add local event</button>
  );
  return <EventForm onSave={ev=>{onAdd(ev);setOpen(false);}} onCancel={()=>setOpen(false)}/>;
}

// ─── VENUE SETTINGS ──────────────────────────────────────────────────────────
function VenueSettings({venue, baseRevenue, dayRevenue, localEvents, staff, onStaffChange, onLocalEventsChange, onDayRevenueChange, onBaseRevenueChange, onVenueUpdate, onReset}){
  const[local,setLocal]=useState({...venue});
  const[saved,setSaved]=useState(false);

  function updateHours(day,key,val){
    setLocal(d=>({...d,tradingHours:{...d.tradingHours,[day]:{...d.tradingHours[day],[key]:val}}}));
    setSaved(false);
  }

  function save(){
    onVenueUpdate(local);
    setSaved(true);
  }

  const sectionStyle={background:B.white,borderRadius:16,padding:20,marginBottom:12,boxShadow:"0 2px 16px rgba(28,21,16,0.07)"};
  const rowStyle={display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${B.lightGrey}`};

  return(
    <div style={{marginBottom:20}}>

      {/* Venue name & suburb */}
      <div style={sectionStyle}>
        <Label text="Venue"/>
        <div style={{marginBottom:14}}>
          <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Name</p>
          <input value={local.name} onChange={e=>{setLocal(d=>({...d,name:e.target.value}));setSaved(false);}}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${B.midGrey}`,fontSize:15,fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor=B.amber} onBlur={e=>e.target.style.borderColor=B.midGrey}/>
        </div>
        <div>
          <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Suburb</p>
          <input value={local.suburb} onChange={e=>{setLocal(d=>({...d,suburb:e.target.value}));setSaved(false);}}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${B.midGrey}`,fontSize:15,fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor=B.amber} onBlur={e=>e.target.style.borderColor=B.midGrey}/>
        </div>
      </div>

      {/* Kitchen & alcohol */}
      <div style={sectionStyle}>
        <Label text="Venue type"/>
        <div style={{...rowStyle,borderBottom:"none",paddingBottom:0,marginBottom:12}}>
          <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>Kitchen</p>
          <div style={{display:"flex",gap:8}}>
            {["Yes","No"].map(opt=>{
              const active=(local.hasKitchen&&opt==="Yes")||(!local.hasKitchen&&opt==="No");
              return<button key={opt} onClick={()=>{setLocal(d=>({...d,hasKitchen:opt==="Yes"}));setSaved(false);}} style={{padding:"7px 18px",borderRadius:100,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:"transparent",color:active?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{opt}</button>;
            })}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>Alcohol</p>
          <div style={{display:"flex",gap:8}}>
            {["Yes","No"].map(opt=>{
              const active=(local.servesAlcohol&&opt==="Yes")||(!local.servesAlcohol&&opt==="No");
              return<button key={opt} onClick={()=>{setLocal(d=>({...d,servesAlcohol:opt==="Yes"}));setSaved(false);}} style={{padding:"7px 18px",borderRadius:100,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:"transparent",color:active?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{opt}</button>;
            })}
          </div>
        </div>
      </div>

      {/* Seasonality */}
      <div style={sectionStyle}>
        <Label text="Seasonality"/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {key:"summer",icon:"☀️",label:"Busier in summer"},
            {key:"winter", icon:"🏔",label:"Busier in winter"},
            {key:"flat",   icon:"📅",label:"Consistent year round"},
          ].map(opt=>{
            const active=local.seasonality===opt.key;
            return<button key={opt.key} onClick={()=>{setLocal(d=>({...d,seasonality:opt.key}));setSaved(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`1.5px solid ${active?B.amber:B.midGrey}`,background:active?B.amberLight:B.white,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <span style={{fontSize:18}}>{opt.icon}</span>
              <span style={{fontSize:14,fontWeight:600,color:active?B.amberDark:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{opt.label}</span>
              {active&&<span style={{marginLeft:"auto",color:B.amber,fontSize:16}}>✓</span>}
            </button>;
          })}
        </div>
      </div>

      {/* Per-day revenue sliders */}
      <div style={sectionStyle}>
        <Label text={`Typical revenue per day — ${new Date().toLocaleString("en-AU",{month:"long"})}`}/>
        <p style={{fontSize:12,color:B.warmGrey,marginBottom:16,fontFamily:"system-ui,-apple-system,sans-serif",lineHeight:1.5}}>
          Slide each day to where it typically sits. WageSave adjusts for weather, events and school holidays on top.
        </p>
        {DAYS.map(day=>{
          const h=local.tradingHours[day];
          if(!h||!h.open) return null;
          const dr=dayRevenue[day]||DEFAULT_DAY_REVENUE[day];
          const mid=Math.round((dr.low+dr.high)/2);
          return(
            <div key={day} style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <p style={{fontSize:14,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
                <p style={{fontSize:13,fontWeight:600,color:B.amber,fontFamily:"system-ui,-apple-system,sans-serif"}}>${dr.low.toLocaleString()} — ${dr.high.toLocaleString()}</p>
              </div>
              <RangeSlider
                min={dr.min} max={dr.max}
                low={dr.low} high={dr.high}
                onChange={(lo,hi)=>{
                  onDayRevenueChange(prev=>({...prev,[day]:{...dr,low:lo,high:hi}}));
                  setSaved(false);
                }}
              />
              <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                <span style={{fontSize:11,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Min ${dr.min.toLocaleString()}</span>
                <span style={{fontSize:11,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Max ${dr.max.toLocaleString()}</span>
              </div>
              <p style={{fontSize:11,color:B.warmGrey,marginTop:3,fontFamily:"system-ui,-apple-system,sans-serif"}}>{calcRoles(mid,local.hasKitchen,local.servesAlcohol).note}</p>
            </div>
          );
        })}
      </div>

      {/* Trading hours */}
      <div style={sectionStyle}>
        <Label text="Trading hours"/>
        {DAYS.map(day=>{
          const h=local.tradingHours[day];
          return(
            <div key={day} style={{marginBottom:12,background:B.amberPale,borderRadius:12,padding:14,border:`1px solid ${h.open?B.lightGrey:B.midGrey}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:h.open?12:0}}>
                <p style={{fontSize:14,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
                <button onClick={()=>updateHours(day,"open",!h.open)} style={{padding:"5px 12px",borderRadius:100,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${h.open?B.amber:B.midGrey}`,background:h.open?B.amberLight:"transparent",color:h.open?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>{h.open?"Open":"Closed"}</button>
              </div>
              {h.open&&(
                <>
                  <div style={{display:"flex",gap:10,marginBottom:10}}>
                    <TimeSelect label="Opens" value={h.openTime} onChange={v=>updateHours(day,"openTime",v)}/>
                    <TimeSelect label="Closes" value={h.closeTime} onChange={v=>updateHours(day,"closeTime",v)}/>
                  </div>
                  <button onClick={()=>updateHours(day,"hasDinner",!h.hasDinner)} style={{padding:"6px 12px",borderRadius:100,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",border:`1.5px solid ${h.hasDinner?B.amber:B.midGrey}`,background:h.hasDinner?B.amberLight:"transparent",color:h.hasDinner?B.amberDark:B.warmGrey,transition:"all 0.15s"}}>🌙 Dinner service</button>
                  {h.hasDinner&&<div style={{display:"flex",gap:10,marginTop:10}}><TimeSelect label="Dinner opens" value={h.dinnerOpen} onChange={v=>updateHours(day,"dinnerOpen",v)}/><TimeSelect label="Dinner closes" value={h.dinnerClose} onChange={v=>updateHours(day,"dinnerClose",v)}/></div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div style={{marginBottom:12}}>
        {saved?(
          <div style={{background:B.successLight,borderRadius:14,padding:"14px 0",textAlign:"center"}}>
            <p style={{fontSize:15,fontWeight:600,color:B.success,fontFamily:"system-ui,-apple-system,sans-serif"}}>✓ Settings saved</p>
          </div>
        ):(
          <button onClick={save} style={{width:"100%",padding:"16px 0",background:B.amber,color:B.white,border:"none",borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",boxShadow:`0 4px 16px rgba(232,160,32,0.3)`}}>Save changes</button>
        )}
      </div>

      {/* Staff */}
      <div style={sectionStyle}>
        <Label text="Your team"/>
        <p style={{fontSize:12,color:B.warmGrey,marginBottom:16,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Add your staff — their roles, ability and hours. WageSave uses this to suggest who works each shift.
        </p>
        <StaffManager staff={staff||[]} onStaffChange={v=>{onStaffChange(v);setSaved(false);}}/>
      </div>

      {/* Local Events */}
      <div style={sectionStyle}>
        <Label text="Local events"/>
        <p style={{fontSize:12,color:B.warmGrey,marginBottom:16,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Add nearby events that affect your trade — gigs at the local pub, markets, sporting events.
        </p>

        <LocalEventsList
          events={localEvents}
          onChange={v=>{onLocalEventsChange(v);setSaved(false);}}
        />
      </div>

      {/* Reset */}
      <button onClick={()=>{if(window.confirm("Reset WageSave and start over? All venue data will be cleared.")) onReset();}} style={{width:"100%",padding:"11px 0",borderRadius:12,border:`1.5px solid ${B.danger}`,background:"transparent",color:B.danger,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>Reset venue &amp; start over</button>
    </div>
  );
}

// ─── ROSTER GENERATOR ────────────────────────────────────────────────────────

function isStaffAvailable(member, day, date) {
  if ((member.unavailableDays||[]).includes(day)) return false;
  const dk = dateKey(date);
  if ((member.unavailableDates||[]).includes(dk)) return false;
  return true;
}

function shiftMatchesPref(shift, pref) {
  if (pref === "flexible") return true;
  if (pref === "opener")  return shift.start <= 10;
  if (pref === "closer")  return shift.start >= 12;
  if (pref === "mid")     return shift.start >= 9 && shift.start <= 14;
  return true;
}

function generateRoster(weekData, staff, tradingHours) {
  // Rotation seed based on week — changes each week so different staff get priority
  const weekSeed = weekData[0] ? dateKey(weekData[0].date) : "0";
  const seedNum = weekSeed.split("-").reduce((a,b)=>a+parseInt(b),0);

  // Shuffle staff order slightly based on week seed for rotation
  const shuffledStaff = [...staff].sort((a,b)=>{
    const aHash = (a.name.charCodeAt(0)||0) + seedNum;
    const bHash = (b.name.charCodeAt(0)||0) + seedNum;
    return (aHash % 7) - (bHash % 7);
  });

  // Track hours allocated per staff member this week
  const hoursAllocated = {};
  staff.forEach(s => hoursAllocated[s.id] = 0);

  const roster = {}; // { day: [ { shift, staffId, staffName, role, start, end } ] }

  DAYS.forEach(day => {
    const dayData = weekData.find(d => d.day === day);
    if (!dayData || dayData.closed || !dayData.shifts?.length) {
      roster[day] = [];
      return;
    }

    const date = dayData.date;
    const dayRoster = [];

    dayData.shifts.forEach(shift => {
      const shiftHours = shift.end - shift.start;
      const role = shift.role;

      // Find best available staff for this shift
      // For "Coffee & Floor" and "All-rounder" shifts, accept staff with ability in either component role
      function getEffectiveAbility(member, r) {
        if (r === "Coffee & Floor") return Math.min(member.roles?.Coffee||0, member.roles?.Floor||0) > 0
          ? Math.round(((member.roles?.Coffee||0) + (member.roles?.Floor||0)) / 2)
          : 0;
        if (r === "All-rounder") return Math.max(
          member.roles?.Coffee||0, member.roles?.Floor||0,
          member.roles?.Kitchen||0, member.roles?.Bar||0
        );
        return member.roles?.[r] || 0;
      }

      const candidates = shuffledStaff.filter(member => {
        if (!isStaffAvailable(member, day, date)) return false;
        const abilityLevel = getEffectiveAbility(member, role);
        if (abilityLevel === 0) return false;
        // Hard exclude staff already assigned to a shift today
        // EXCEPTION: Kitchen split shifts are ok (day + dinner = two kitchen shifts)
        const alreadyToday = dayRoster.filter(r => r.staffId === member.id);
        if (alreadyToday.length > 0) {
          const isKitchenSplit = role === "Kitchen" && alreadyToday.every(r => r.role === "Kitchen");
          if (!isKitchenSplit) return false;
          // Only allow one kitchen split per person
          if (alreadyToday.length >= 2) return false;
        }
        return true;
      });

      if (candidates.length === 0) {
        // No one available — flag it
        dayRoster.push({
          ...shift,
          staffId: null,
          staffName: "⚠️ Unassigned",
          abilityLevel: 0,
          warning: `No ${role} staff available`,
        });
        return;
      }

      // Score candidates
      // Add small weekly rotation bonus to break ties differently each week
      const scored = candidates.map(member => {
        const abilityLevel = getEffectiveAbility(member, role);
        const prefMatch = shiftMatchesPref(shift, member.shiftPreference || "flexible") ? 10 : 0;
        const hasPreferredDays = (member.preferredDays||[]).length > 0;
        const dayPref = hasPreferredDays
          ? (member.preferredDays.includes(day) ? 8 : -6)
          : 0;
        const weeklyTarget = (member.preferredHours||0) / 5; // daily target
        const hoursNeeded = Math.max(0, weeklyTarget - hoursAllocated[member.id]);
        const hoursScore = hoursNeeded > 2 ? 8 : hoursNeeded > 0 ? 4 : -5; // penalise overscheduled staff
        // Prefer Strong (3) on big days, allow Learning (1) on quiet days
        const abilityScore = abilityLevel * 3;
        // Small rotation bonus so different staff get priority each week
        const rotationBonus = ((member.name.charCodeAt(0)||0) + seedNum) % 3;
        return { member, score: abilityScore + prefMatch + dayPref + hoursScore + rotationBonus, abilityLevel };
      }).sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (best && best.score > -999) {
        hoursAllocated[best.member.id] = (hoursAllocated[best.member.id] || 0) + shiftHours;
        dayRoster.push({
          ...shift,
          staffId: best.member.id,
          staffName: best.member.name,
          abilityLevel: getEffectiveAbility(best.member, role),
        });
      } else {
        dayRoster.push({
          ...shift,
          staffId: null,
          staffName: "⚠️ Unassigned",
          abilityLevel: 0,
          warning: `No ${role} staff available`,
        });
      }
    });

    // Check experience coverage — warn if no Strong staff on busy days
    const strongCount = dayRoster.filter(r => r.abilityLevel >= 3).length;
    const isbusy = (dayData.adj || 0) > 2500;
    if (isbusy && strongCount === 0 && dayRoster.length > 0) {
      dayRoster._warning = "No ⭐⭐⭐ staff rostered on a busy day";
    }

    roster[day] = dayRoster;
  });

  // Summary — hours per staff member
  const hoursSummary = staff.map(s => ({
    id: s.id,
    name: s.name,
    allocated: Math.round(hoursAllocated[s.id] * 10) / 10,
    preferred: s.preferredHours || 0,
    diff: Math.round((hoursAllocated[s.id] - (s.preferredHours||0)/5 * 5) * 10) / 10,
  }));

  return { roster, hoursSummary, hoursAllocated };
}

// ─── ROSTER VIEW ─────────────────────────────────────────────────────────────
function RosterView({weekData, staff, onClose, venueName, weekLabel, weekOffset, onWeekChange}){
  const { roster, hoursSummary } = generateRoster(weekData, staff);
  const [editingShift, setEditingShift] = useState(null); // {day, index, mode: "swap"|"time"}
  const [localRoster, setLocalRoster] = useState(roster);

  // Regenerate roster when week changes
  const prevOffset = useRef(weekOffset);
  useEffect(()=>{
    if(prevOffset.current !== weekOffset){
      const {roster:newRoster} = generateRoster(weekData, staff);
      setLocalRoster(newRoster);
      setEditingShift(null);
      prevOffset.current = weekOffset;
    }
  },[weekData, weekOffset]);

  function reassign(day, shiftIndex, newStaffId) {
    const member = staff.find(s => s.id === newStaffId);
    setLocalRoster(prev => ({
      ...prev,
      [day]: prev[day].map((s, i) => i === shiftIndex
        ? { ...s, staffId: newStaffId, staffName: member?.name || "Unassigned" }
        : s
      )
    }));
    setEditingShift(null);
  }

  function updateShiftTime(day, shiftIndex, field, value) {
    setLocalRoster(prev => ({
      ...prev,
      [day]: prev[day].map((s, i) => i === shiftIndex
        ? { ...s, [field]: Number(value) }
        : s
      )
    }));
  }

  function deleteShift(day, shiftIndex) {
    setLocalRoster(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== shiftIndex)
    }));
    setEditingShift(null);
  }

  function addShift(day) {
    const dayData = weekData.find(d => d.day === day);
    const h = dayData?.date ? null : null;
    const newShift = {
      role: "Floor", label: "Floor",
      start: 8, end: 15,
      staffId: null, staffName: "⚠️ Unassigned",
      abilityLevel: 0,
    };
    setLocalRoster(prev => ({
      ...prev,
      [day]: [...(prev[day]||[]), newShift]
    }));
    // Open edit for the new shift
    setEditingShift({day, index:(localRoster[day]||[]).length, mode:"time"});
  }

  function copyToClipboard() {
    const lines = [`${venueName} — Roster ${weekLabel}`, ""];
    DAYS.forEach(day => {
      const shifts = localRoster[day];
      if (!shifts?.length) return;
      lines.push(`${day}:`);
      shifts.forEach(s => {
        const start = `${s.start%12||12}${s.start<12?"am":"pm"}`;
        const end = `${s.end%12||12}${s.end<12?"am":"pm"}`;
        lines.push(`  ${s.staffName} — ${s.label||s.role} ${start}→${end}`);
      });
      lines.push("");
    });
    navigator.clipboard?.writeText(lines.join("\n")).catch(()=>{});
    alert("Roster copied to clipboard — paste into WhatsApp or Messages");
  }

  const ABILITY_COLORS = {
    0: B.midGrey,
    1: "#E65100",
    2: B.amberDark,
    3: B.success,
  };

  return(
    <div style={{position:"fixed",inset:0,background:B.amberPale,zIndex:400,overflowY:"auto"}}>
      <style>{`*{box-sizing:border-box;}@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}.shift-row{animation:fadeUp 0.3s ease forwards;}`}</style>

      {/* Header */}
      <div style={{background:B.white,borderBottom:`1px solid ${B.lightGrey}`,
        padding:"14px 20px",position:"sticky",top:0,zIndex:100,
        boxShadow:"0 1px 8px rgba(28,21,16,0.06)"}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",
          justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>onWeekChange(weekOffset-1)} style={{
              width:32,height:32,borderRadius:"50%",
              border:`1.5px solid ${B.midGrey}`,background:B.white,
              color:B.warmGrey,cursor:"pointer",fontSize:18,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>‹</button>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:13,fontWeight:700,color:B.amber,
                letterSpacing:"0.08em",textTransform:"uppercase",
                fontFamily:"system-ui,-apple-system,sans-serif"}}>Roster</p>
              <p style={{fontSize:11,color:B.warmGrey,
                fontFamily:"system-ui,-apple-system,sans-serif"}}>
                {venueName} · {weekLabel}
              </p>
            </div>
            <button onClick={()=>onWeekChange(weekOffset+1)} style={{
              width:32,height:32,borderRadius:"50%",
              border:`1.5px solid ${B.midGrey}`,background:B.white,
              color:B.warmGrey,cursor:"pointer",fontSize:18,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>›</button>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={copyToClipboard} style={{
              padding:"8px 14px",borderRadius:10,background:B.amber,
              border:"none",color:B.white,fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
            }}>📋 Copy</button>
            <button onClick={()=>{
              const lines=[`${venueName} — Roster ${weekLabel}`,""];
              DAYS.forEach(day=>{
                const shifts=localRoster[day];
                if(!shifts?.length) return;
                const dayData=weekData.find(d=>d.day===day);
                if(!dayData||dayData.closed) return;
                lines.push(`${day} ${dayData.date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}:`);
                shifts.forEach(s=>{
                  const start=`${s.start%12||12}${s.start<12?"am":"pm"}`;
                  const end=`${s.end%12||12}${s.end<12?"am":"pm"}`;
                  lines.push(`  ${s.staffName} — ${s.label||s.role} ${start}→${end}`);
                });
                lines.push("");
              });
              const subject=encodeURIComponent(`${venueName} Roster — ${weekLabel}`);
              const body=encodeURIComponent(lines.join("\n"));
              window.location.href=`mailto:?subject=${subject}&body=${body}`;
            }} style={{
              padding:"8px 14px",borderRadius:10,background:B.white,
              border:`1.5px solid ${B.midGrey}`,color:B.nearBlack,
              fontSize:13,fontWeight:700,cursor:"pointer",
              fontFamily:"system-ui,-apple-system,sans-serif",
            }}>✉️ Email</button>
            <button onClick={onClose} style={{
              padding:"8px 16px",borderRadius:10,background:"transparent",
              border:`1.5px solid ${B.midGrey}`,color:B.warmGrey,
              fontSize:13,fontWeight:600,cursor:"pointer",
              fontFamily:"system-ui,-apple-system,sans-serif",
            }}>Close</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:480,margin:"0 auto",padding:"20px 18px 80px"}}>

        {/* Day by day roster */}
        {DAYS.map(day => {
          const shifts = localRoster[day] || [];
          const dayData = weekData.find(d => d.day === day);
          if (!dayData || dayData.closed) return(
            <div key={day} style={{marginBottom:12,opacity:0.4}}>
              <p style={{fontSize:13,fontWeight:700,color:B.warmGrey,
                fontFamily:"system-ui,-apple-system,sans-serif",
                letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>
                {day} · Closed
              </p>
            </div>
          );

          return(
            <div key={day} style={{background:B.white,borderRadius:18,padding:18,
              marginBottom:14,boxShadow:"0 2px 8px rgba(28,21,16,0.05)",
              border:`1px solid ${B.lightGrey}`}}>

              {/* Day header */}
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:12}}>
                <p style={{fontSize:14,fontWeight:700,color:B.nearBlack,
                  fontFamily:"system-ui,-apple-system,sans-serif",
                  letterSpacing:"0.05em",textTransform:"uppercase"}}>
                  {day} · {dayData.date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}
                </p>
                <p style={{fontSize:13,color:B.amber,fontWeight:600,
                  fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  ${Math.round(dayData.adj).toLocaleString()}
                </p>
              </div>

              {shifts.length === 0 ? (
                <p style={{fontSize:13,color:B.warmGrey,
                  fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  No shifts needed
                </p>
              ) : (
                shifts.map((shift, i) => {
                  const isEditing = editingShift?.day===day && editingShift?.index===i;
                  const startFmt = `${shift.start%12||12}${shift.start<12?"am":"pm"}`;
                  const endFmt = `${shift.end%12||12}${shift.end<12?"am":"pm"}`;
                  const abilityColor = ABILITY_COLORS[shift.abilityLevel||0];
                  const isUnassigned = !shift.staffId;

                  return(
                    <div key={i} className="shift-row" style={{
                      marginBottom:8,borderRadius:12,overflow:"hidden",
                      border:`1.5px solid ${isUnassigned?"#ffcdd2":B.lightGrey}`,
                    }}>
                      <div style={{
                        display:"flex",alignItems:"center",justifyContent:"space-between",
                        padding:"10px 14px",
                        background:isUnassigned?"#fff5f5":B.amberPale,
                      }}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:8,height:8,borderRadius:"50%",
                            background:abilityColor,flexShrink:0}}/>
                          <div>
                            <p style={{fontSize:14,fontWeight:700,
                              color:isUnassigned?B.danger:B.nearBlack,
                              fontFamily:"system-ui,-apple-system,sans-serif"}}>
                              {shift.staffName}
                            </p>
                            <p style={{fontSize:12,color:B.warmGrey,
                              fontFamily:"system-ui,-apple-system,sans-serif"}}>
                              {shift.label||shift.role} · {startFmt}→{endFmt}
                            </p>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>setEditingShift(
                            isEditing&&editingShift?.mode==="time" ? null : {day, index:i, mode:"time"}
                          )} style={{
                            fontSize:12,color:B.warmGrey,background:"none",
                            border:`1px solid ${B.midGrey}`,borderRadius:8,
                            padding:"4px 10px",cursor:"pointer",fontWeight:600,
                            fontFamily:"system-ui,-apple-system,sans-serif",
                          }}>⏱</button>
                          <button onClick={()=>setEditingShift(
                            isEditing&&editingShift?.mode==="swap" ? null : {day, index:i, mode:"swap"}
                          )} style={{
                            fontSize:12,color:B.amber,background:"none",
                            border:`1px solid ${B.amber}`,borderRadius:8,
                            padding:"4px 10px",cursor:"pointer",fontWeight:600,
                            fontFamily:"system-ui,-apple-system,sans-serif",
                          }}>Swap</button>
                        </div>
                      </div>

                      {/* Edit panel — time or swap */}
                      {isEditing&&(
                        <div style={{padding:"12px 14px",background:B.white,
                          borderTop:`1px solid ${B.lightGrey}`}}>

                          {editingShift?.mode==="time"&&(
                            <>
                              <p style={{fontSize:11,color:B.warmGrey,marginBottom:10,
                                fontFamily:"system-ui,-apple-system,sans-serif",
                                textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>
                                Edit shift times
                              </p>
                              <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
                                <div style={{flex:1}}>
                                  <p style={{fontSize:11,color:B.warmGrey,marginBottom:4,
                                    fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",
                                    letterSpacing:"0.06em",fontWeight:600}}>Start</p>
                                  <select value={shift.start}
                                    onChange={e=>updateShiftTime(day,i,"start",e.target.value)}
                                    style={{width:"100%",padding:"9px 10px",borderRadius:10,
                                      border:`1.5px solid ${B.midGrey}`,fontSize:14,
                                      fontFamily:"system-ui,-apple-system,sans-serif",
                                      color:B.nearBlack,background:B.white,outline:"none"}}>
                                    {HOURS_LIST.map(h=><option key={h.value} value={h.value}>{h.label}</option>)}
                                  </select>
                                </div>
                                <p style={{color:B.warmGrey,fontSize:16,marginTop:16}}>→</p>
                                <div style={{flex:1}}>
                                  <p style={{fontSize:11,color:B.warmGrey,marginBottom:4,
                                    fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",
                                    letterSpacing:"0.06em",fontWeight:600}}>End</p>
                                  <select value={shift.end}
                                    onChange={e=>updateShiftTime(day,i,"end",e.target.value)}
                                    style={{width:"100%",padding:"9px 10px",borderRadius:10,
                                      border:`1.5px solid ${B.midGrey}`,fontSize:14,
                                      fontFamily:"system-ui,-apple-system,sans-serif",
                                      color:B.nearBlack,background:B.white,outline:"none"}}>
                                    {HOURS_LIST.map(h=><option key={h.value} value={h.value}>{h.label}</option>)}
                                  </select>
                                </div>
                              </div>
                              <button onClick={()=>deleteShift(day,i)} style={{
                                width:"100%",padding:"9px 0",borderRadius:10,
                                background:"transparent",border:`1.5px solid ${B.danger}`,
                                color:B.danger,fontSize:13,fontWeight:600,cursor:"pointer",
                                fontFamily:"system-ui,-apple-system,sans-serif",
                              }}>Delete shift</button>
                            </>
                          )}

                          {editingShift?.mode==="swap"&&(
                            <>
                              <p style={{fontSize:11,color:B.warmGrey,marginBottom:8,
                                fontFamily:"system-ui,-apple-system,sans-serif",
                                textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>
                                Assign to:
                              </p>
                              {staff.filter(s=>
                                getEffectiveAbility(s, shift.role)>0 &&
                                isStaffAvailable(s, day, dayData.date)
                              ).map(s=>(
                                <button key={s.id} onClick={()=>reassign(day,i,s.id)}
                                  style={{
                                    display:"flex",alignItems:"center",gap:10,
                                    width:"100%",padding:"9px 12px",marginBottom:6,
                                    borderRadius:10,border:`1.5px solid ${shift.staffId===s.id?B.amber:B.lightGrey}`,
                                    background:shift.staffId===s.id?B.amberLight:B.white,
                                    cursor:"pointer",textAlign:"left",
                                    fontFamily:"system-ui,-apple-system,sans-serif",
                                  }}>
                                  <div style={{width:8,height:8,borderRadius:"50%",
                                    background:ABILITY_COLORS[getEffectiveAbility(s,shift.role)],flexShrink:0}}/>
                                  <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,flex:1}}>{s.name}</p>
                                  <p style={{fontSize:12,color:B.warmGrey}}>
                                    {ABILITY_LEVELS.find(l=>l.key===getEffectiveAbility(s,shift.role))?.short}
                                  </p>
                                </button>
                              ))}
                              {staff.filter(s=>getEffectiveAbility(s,shift.role)>0&&isStaffAvailable(s,day,dayData.date)).length===0&&(
                                <p style={{fontSize:13,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                                  No available staff for this role
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Add shift button */}
              <button onClick={()=>addShift(day)} style={{
                width:"100%",padding:"10px 0",marginTop:8,
                borderRadius:10,border:`1.5px dashed ${B.amber}`,
                background:"transparent",color:B.amberDark,
                fontSize:13,fontWeight:600,cursor:"pointer",
                fontFamily:"system-ui,-apple-system,sans-serif",
              }}>+ Add shift</button>
            </div>
          );
        })}

        {/* Hours summary */}
        <div style={{background:B.white,borderRadius:18,padding:18,marginTop:8,
          boxShadow:"0 2px 8px rgba(28,21,16,0.05)"}}>
          <p style={{fontSize:11,letterSpacing:"0.1em",color:B.warmGrey,
            fontFamily:"system-ui,-apple-system,sans-serif",
            textTransform:"uppercase",fontWeight:600,marginBottom:14}}>
            Weekly hours
          </p>
          {hoursSummary.filter(s=>s.preferred>0).map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",paddingBottom:8,marginBottom:8,
              borderBottom:`1px solid ${B.lightGrey}`}}>
              <p style={{fontSize:14,fontWeight:600,color:B.nearBlack,
                fontFamily:"system-ui,-apple-system,sans-serif"}}>{s.name}</p>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:14,fontWeight:600,
                  color:s.allocated>=s.preferred*0.8?B.success:B.danger,
                  fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  {s.allocated}h
                </p>
                <p style={{fontSize:11,color:B.warmGrey,
                  fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  of {s.preferred}h preferred
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function MainApp({venue, onReset}){
  const[weekOffset,setWeekOffset]=useState(0);
  const[selectedDay,setSelectedDay]=useState(null);
  const[actual,setActual]=useState(()=>{ try{const s=localStorage.getItem("wagesave_actual");return s?JSON.parse(s):{}}catch{return{}}});
  const[feedback,setFeedback]=useState(()=>{ try{const s=localStorage.getItem("wagesave_feedback");return s?JSON.parse(s):{}}catch{return{}}});
  const[weather,setWeather]=useState(null); // current conditions for display
  const[forecast,setForecast]=useState({}); // {dateKey: {mult, label, temp}}
  const[showSettings,setShowSettings]=useState(false);
  const[showRoster,setShowRoster]=useState(false);
  const[showCsvNudge,setShowCsvNudge]=useState(()=>{ try{return localStorage.getItem("wagesave_csv_dismissed")!=="true"}catch{return true}});
  const[showMonthPrompt,setShowMonthPrompt]=useState(()=>{
    try{
      const saved=localStorage.getItem("wagesave_month_dismissed");
      const currentMonth=new Date().toISOString().slice(0,7); // "2026-04"
      return saved!==currentMonth;
    }catch{return false;}
  });
  const currentMonthName=new Date().toLocaleString("en-AU",{month:"long"});
  const[baseRevenue,setBaseRevenue]=useState(()=>{ try{const s=localStorage.getItem("wagesave_base_revenue");return s?Number(s):venue.baseRevenue||2500}catch{return venue.baseRevenue||2500}});
  const[dayRevenue,setDayRevenue]=useState(()=>{ try{const s=localStorage.getItem("wagesave_day_revenue");return s?JSON.parse(s):venue.dayRevenue||{...DEFAULT_DAY_REVENUE}}catch{return venue.dayRevenue||{...DEFAULT_DAY_REVENUE}}});
  const[localEvents,setLocalEvents]=useState(()=>{ try{const s=localStorage.getItem("wagesave_local_events");return s?JSON.parse(s):[...DEFAULT_LOCAL_EVENTS]}catch{return[...DEFAULT_LOCAL_EVENTS]}});
  const[staff,setStaff]=useState(()=>{ try{const s=localStorage.getItem("wagesave_staff");return s?JSON.parse(s):[]}catch{return[]}});

  useEffect(()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos=>{
      const API_KEY = "8c9686f901d9e2180d4328a24d2da88f";
      // Current weather for header display
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${API_KEY}&units=metric`)
        .then(r=>r.json()).then(d=>{
          if(d.cod!==200) return;
          const temp=Math.round(d.main.temp);
          setWeather({...weatherFromCode(d.weather[0].id,temp),temp,city:d.name});
        }).catch(()=>{});
      // 5-day forecast — one entry per 3 hours, we pick midday for each day
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${API_KEY}&units=metric`)
        .then(r=>r.json()).then(d=>{
          if(!d.list) return;
          const byDay = {};
          d.list.forEach(entry=>{
            const dt = new Date(entry.dt * 1000);
            const dk = dateKey(dt);
            const hour = dt.getHours();
            // Prefer midday reading (11am-1pm) for each day
            if(!byDay[dk] || Math.abs(hour-12) < Math.abs(byDay[dk].hour-12)){
              byDay[dk] = {
                hour,
                ...weatherFromCode(entry.weather[0].id, Math.round(entry.main.temp)),
                temp: Math.round(entry.main.temp),
              };
            }
          });
          setForecast(byDay);
        }).catch(()=>{});
    },()=>{},{timeout:8000});
  },[]);

  // Persist state to localStorage
  useEffect(()=>{try{localStorage.setItem("wagesave_actual",JSON.stringify(actual));}catch{}},[actual]);
  useEffect(()=>{try{localStorage.setItem("wagesave_day_revenue",JSON.stringify(dayRevenue));}catch{}},[dayRevenue]);
  useEffect(()=>{try{localStorage.setItem("wagesave_local_events",JSON.stringify(localEvents));}catch{}},[localEvents]);
  useEffect(()=>{try{localStorage.setItem("wagesave_staff",JSON.stringify(staff));}catch{}},[staff]);
  useEffect(()=>{try{localStorage.setItem("wagesave_feedback",JSON.stringify(feedback));}catch{}},[feedback]);
  useEffect(()=>{try{localStorage.setItem("wagesave_base_revenue",String(baseRevenue));}catch{}},[baseRevenue]);

  const weatherMult=weather?weather.mult:1.0; // fallback for days without forecast
  const weekDates=getWeekDates(weekOffset);
  const today=new Date(); today.setHours(0,0,0,0);
  const weekVar=WEEK_VARIANCE[((weekOffset%14)+14)%14];

  function weekLabel(){
    if(weekOffset===0) return"This week";
    if(weekOffset===1) return"Next week";
    if(weekOffset===-1) return"Last week";
    return weekDates[0].toLocaleDateString("en-AU",{day:"numeric",month:"short"});
  }

  const weekData=DAYS.map((day,i)=>{
    const date=weekDates[i];
    const events=getEvents(date, localEvents);
    const holiday=getHoliday(date);
    const flags=[...events];
    if(holiday) flags.unshift({icon:"🎉",label:holiday,impact:"+25%",mult:1.25});
    if(isSchoolHoliday(date)&&!holiday) flags.push({icon:"🏫",label:"School holidays",impact:"+15%",mult:1.15});
    if(isLongWeekend(date)&&!holiday) flags.push({icon:"📅",label:"Long weekend",impact:"+20%",mult:1.20});
    const eventMult=flags.reduce((acc,f)=>{const p=parseFloat((f.impact||"0").replace("%",""))/100;return acc*(1+p);},1.0);
    const dk=dateKey(date);
    const dayForecast=forecast[dk];
    const dayWeatherMult=dayForecast?dayForecast.mult:weatherMult;
    const dayWeatherLabel=dayForecast?dayForecast.label:weather?.label;
    const dayTemp=dayForecast?dayForecast.temp:weather?.temp;
    const dayData=calcDay(day,baseRevenue,venue.hasKitchen,venue.servesAlcohol,venue.tradingHours,venue.seasonality,dayWeatherMult,eventMult,weekVar,date,dayRevenue);
    // Add weather flag if forecast shows rain or beach day
    if(dayForecast&&dayForecast.mult!==1.0&&!flags.some(f=>f.label&&f.label.includes("Rain")||false)){
      if(dayForecast.mult<1.0) flags.push({icon:"🌧",label:dayWeatherLabel||"Rain",impact:`${Math.round((dayForecast.mult-1)*100)}%`,mult:dayForecast.mult});
      else if(dayForecast.mult>=1.2) flags.push({icon:"🏖",label:dayWeatherLabel||"Beach day",impact:`+${Math.round((dayForecast.mult-1)*100)}%`,mult:dayForecast.mult});
    }
    return{day,date,flags,...dayData,weatherLabel:dayWeatherLabel,weatherTemp:dayTemp};
  });

  const openDays=weekData.filter(d=>!d.closed);
  const totalRev=openDays.reduce((a,d)=>a+d.adj,0);
  const totalStaff=openDays.reduce((a,d)=>a+(d.totalShifts||d.roles.total),0);
  const totalBudget=openDays.reduce((a,d)=>a+d.laborBudget,0);
  const selectedData=selectedDay?weekData.find(d=>d.day===selectedDay):null;

  // Past days that need feedback
  const needFeedback = weekData.filter(d=>{
    const dn=new Date(d.date); dn.setHours(0,0,0,0);
    return dn<today && !d.closed && !feedback[`${d.day}-${dateKey(d.date)}`];
  });

  return(
    <div style={{minHeight:"100vh",background:B.amberPale,paddingBottom:80}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}.card-in{animation:fadeUp 0.35s cubic-bezier(.23,1,.32,1) forwards;}input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:${B.midGrey};outline:none;}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${B.amber};cursor:pointer;}`}</style>

      {/* Header */}
      <div style={{background:B.white,borderBottom:`1px solid ${B.lightGrey}`,padding:"12px 20px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(28,21,16,0.06)"}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <LogoWordmark size={18}/>
            <p style={{fontSize:11,color:B.warmGrey,marginTop:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>{venue.name}{venue.suburb?` · ${venue.suburb}`:""}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {weather&&<div style={{textAlign:"right"}}><p style={{fontSize:13,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weather.label}</p><p style={{fontSize:11,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weather.temp}°C</p></div>}
            <button onClick={()=>setShowRoster(true)} style={{
              padding:"7px 14px",borderRadius:10,background:B.amber,
              border:"none",color:B.white,fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",
              boxShadow:`0 2px 8px rgba(232,160,32,0.3)`,
            }}>📋 Roster</button>
            <button onClick={()=>setShowSettings(!showSettings)} style={{width:36,height:36,borderRadius:"50%",border:`1.5px solid ${showSettings?B.amber:B.midGrey}`,background:showSettings?B.amberLight:B.white,color:showSettings?B.amberDark:B.warmGrey,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>⚙</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:480,margin:"0 auto",padding:"20px 18px 0"}}>

        {/* CSV nudge */}
        {showCsvNudge&&(
          <div style={{background:B.amberLight,borderRadius:14,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,border:`1px solid ${B.midGrey}`}}>
            <span style={{fontSize:18}}>📊</span>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:600,color:B.amberDark,fontFamily:"system-ui,-apple-system,sans-serif"}}>Improve your predictions</p>
              <p style={{fontSize:12,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Upload last year's sales CSV</p>
            </div>
            <button style={{padding:"6px 12px",borderRadius:8,background:B.amber,border:"none",color:B.white,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>Upload</button>
            <button onClick={()=>{setShowCsvNudge(false);try{localStorage.setItem("wagesave_csv_dismissed","true");}catch{}}} style={{fontSize:18,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
        )}

        {/* Feedback prompt for past days */}
        {needFeedback.length>0&&(
          <div style={{background:B.white,borderRadius:14,padding:"14px 16px",marginBottom:16,border:`1.5px solid ${B.amber}`,boxShadow:`0 2px 12px rgba(232,160,32,0.15)`}}>
            <p style={{fontSize:13,fontWeight:600,color:B.nearBlack,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>
              How did {needFeedback[0].day} go?
            </p>
            <p style={{fontSize:12,color:B.warmGrey,marginBottom:12,fontFamily:"system-ui,-apple-system,sans-serif"}}>
              Was the staffing prediction right? Your feedback makes WageSave smarter.
            </p>
            <div style={{display:"flex",gap:8}}>
              {FEEDBACK_OPTIONS.map(opt=>(
                <button key={opt.key}
                  onClick={()=>{
                    const d=needFeedback[0];
                    setFeedback(p=>({...p,[`${d.day}-${dateKey(d.date)}`]:{outcome:opt.key,note:"",savedAt:new Date().toISOString()}}));
                  }}
                  style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${B.midGrey}`,background:B.white,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif",fontSize:18,transition:"all 0.15s"}}
                  title={opt.label}
                  onMouseEnter={e=>{e.currentTarget.style.background=opt.bg;e.currentTarget.style.borderColor=opt.color;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=B.white;e.currentTarget.style.borderColor=B.midGrey;}}>
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monthly update prompt */}
        {showMonthPrompt&&!showCsvNudge&&(
          <div style={{background:B.white,borderRadius:14,padding:"14px 16px",marginBottom:16,border:`1.5px solid ${B.amber}`,boxShadow:`0 2px 12px rgba(232,160,32,0.15)`}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:20,marginTop:2}}>📅</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:B.nearBlack,marginBottom:3,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  It's {currentMonthName} — update your estimates?
                </p>
                <p style={{fontSize:12,color:B.warmGrey,marginBottom:12,lineHeight:1.4,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                  Your revenue sliders may need adjusting for the new month.
                </p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowSettings(true)} style={{flex:1,padding:"9px 0",borderRadius:10,background:B.amber,border:"none",color:B.white,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>
                    Update now
                  </button>
                  <button onClick={()=>{
                    setShowMonthPrompt(false);
                    try{localStorage.setItem("wagesave_month_dismissed",new Date().toISOString().slice(0,7));}catch{}
                  }} style={{flex:1,padding:"9px 0",borderRadius:10,background:"transparent",border:`1.5px solid ${B.midGrey}`,color:B.warmGrey,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Greeting */}
        <div style={{marginBottom:20}}>
          <p style={{fontSize:15,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{greeting()}</p>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.2,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            It's time to WageSave<br/><span style={{color:B.amber}}>at {venue.name}.</span>
          </h1>
        </div>

        {/* Settings */}
        {showSettings&&(
          <VenueSettings
            venue={venue}
            baseRevenue={baseRevenue}
            dayRevenue={dayRevenue}
            localEvents={localEvents}
            staff={staff}
            onStaffChange={setStaff}
            onLocalEventsChange={setLocalEvents}
            onDayRevenueChange={setDayRevenue}
            onBaseRevenueChange={setBaseRevenue}
            onVenueUpdate={v=>{
              const updated={...venue,...v};
              try{localStorage.setItem("wagesave_venue",JSON.stringify(updated));}catch{}
              window.location.reload();
            }}
            onReset={onReset}
          />
        )}

        {/* Week nav */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{width:36,height:36,borderRadius:"50%",border:`1.5px solid ${B.midGrey}`,background:B.white,color:B.warmGrey,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(28,21,16,0.06)"}}>‹</button>
          <div style={{textAlign:"center"}}>
            <p style={{fontSize:15,fontWeight:600,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weekLabel()}</p>
            <p style={{fontSize:11,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weekDates[0].toLocaleDateString("en-AU",{day:"numeric",month:"short"})} — {weekDates[6].toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</p>
          </div>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{width:36,height:36,borderRadius:"50%",border:`1.5px solid ${B.midGrey}`,background:B.white,color:B.warmGrey,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(28,21,16,0.06)"}}>›</button>
        </div>

        {/* Week summary */}
        <div style={{background:B.amber,borderRadius:18,padding:"14px 20px",marginBottom:18,boxShadow:"0 4px 20px rgba(232,160,32,0.3)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
            {[["Week revenue",`$${(totalRev/1000).toFixed(1)}k`],["Total shifts",totalStaff],["Labour budget",`$${(totalBudget/1000).toFixed(1)}k`]].map(([label,val],i)=>(
              <div key={i} style={{textAlign:"center",borderLeft:i>0?`1px solid rgba(255,255,255,0.25)`:"none",padding:"0 4px"}}>
                <p style={{fontSize:10,letterSpacing:"0.07em",color:"rgba(255,255,255,0.75)",textTransform:"uppercase",fontWeight:600,marginBottom:3,fontFamily:"system-ui,-apple-system,sans-serif"}}>{label}</p>
                <p style={{fontSize:20,fontWeight:700,color:B.white,fontFamily:"system-ui,-apple-system,sans-serif"}}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Day cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {weekData.map((dayData,idx)=>{
            const {day,date,roles,adj,flags,byHour,closed}=dayData;
            const dateN=new Date(date); dateN.setHours(0,0,0,0);
            const isToday=dateN.getTime()===today.getTime();
            const isPast=dateN<today;
            const act=actual[day]||0;
            const diff=act>0?act-(dayData.peakCover||roles.total):0;
            const fb=feedback[`${day}-${dateKey(date)}`];

            return(
              <div key={day} className="card-in"
                onClick={()=>setSelectedDay(day)}
                style={{background:closed?"#F8F5F0":B.white,borderRadius:20,padding:18,cursor:"pointer",border:`1.5px solid ${isToday?B.amber:B.lightGrey}`,boxShadow:isToday?`0 4px 20px rgba(232,160,32,0.25)`:`0 2px 8px rgba(28,21,16,0.05)`,opacity:isPast?0.6:1,transition:"transform 0.12s ease,box-shadow 0.12s ease",animationDelay:`${idx*0.05}s`,position:"relative"}}
                onMouseEnter={e=>{if(!isPast){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(28,21,16,0.1)";}}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=isToday?"0 4px 20px rgba(232,160,32,0.25)":"0 2px 8px rgba(28,21,16,0.05)";}}>

                {isToday&&<div style={{position:"absolute",top:12,right:12,background:B.amber,borderRadius:100,padding:"2px 8px",fontSize:9,fontWeight:700,color:B.white,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.05em"}}>TODAY</div>}

                <p style={{fontSize:11,letterSpacing:"0.08em",color:B.warmGrey,fontWeight:600,textTransform:"uppercase",marginBottom:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
                <p style={{fontSize:11,color:B.midGrey,marginBottom:10,fontFamily:"system-ui,-apple-system,sans-serif"}}>{date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</p>

                {closed?(
                  <p style={{fontSize:18,color:B.midGrey,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif",marginTop:8}}>Closed</p>
                ):(
                  <>
                    <p style={{fontSize:40,fontWeight:700,color:B.amber,lineHeight:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                      {dayData.peakCover||roles.total}
                    </p>
                    <p style={{fontSize:11,color:B.warmGrey,marginTop:2,marginBottom:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>peak at once</p>
                    <p style={{fontSize:11,color:B.midGrey,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>{dayData.totalShifts||roles.total} shifts across the day</p>
                    <p style={{fontSize:11,color:B.warmGrey,marginBottom:6,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>{roles.roles.map(r=>`${r.count}× ${r.role}`).join(" · ")}</p>
                    <p style={{fontSize:13,color:B.warmGrey,fontWeight:500,fontFamily:"system-ui,-apple-system,sans-serif"}}>${adj>=1000?`${(adj/1000).toFixed(1)}k`:Math.round(adj)}</p>

                    {flags.length>0&&<div style={{display:"flex",gap:3,marginTop:8,flexWrap:"wrap"}}>{flags.map((f,i)=><span key={i} title={`${f.label} ${f.impact}`} style={{fontSize:14}}>{f.icon}</span>)}</div>}

                    {/* Feedback on card */}
                    {fb?(
                      <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${B.lightGrey}`,fontSize:18}}>
                        {FEEDBACK_OPTIONS.find(o=>o.key===fb.outcome)?.icon}
                      </div>
                    ):isPast&&!closed?(
                      <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${B.lightGrey}`}}>
                        <p style={{fontSize:11,color:B.amber,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>Tap to give feedback</p>
                      </div>
                    ):act>0?(
                      <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${B.lightGrey}`,fontSize:11,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif",color:diff>0?B.danger:B.success}}>
                        {diff>0?`+${diff} over`:diff<0?`${Math.abs(diff)} under`:"✓ on target"}
                      </div>
                    ):null}

                    <MiniBar byHour={byHour}/>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p style={{fontSize:11,color:B.midGrey,textAlign:"center",marginTop:24,fontFamily:"system-ui,-apple-system,sans-serif"}}>Tap any day for details{venue.suburb?` · ${venue.suburb}`:""}</p>
      </div>

      {/* Roster View */}
      {showRoster&&(
        <RosterView
          weekData={weekData}
          staff={staff||[]}
          venueName={venue.name}
          weekLabel={weekLabel()}
          weekOffset={weekOffset}
          onWeekChange={setWeekOffset}
          onClose={()=>setShowRoster(false)}
        />
      )}

      {/* Drawer */}
      {selectedDay!==null&&selectedData&&(
        <DayDrawer
          key={selectedDay}
          dayData={selectedData}
          venueName={venue.name}
          localEvents={localEvents}
          actual={actual[selectedDay]||0}
          onActualChange={v=>setActual(p=>({...p,[selectedDay]:v}))}
          feedback={feedback[`${selectedDay}-${dateKey(selectedData.date)}`]}
          onFeedback={fb=>setFeedback(p=>({...p,[`${selectedDay}-${dateKey(selectedData.date)}`]:fb}))}
          onClose={()=>setSelectedDay(null)}
        />
      )}
    </div>
  );
}


// ─── ROSTER ANALYSER ──────────────────────────────────────────────────────────
function RosterAnalyser({onSetupVenue, onBack}){
  const[step,setStep]=useState(0); // 0=upload, 1=revenue, 2=analysing, 3=results
  const[rosterImage,setRosterImage]=useState(null);
  const[timesheetImage,setTimesheetImage]=useState(null);
  const[rosterPreview,setRosterPreview]=useState(null);
  const[timesheetPreview,setTimesheetPreview]=useState(null);
  const[weekRevenue,setWeekRevenue]=useState({Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0});
  const[analysis,setAnalysis]=useState(null);
  const[error,setError]=useState(null);
  const rosterRef=useRef(null);
  const timesheetRef=useRef(null);

  const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const AVG_RATE=29;

  function handleImageUpload(file, type){
    if(!file) return;
    // Compress image to reduce size for API
    const img=new Image();
    const objectUrl=URL.createObjectURL(file);
    img.onload=()=>{
      const canvas=document.createElement("canvas");
      // Max 1200px wide, maintain aspect ratio
      const maxW=1200;
      const scale=Math.min(1, maxW/img.width);
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Compress to JPEG at 0.7 quality
      const dataUrl=canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(objectUrl);
      if(type==="roster"){ setRosterImage(dataUrl); setRosterPreview(dataUrl); }
      else{ setTimesheetImage(dataUrl); setTimesheetPreview(dataUrl); }
    };
    img.src=objectUrl;
  }

  async function analyseRoster(){
    setStep(2);
    setError(null);

    try{
      const messages=[];
      const imageContent=[];

      if(rosterImage){
        const rosterBase64=rosterImage.includes(",") ? rosterImage.split(",")[1] : rosterImage;
        imageContent.push({
          type:"image",
          source:{type:"base64",media_type:"image/jpeg",data:rosterBase64}
        });
      }
      if(timesheetImage){
        const timesheetBase64=timesheetImage.includes(",") ? timesheetImage.split(",")[1] : timesheetImage;
        imageContent.push({
          type:"image",
          source:{type:"base64",media_type:"image/jpeg",data:timesheetBase64}
        });
      }

      imageContent.push({
        type:"text",
        text:`You are analysing a hospitality venue roster${timesheetImage?" and timesheet":""}.

Extract all shift information and return ONLY a JSON object in this exact format:
{
  "venueName": "string or null",
  "weekOf": "string or null",
  "shifts": [
    {"day": "Mon/Tue/Wed/Thu/Fri/Sat/Sun", "role": "string", "startHour": number, "endHour": number, "hours": number}
  ],
  "summary": "one sentence describing what you see"
}

Rules:
- Convert times to 24hr numbers (8am=8, 12pm=12, 3pm=15, 5pm=17, close=22 if unclear)
- Infer roles from context: morning/coffee staff = Coffee, kitchen mentions = Kitchen, otherwise = Floor
- Each named person = one shift entry
- Return ONLY valid JSON, no other text`
      });

      const response=await fetch("/api/analyse",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          messages:[{role:"user",content:imageContent}]
        })
      });

      if(!response.ok){
        const errData=await response.json().catch(()=>({}));
        throw new Error(`API error ${response.status}: ${errData.error||response.statusText}`);
      }
      const data=await response.json();
      if(data.error) throw new Error(data.error);
      const text=data.content?.find(c=>c.type==="text")?.text||"";
      if(!text) throw new Error("No response from AI — check your API key in Vercel");
      const clean=text.replace(/```json|```/g,"").trim();
      let parsed;
      try{ parsed=JSON.parse(clean); }
      catch(e){ throw new Error("Couldn't parse roster data. Try a clearer photo."); }

      // Calculate analysis
      const dayData={};
      DAYS.forEach(day=>{
        const dayShifts=parsed.shifts.filter(s=>s.day===day);
        const totalHours=dayShifts.reduce((a,s)=>a+(s.hours||(s.endHour-s.startHour)),0);
        const peakStaff=dayShifts.length;
        const rev=weekRevenue[day]||0;
        const laborBudget=rev*0.30;
        const optimalHours=laborBudget/AVG_RATE;
        const optimalPeak=rev<500?1:rev<1500?2:rev<3000?3:rev<5000?4:rev<7000?5:6;
        const actualWages=totalHours*AVG_RATE;
        const optimalWages=Math.min(actualWages,optimalHours*AVG_RATE);
        const waste=Math.max(0,actualWages-optimalWages);

        if(dayShifts.length>0||rev>0){
          dayData[day]={
            shifts:dayShifts,
            totalHours:Math.round(totalHours*10)/10,
            peakStaff,
            revenue:rev,
            actualWages:Math.round(actualWages),
            optimalWages:Math.round(optimalWages),
            waste:Math.round(waste),
            optimalPeak,
            overBy:Math.max(0,peakStaff-optimalPeak),
          };
        }
      });

      const totalWaste=Object.values(dayData).reduce((a,d)=>a+d.waste,0);
      const totalActual=Object.values(dayData).reduce((a,d)=>a+d.actualWages,0);

      setAnalysis({
        venueName:parsed.venueName,
        weekOf:parsed.weekOf,
        summary:parsed.summary,
        dayData,
        totalWaste,
        totalActual,
        shiftsFound:parsed.shifts.length,
      });
      setStep(3);

    }catch(err){
      console.error("Roster analysis error:", err);
      setError(`Error: ${err.message || "Couldn't read the roster"}. Check console for details.`);
      setStep(1);
    }
  }

  const inputStyle={width:"100%",padding:"12px 14px",borderRadius:12,
    border:`1.5px solid ${B.midGrey}`,fontSize:16,fontFamily:"system-ui,-apple-system,sans-serif",
    color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box"};

  // Step 0 — Upload
  if(step===0) return(
    <div style={{minHeight:"100vh",background:B.amberPale}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}.fade-up{animation:fadeUp 0.35s ease forwards;}`}</style>
      <div style={{maxWidth:440,margin:"0 auto",padding:"40px 24px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40}}>
          <LogoWordmark size={20}/>
          <button onClick={onBack} style={{fontSize:13,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>← Back</button>
        </div>

        <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Analyse my roster
        </h2>
        <p style={{fontSize:15,color:B.warmGrey,marginBottom:32,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Upload a photo of last week's roster. WageSave will tell you where you could have saved on wages.
        </p>

        {/* Roster upload */}
        <div style={{marginBottom:20}}>
          <p style={{fontSize:13,fontWeight:600,color:B.nearBlack,marginBottom:10,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.02em"}}>
            ROSTER <span style={{color:B.amber}}>*</span>
          </p>
          <input ref={rosterRef} type="file" accept="image/*"
            onChange={e=>handleImageUpload(e.target.files[0],"roster")}
            style={{display:"none"}}/>
          {rosterPreview?(
            <div style={{position:"relative",borderRadius:14,overflow:"hidden",marginBottom:8}}>
              <img src={rosterPreview} alt="Roster" style={{width:"100%",borderRadius:14,display:"block"}}/>
              <button onClick={()=>{setRosterImage(null);setRosterPreview(null);}} style={{
                position:"absolute",top:10,right:10,width:28,height:28,borderRadius:"50%",
                background:"rgba(28,21,16,0.7)",border:"none",color:"white",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
              }}>×</button>
            </div>
          ):(
            <button onClick={()=>rosterRef.current?.click()} style={{
              width:"100%",padding:"32px 20px",borderRadius:14,
              border:`2px dashed ${B.midGrey}`,background:B.white,
              cursor:"pointer",textAlign:"center",
            }}>
              <p style={{fontSize:32,marginBottom:8}}>📸</p>
              <p style={{fontSize:15,fontWeight:600,color:B.nearBlack,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>Take a photo or upload</p>
              <p style={{fontSize:13,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Roster sheet, spreadsheet screenshot, anything works</p>
            </button>
          )}
        </div>

        {/* Timesheet upload — optional */}
        <div style={{marginBottom:32}}>
          <p style={{fontSize:13,fontWeight:600,color:B.nearBlack,marginBottom:10,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.02em"}}>
            TIMESHEET <span style={{color:B.warmGrey,fontWeight:400}}>— optional, more accurate</span>
          </p>
          <input ref={timesheetRef} type="file" accept="image/*"
            onChange={e=>handleImageUpload(e.target.files[0],"timesheet")}
            style={{display:"none"}}/>
          {timesheetPreview?(
            <div style={{position:"relative",borderRadius:14,overflow:"hidden",marginBottom:8}}>
              <img src={timesheetPreview} alt="Timesheet" style={{width:"100%",borderRadius:14,display:"block"}}/>
              <button onClick={()=>{setTimesheetImage(null);setTimesheetPreview(null);}} style={{
                position:"absolute",top:10,right:10,width:28,height:28,borderRadius:"50%",
                background:"rgba(28,21,16,0.7)",border:"none",color:"white",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
              }}>×</button>
            </div>
          ):(
            <button onClick={()=>timesheetRef.current?.click()} style={{
              width:"100%",padding:"20px",borderRadius:14,
              border:`1.5px dashed ${B.midGrey}`,background:B.amberPale,
              cursor:"pointer",textAlign:"center",
            }}>
              <p style={{fontSize:20,marginBottom:6}}>📋</p>
              <p style={{fontSize:14,fontWeight:600,color:B.warmGrey,marginBottom:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>Add timesheet</p>
              <p style={{fontSize:12,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>Shows actual hours worked vs rostered</p>
            </button>
          )}
        </div>

        {error&&<p style={{fontSize:13,color:B.danger,marginBottom:16,fontFamily:"system-ui,-apple-system,sans-serif"}}>{error}</p>}

        <button onClick={()=>rosterImage?setStep(1):null} style={{
          width:"100%",padding:"17px 0",
          background:rosterImage?B.amber:"#D4C9BB",
          color:B.white,border:"none",borderRadius:14,
          fontSize:16,fontWeight:700,cursor:rosterImage?"pointer":"not-allowed",
          fontFamily:"system-ui,-apple-system,sans-serif",
          boxShadow:rosterImage?`0 4px 16px rgba(232,160,32,0.3)`:"none",
        }}>
          Next — add revenue →
        </button>
      </div>
    </div>
  );

  // Step 1 — Revenue input
  if(step===1) return(
    <div style={{minHeight:"100vh",background:B.amberPale}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{maxWidth:440,margin:"0 auto",padding:"40px 24px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40}}>
          <LogoWordmark size={20}/>
          <button onClick={()=>setStep(0)} style={{fontSize:13,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>← Back</button>
        </div>

        <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          What did each day do?
        </h2>
        <p style={{fontSize:15,color:B.warmGrey,marginBottom:28,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Enter revenue for each day you were open. Leave closed days at $0.
        </p>

        {DAYS.map(day=>(
          <div key={day} style={{marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:600,color:B.nearBlack,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>{day}</p>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>$</span>
              <input type="number" min={0} max={99999}
                value={weekRevenue[day]||""}
                placeholder="0 — closed"
                onChange={e=>setWeekRevenue(p=>({...p,[day]:Number(e.target.value)}))}
                style={{...inputStyle,paddingLeft:28}}
                onFocus={e=>e.target.style.borderColor=B.amber}
                onBlur={e=>e.target.style.borderColor=B.midGrey}/>
            </div>
          </div>
        ))}

        <div style={{marginTop:28}}>
          <button onClick={analyseRoster} style={{
            width:"100%",padding:"17px 0",background:B.amber,
            color:B.white,border:"none",borderRadius:14,
            fontSize:16,fontWeight:700,cursor:"pointer",
            fontFamily:"system-ui,-apple-system,sans-serif",
            boxShadow:`0 4px 16px rgba(232,160,32,0.3)`,
          }}>
            Analyse my roster →
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2 — Analysing
  if(step===2) return(
    <div style={{minHeight:"100vh",background:B.amberPale,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin 1s linear infinite;display:inline-block;}`}</style>
      <Logo size={48}/>
      <div style={{textAlign:"center"}}>
        <p style={{fontSize:18,fontWeight:600,color:B.nearBlack,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>Reading your roster...</p>
        <p style={{fontSize:14,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>This takes about 10 seconds</p>
      </div>
      <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${B.lightGrey}`,borderTopColor:B.amber,animation:"spin 0.8s linear infinite"}}/>
    </div>
  );

  // Step 3 — Results
  if(step===3&&analysis) return(
    <div style={{minHeight:"100vh",background:B.amberPale,paddingBottom:80}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}.fade-up{animation:fadeUp 0.4s ease forwards;}`}</style>

      {/* Header */}
      <div style={{background:B.white,borderBottom:`1px solid ${B.lightGrey}`,padding:"14px 20px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(28,21,16,0.06)"}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <LogoWordmark size={18}/>
          <button onClick={()=>setStep(0)} style={{fontSize:13,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",fontFamily:"system-ui,-apple-system,sans-serif"}}>Analyse another</button>
        </div>
      </div>

      <div style={{maxWidth:480,margin:"0 auto",padding:"24px 20px 0"}}>

        {/* Venue + summary */}
        {analysis.venueName&&(
          <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{analysis.venueName}{analysis.weekOf?` · ${analysis.weekOf}`:""}</p>
        )}

        {/* Hero waste number */}
        <div className="fade-up" style={{background:analysis.totalWaste>0?B.dangerLight:B.successLight,borderRadius:20,padding:"24px 20px",marginBottom:20,border:`1.5px solid ${analysis.totalWaste>0?"#ffcdd2":B.successLight}`}}>
          {analysis.totalWaste>0?(
            <>
              <p style={{fontSize:13,fontWeight:600,color:B.danger,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.05em"}}>IDENTIFIED WAGE WASTE</p>
              <p style={{fontSize:52,fontWeight:700,color:B.danger,lineHeight:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                ${analysis.totalWaste.toLocaleString()}
              </p>
              <p style={{fontSize:14,color:B.danger,marginTop:6,opacity:0.8,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                last week · {analysis.shiftsFound} shifts read
              </p>
            </>
          ):(
            <>
              <p style={{fontSize:13,fontWeight:600,color:B.success,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>STAFFING LOOKS EFFICIENT</p>
              <p style={{fontSize:22,fontWeight:700,color:B.success,fontFamily:"system-ui,-apple-system,sans-serif"}}>No significant waste identified</p>
            </>
          )}
        </div>

        {/* Per day breakdown */}
        <p style={{fontSize:11,letterSpacing:"0.1em",color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif",textTransform:"uppercase",fontWeight:600,marginBottom:12}}>Day by day</p>

        {DAYS.map(day=>{
          const d=analysis.dayData[day];
          if(!d) return null;
          return(
            <div key={day} className="fade-up" style={{
              background:B.white,borderRadius:16,padding:18,marginBottom:12,
              border:`1.5px solid ${d.waste>0?B.dangerLight:B.lightGrey}`,
              boxShadow:"0 2px 8px rgba(28,21,16,0.05)",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.05em",textTransform:"uppercase"}}>{day}</p>
                  <p style={{fontSize:12,color:B.warmGrey,marginTop:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                    {d.peakStaff} staff · {d.totalHours}h total · ${d.revenue.toLocaleString()} revenue
                  </p>
                </div>
                {d.waste>0?(
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:11,color:B.danger,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>WASTE</p>
                    <p style={{fontSize:20,fontWeight:700,color:B.danger,fontFamily:"system-ui,-apple-system,sans-serif"}}>−${d.waste.toLocaleString()}</p>
                  </div>
                ):(
                  <p style={{fontSize:13,color:B.success,fontWeight:600,fontFamily:"system-ui,-apple-system,sans-serif"}}>✓ On track</p>
                )}
              </div>

              {d.overBy>0&&(
                <div style={{background:B.dangerLight,borderRadius:10,padding:"10px 14px"}}>
                  <p style={{fontSize:13,color:B.danger,fontFamily:"system-ui,-apple-system,sans-serif"}}>
                    ⚠️ Overstaffed by {d.overBy} — WageSave would have recommended {d.optimalPeak} peak, you had {d.peakStaff}
                  </p>
                </div>
              )}

              {d.shifts.length>0&&(
                <div style={{marginTop:10}}>
                  {d.shifts.map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:i>0?`1px solid ${B.lightGrey}`:"none"}}>
                      <span style={{fontSize:12,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>{s.role}</span>
                      <span style={{fontSize:12,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{s.startHour%12||12}{s.startHour<12?"am":"pm"} → {s.endHour%12||12}{s.endHour<12?"am":"pm"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* CTA */}
        <div style={{background:B.amber,borderRadius:20,padding:"24px 20px",marginTop:8,textAlign:"center"}}>
          <p style={{fontSize:16,fontWeight:700,color:B.white,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            Get predictions before you write next week's roster
          </p>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:20,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            Set up your venue and WageSave predicts the ideal staffing every day — before you roster anyone.
          </p>
          <button onClick={onSetupVenue} style={{
            width:"100%",padding:"15px 0",background:B.white,
            color:B.amber,border:"none",borderRadius:12,
            fontSize:15,fontWeight:700,cursor:"pointer",
            fontFamily:"system-ui,-apple-system,sans-serif",
          }}>
            Set up my venue →
          </button>
        </div>

      </div>
    </div>
  );

  return null;
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function WageSave(){
  const[venue,setVenue]=useState(()=>{
    try{const s=localStorage.getItem("wagesave_venue");return s?JSON.parse(s):null;}catch{return null;}
  });
  const[loading,setLoading]=useState(true);
  const[mode,setMode]=useState("home"); // "home" | "onboarding" | "analyse"

  useEffect(()=>setLoading(false),[]);

  function handleComplete(v){
    try{localStorage.setItem("wagesave_venue",JSON.stringify(v));}catch{}
    setVenue(v);
    setMode("app");
  }

  function handleReset(){
    try{["wagesave_venue","wagesave_actual","wagesave_feedback","wagesave_base_revenue","wagesave_csv_dismissed","wagesave_day_revenue","wagesave_local_events","wagesave_staff"].forEach(k=>localStorage.removeItem(k));}catch{}
    setVenue(null);
    setMode("home");
  }

  if(loading) return(
    <div style={{minHeight:"100vh",background:B.amberPale,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Logo size={48}/>
    </div>
  );

  // Returning user — go straight to app
  if(venue) return<MainApp venue={venue} onReset={handleReset}/>;

  // Analyse mode
  if(mode==="analyse") return(
    <RosterAnalyser
      onSetupVenue={()=>setMode("onboarding")}
      onBack={()=>setMode("home")}
    />
  );

  // Onboarding
  if(mode==="onboarding") return<Onboarding onComplete={handleComplete}/>;

  // Home — choose path
  return(
    <div style={{minHeight:"100vh",background:B.amberPale}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}.fade-up{animation:fadeUp 0.4s ease forwards;}`}</style>
      <div style={{maxWidth:440,margin:"0 auto",padding:"60px 24px 80px",textAlign:"center"}}>

        {/* Logo */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:32}}>
          <Logo size={56}/>
        </div>

        <p style={{fontSize:17,color:B.warmGrey,marginBottom:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          {new Date().getHours()<12?"Good morning.":new Date().getHours()<17?"Good afternoon.":"Good evening."}
        </p>
        <h1 style={{fontSize:36,fontWeight:700,letterSpacing:"-0.02em",color:B.nearBlack,marginBottom:16,lineHeight:1.15,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          It's time to<br/><span style={{color:B.amber}}>WageSave.</span>
        </h1>
        <p style={{fontSize:16,color:B.warmGrey,lineHeight:1.65,marginBottom:48,fontFamily:"system-ui,-apple-system,sans-serif"}}>
          Stop paying for staff<br/>you don't need.
        </p>

        {/* Two paths */}
        <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Primary — set up venue */}
          <button onClick={()=>setMode("onboarding")} style={{
            width:"100%",padding:"18px 0",background:B.amber,
            color:B.white,border:"none",borderRadius:14,
            fontSize:16,fontWeight:700,cursor:"pointer",
            fontFamily:"system-ui,-apple-system,sans-serif",
            boxShadow:`0 4px 16px rgba(232,160,32,0.3)`,
          }}>
            Set up my venue →
          </button>

          {/* Secondary — analyse roster */}
          <button onClick={()=>setMode("analyse")} style={{
            width:"100%",padding:"18px 0",background:B.white,
            color:B.nearBlack,border:`1.5px solid ${B.lightGrey}`,borderRadius:14,
            fontSize:16,fontWeight:600,cursor:"pointer",
            fontFamily:"system-ui,-apple-system,sans-serif",
            boxShadow:"0 2px 8px rgba(28,21,16,0.06)",
          }}>
            📸 Analyse my roster first
          </button>

          <p style={{fontSize:13,color:B.midGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            Free for 1 month · No credit card needed
          </p>
        </div>
      </div>
    </div>
  );
}
