import { useState, useEffect } from "react";

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
const SEASON_MULT_SUMMER = [1.45,1.40,1.15,1.0,0.85,0.75,0.70,0.72,0.80,0.95,1.15,1.40];
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

const DEMO_EVENTS = {
  "2026-04-17":[{icon:"🏉",label:"AFL Round 4",impact:"+20%",mult:1.20}],
  "2026-04-18":[{icon:"☀️",label:"Warm weekend",impact:"+12%",mult:1.12}],
  "2026-04-25":[{icon:"🎖",label:"Anzac Day",impact:"+30%",mult:1.30}],
  "2026-05-02":[{icon:"🏉",label:"AFL Round 7",impact:"+15%",mult:1.15}],
  "2026-05-09":[{icon:"🌧",label:"Rain forecast",impact:"-15%",mult:0.85}],
};

const DEFAULT_HOURS = {
  Mon:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Tue:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Wed:{open:false,openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
  Thu:{open:true, openTime:8, closeTime:15,hasDinner:true, dinnerOpen:17,dinnerClose:21},
  Fri:{open:true, openTime:8, closeTime:15,hasDinner:true, dinnerOpen:17,dinnerClose:22},
  Sat:{open:true, openTime:8, closeTime:22,hasDinner:false,dinnerOpen:17,dinnerClose:22},
  Sun:{open:true, openTime:8, closeTime:15,hasDinner:false,dinnerOpen:17,dinnerClose:21},
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

function calcDay(day, baseRev, hasKitchen, servesAlcohol, tradingHours, seasonality, weatherMult=1.0, eventMult=1.0, weekVar=1.0, date) {
  const h = tradingHours[day];
  if (!h || !h.open) return {adj:0,laborBudget:0,byHour:new Array(24).fill(0),roles:{roles:[],total:0,note:"Closed today"},shifts:[],closed:true};

  // Seasonal multiplier
  const month = date ? date.getMonth() : new Date().getMonth();
  const seasonMults = seasonality==="summer"?SEASON_MULT_SUMMER:seasonality==="winter"?SEASON_MULT_WINTER:SEASON_MULT_FLAT;
  const seasonMult = seasonMults[month];

  const adj = baseRev * DAY_MULT[day] * weatherMult * eventMult * weekVar * seasonMult;
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
  return {adj, laborBudget, byHour, roles, shifts, closed:false, seasonMult};
}

function weatherFromCode(code){
  if(code>=200&&code<600) return{mult:0.85,label:"🌧 Rain"};
  if(code>=600&&code<700) return{mult:0.80,label:"🌨 Snow"};
  if(code>=700&&code<800) return{mult:0.90,label:"🌫 Overcast"};
  if(code===800)          return{mult:1.15,label:"☀️ Clear"};
  if(code>800)            return{mult:1.00,label:"🌥 Cloudy"};
  return{mult:1.00,label:"🌥 Neutral"};
}

function greeting(){const h=new Date().getHours();return h<12?"Good morning.":h<17?"Good afternoon.":"Good evening.";}
function getWeekDates(offset=0){const now=new Date(),day=now.getDay(),mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1)+offset*7);return DAYS.map((_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});}
function dateKey(d){return d.toISOString().slice(0,10);}
function getHoliday(d){return VIC_HOLIDAYS[dateKey(d)]||null;}
function getEvents(d){return DEMO_EVENTS[dateKey(d)]||[];}

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

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const[step,setStep]=useState(0);
  const[data,setData]=useState({
    name:"",suburb:"",hasKitchen:null,servesAlcohol:null,
    seasonality:"flat",
    busyPeriods:[],bigDays:[],
    quietRevenue:1200,busyRevenue:4500,
    tradingHours:{...DEFAULT_HOURS},
  });

  const inputStyle={width:"100%",padding:"15px 16px",borderRadius:14,border:`1.5px solid ${B.midGrey}`,fontSize:16,fontFamily:"system-ui,-apple-system,sans-serif",color:B.nearBlack,background:B.white,outline:"none",boxSizing:"border-box",transition:"border-color 0.15s"};
  function updateHours(day,key,val){setData(d=>({...d,tradingHours:{...d.tradingHours,[day]:{...d.tradingHours[day],[key]:val}}}));}
  function finish(){onComplete({...data,baseRevenue:Math.round((data.quietRevenue+data.busyRevenue)/2)});}

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

    // 5: Revenue
    <div key={5}>
      <p style={{fontSize:13,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>5 of 5</p>
      <h2 style={{fontSize:28,fontWeight:700,color:B.nearBlack,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2,fontFamily:"system-ui,-apple-system,sans-serif"}}>What does a typical<br/>day look like?</h2>
      <p style={{fontSize:15,color:B.warmGrey,marginBottom:32,lineHeight:1.5,fontFamily:"system-ui,-apple-system,sans-serif"}}>Your baseline for an average day. WageSave adjusts for day of week, weather, events and season.</p>
      <div style={{marginBottom:28}}>
        <Label text="A quiet day"/>
        <div style={{marginTop:12,marginBottom:12}}><Stepper value={data.quietRevenue} onChange={v=>setData(d=>({...d,quietRevenue:v}))} min={200} max={8000} step={100} prefix="$"/></div>
        <input type="range" min={200} max={8000} step={100} value={data.quietRevenue} onChange={e=>setData(d=>({...d,quietRevenue:Number(e.target.value)}))} style={{width:"100%",accentColor:B.amber}}/>
        <p style={{fontSize:12,color:B.warmGrey,marginTop:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>{calcRoles(data.quietRevenue,data.hasKitchen,data.servesAlcohol).note}</p>
      </div>
      <div style={{marginBottom:28}}>
        <Label text="A busy day"/>
        <div style={{marginTop:12,marginBottom:12}}><Stepper value={data.busyRevenue} onChange={v=>setData(d=>({...d,busyRevenue:v}))} min={1000} max={20000} step={100} prefix="$"/></div>
        <input type="range" min={1000} max={20000} step={100} value={data.busyRevenue} onChange={e=>setData(d=>({...d,busyRevenue:Number(e.target.value)}))} style={{width:"100%",accentColor:B.amber}}/>
        <p style={{fontSize:12,color:B.warmGrey,marginTop:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>{calcRoles(data.busyRevenue,data.hasKitchen,data.servesAlcohol).note}</p>
      </div>
      <div style={{background:B.amberPale,borderRadius:16,padding:18,border:`1.5px dashed ${B.midGrey}`,marginBottom:28}}>
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
function DayDrawer({dayData,onActualChange,actual,feedback,onFeedback,onClose,venueName}){
  const{day,date,roles,adj,laborBudget,byHour,shifts,closed}=dayData;
  const holiday=getHoliday(date);
  const events=getEvents(date);
  const flags=[...events];
  if(holiday) flags.unshift({icon:"🎉",label:holiday,impact:"+25%"});
  const diff=actual>0?actual-roles.total:0;
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
              <p style={{fontSize:56,fontWeight:700,color:B.amber,lineHeight:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>{roles.total}<span style={{fontSize:18,color:B.warmGrey,fontWeight:400,marginLeft:8}}>staff needed</span></p>
              <p style={{fontSize:13,color:B.warmGrey,marginTop:4,marginBottom:20,fontFamily:"system-ui,-apple-system,sans-serif"}}>{roles.note}</p>

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

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function MainApp({venue}){
  const[weekOffset,setWeekOffset]=useState(0);
  const[selectedDay,setSelectedDay]=useState(null);
  const[actual,setActual]=useState({});
  const[feedback,setFeedback]=useState({});
  const[weather,setWeather]=useState(null);
  const[showSettings,setShowSettings]=useState(false);
  const[showCsvNudge,setShowCsvNudge]=useState(true);
  const[baseRevenue,setBaseRevenue]=useState(venue.baseRevenue||2500);

  useEffect(()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos=>{
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=8c9686f901d9e2180d4328a24d2da88f&units=metric`)
        .then(r=>r.json()).then(d=>{if(d.cod!==200)return;setWeather({...weatherFromCode(d.weather[0].id),temp:Math.round(d.main.temp),city:d.name});}).catch(()=>{});
    },()=>{},{timeout:8000});
  },[]);

  const weatherMult=weather?weather.mult:1.0;
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
    const events=getEvents(date);
    const holiday=getHoliday(date);
    const flags=[...events];
    if(holiday) flags.unshift({icon:"🎉",label:holiday,impact:"+25%",mult:1.25});
    const eventMult=flags.reduce((acc,f)=>{const p=parseFloat((f.impact||"0").replace("%",""))/100;return acc*(1+p);},1.0);
    const dayData=calcDay(day,baseRevenue,venue.hasKitchen,venue.servesAlcohol,venue.tradingHours,venue.seasonality,weatherMult,eventMult,weekVar,date);
    return{day,date,flags,...dayData};
  });

  const openDays=weekData.filter(d=>!d.closed);
  const totalRev=openDays.reduce((a,d)=>a+d.adj,0);
  const totalStaff=openDays.reduce((a,d)=>a+d.roles.total,0);
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
            <p style={{fontSize:11,color:B.warmGrey,marginTop:2,fontFamily:"system-ui,-apple-system,sans-serif"}}>{venue.name} · {venue.suburb}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {weather&&<div style={{textAlign:"right"}}><p style={{fontSize:13,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weather.label}</p><p style={{fontSize:11,color:B.warmGrey,fontFamily:"system-ui,-apple-system,sans-serif"}}>{weather.temp}°C</p></div>}
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
            <button onClick={()=>setShowCsvNudge(false)} style={{fontSize:18,color:B.warmGrey,background:"none",border:"none",cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
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

        {/* Greeting */}
        <div style={{marginBottom:20}}>
          <p style={{fontSize:15,color:B.warmGrey,marginBottom:4,fontFamily:"system-ui,-apple-system,sans-serif"}}>{greeting()}</p>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.2,color:B.nearBlack,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            It's time to WageSave<br/><span style={{color:B.amber}}>at {venue.name}.</span>
          </h1>
        </div>

        {/* Settings */}
        {showSettings&&(
          <div style={{background:B.white,borderRadius:20,padding:20,marginBottom:20,boxShadow:"0 2px 16px rgba(28,21,16,0.07)"}}>
            <Label text="Baseline daily revenue"/>
            <div style={{marginTop:10,marginBottom:10}}><Stepper value={baseRevenue} onChange={setBaseRevenue} min={200} max={15000} step={100} prefix="$"/></div>
            <input type="range" min={200} max={15000} step={100} value={baseRevenue} onChange={e=>setBaseRevenue(Number(e.target.value))} style={{width:"100%"}}/>
            <p style={{fontSize:12,color:B.warmGrey,marginTop:8,fontFamily:"system-ui,-apple-system,sans-serif"}}>{calcRoles(baseRevenue,venue.hasKitchen,venue.servesAlcohol).note}</p>
          </div>
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
          {weekData.map(({day,date,roles,adj,flags,byHour,closed},idx)=>{
            const dateN=new Date(date); dateN.setHours(0,0,0,0);
            const isToday=dateN.getTime()===today.getTime();
            const isPast=dateN<today;
            const act=actual[day]||0;
            const diff=act>0?act-roles.total:0;
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
                    <p style={{fontSize:40,fontWeight:700,color:B.amber,lineHeight:1,fontFamily:"system-ui,-apple-system,sans-serif"}}>{roles.total}</p>
                    <p style={{fontSize:11,color:B.warmGrey,marginTop:2,marginBottom:6,fontFamily:"system-ui,-apple-system,sans-serif"}}>staff needed</p>
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

        <p style={{fontSize:11,color:B.midGrey,textAlign:"center",marginTop:24,fontFamily:"system-ui,-apple-system,sans-serif"}}>Tap any day for details · {venue.suburb}</p>
      </div>

      {/* Drawer */}
      {selectedDay!==null&&selectedData&&(
        <DayDrawer
          key={selectedDay}
          dayData={selectedData}
          venueName={venue.name}
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

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function WageSave(){
  const[venue,setVenue]=useState(null);
  if(!venue) return<Onboarding onComplete={setVenue}/>;
  return<MainApp venue={venue}/>;
}
