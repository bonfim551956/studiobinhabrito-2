import { useState, useEffect, useMemo } from "react";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  updateDoc, query, orderBy, serverTimestamp, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (v) => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtD  = (iso) => { if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const todayISO = () => new Date().toISOString().slice(0,10);
const weekStart = (iso) => {
  const d=new Date(iso+"T12:00:00"); const day=d.getDay();
  d.setDate(d.getDate()+(day===0?-6:1-day)); return d.toISOString().slice(0,10);
};
const weekEnd = (iso) => {
  const d=new Date(weekStart(iso)+"T12:00:00"); d.setDate(d.getDate()+6); return d.toISOString().slice(0,10);
};
const isoMonth = (iso) => iso?.slice(0,7);
const monthName = (ym) => {
  if(!ym) return "";
  const [y,m] = ym.split("-");
  return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
};

const DEFAULT_SERVICES = [
  {id:"s1",name:"Design de Sobrancelha",price:80},
  {id:"s2",name:"Micropigmentação",price:350},
  {id:"s3",name:"Henna",price:60},
  {id:"s4",name:"Laminação",price:120},
  {id:"s5",name:"Brow Lifting",price:150},
  {id:"s6",name:"Remoção",price:200},
  {id:"s7",name:"Retoque",price:60},
];
const EXPENSE_CATS = ["Material/Insumos","Aluguel","Energia/Água","Marketing","Equipamentos","Curso/Treinamento","Outros"];
const PAYMENTS     = ["Pix","Dinheiro","Cartão Débito","Cartão Crédito"];
const STATUS_C     = {confirmado:"#10b981",pendente:"#f59e0b",cancelado:"#ef4444",concluído:"#6366f1"};

// ─── Theme ────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#05020e", sidebar:"#070316", sidebarBorder:"#130926",
  card:"#0c0818", cardBorder:"#160d2a", input:"#080412", inputBorder:"#281840",
  text:"#e8d8ff", textMuted:"#6a4a90", textSub:"#4a3465",
  accent:"#a855f7", accentGrad:"linear-gradient(135deg,#7c3aed,#a855f7)",
  navActive:"linear-gradient(135deg,#6d28d9,#9d4ec4)",
  navActiveText:"#fff", navText:"#6a4a90",
  rowBorder:"#0e0620", theadColor:"#4a3465",
  green:"#10b981", red:"#f87171", yellow:"#f59e0b", blue:"#818cf8",
  scrollThumb:"#2d1f42",
};
const LIGHT = {
  bg:"#f5f3ff", sidebar:"#ffffff", sidebarBorder:"#e5e7eb",
  card:"#ffffff", cardBorder:"#e5e7eb", input:"#f9fafb", inputBorder:"#d1d5db",
  text:"#1f1235", textMuted:"#7c3aed", textSub:"#6b7280",
  accent:"#7c3aed", accentGrad:"linear-gradient(135deg,#7c3aed,#a855f7)",
  navActive:"linear-gradient(135deg,#7c3aed,#a855f7)",
  navActiveText:"#fff", navText:"#9ca3af",
  rowBorder:"#f3f4f6", theadColor:"#9ca3af",
  green:"#059669", red:"#dc2626", yellow:"#d97706", blue:"#4f46e5",
  scrollThumb:"#d1d5db",
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic={
  dash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  entry:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  exit:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  report:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-8"/></svg>,
  cal:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  config:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  plus:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>,
  trash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  close:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  sun:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  edit:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  prev:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>,
  next:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>,
};

function Field({label,children,T}){
  return <div style={{marginBottom:"1rem"}}><label style={{display:"block",fontSize:".68rem",color:T.textMuted,marginBottom:"4px",letterSpacing:".06em",textTransform:"uppercase"}}>{label}</label>{children}</div>;
}

function Modal({title,onClose,children,T}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"18px",width:"100%",maxWidth:"500px",padding:"1.75rem",boxShadow:"0 40px 100px rgba(0,0,0,.4)",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <h3 style={{margin:0,fontSize:"1rem",fontFamily:"'Playfair Display',serif",color:T.text}}>{title}</h3>
          <button onClick={onClose} style={{background:T.input,border:"none",borderRadius:"8px",padding:"5px",cursor:"pointer",color:T.textMuted,display:"flex"}}>{Ic.close}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spinner({T}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"200px",flexDirection:"column",gap:"1rem"}}>
      <div style={{width:"32px",height:"32px",border:`3px solid ${T.cardBorder}`,borderTop:`3px solid ${T.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <span style={{color:T.textMuted,fontSize:".83rem"}}>Conectando ao banco de dados...</span>
    </div>
  );
}

// ─── Month navigator ──────────────────────────────────────────────────────────
function MonthNav({value, onChange, T}){
  const IS = {background:T.input,border:`1px solid ${T.inputBorder}`,borderRadius:"10px",padding:"7px 12px",color:T.text,fontSize:".875rem",outline:"none",fontFamily:"'DM Sans',sans-serif"};
  const prev = () => {
    const [y,m] = value.split("-").map(Number);
    const d = new Date(y,m-2,1);
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };
  const next = () => {
    const [y,m] = value.split("-").map(Number);
    const d = new Date(y,m,1);
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };
  return(
    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
      <button onClick={prev} style={{...IS,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}>{Ic.prev}</button>
      <input type="month" value={value} onChange={e=>onChange(e.target.value)}
        style={{...IS,width:"160px",textAlign:"center"}}/>
      <button onClick={next} style={{...IS,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}>{Ic.next}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StudioManager(){
  const [theme,setTheme]       = useState(()=>localStorage.getItem("sbTheme")||"dark");
  const T = theme==="dark" ? DARK : LIGHT;

  const [tab,setTab]           = useState("dashboard");
  const [entries,setEntries]   = useState([]);
  const [expenses,setExpenses] = useState([]);
  const [appts,setAppts]       = useState([]);
  const [services,setServices] = useState(DEFAULT_SERVICES);
  const [loading,setLoading]   = useState(true);
  const [dbOk,setDbOk]         = useState(false);
  const [saving,setSaving]     = useState(false);

  // modals
  const [mE,setME]   = useState(false);
  const [mX,setMX]   = useState(false);
  const [mA,setMA]   = useState(false);
  const [mSvc,setMSvc] = useState(false);
  const [editSvc,setEditSvc] = useState(null); // {id,name,price} or null=new

  // forms
  const EF0 = {date:todayISO(),client:"",service:services[0]?.name||"",value:"",payment:PAYMENTS[0],notes:""};
  const XF0 = {date:todayISO(),description:"",category:EXPENSE_CATS[0],value:"",payment:PAYMENTS[0],notes:""};
  const AF0 = {date:todayISO(),time:"09:00",client:"",service:services[0]?.name||"",status:"confirmado"};
  const [ef,setEf] = useState(EF0);
  const [xf,setXf] = useState(XF0);
  const [af,setAf] = useState(AF0);
  const [svcForm,setSvcForm] = useState({name:"",price:""});

  // filters
  const [reportMonth,setReportMonth] = useState(todayISO().slice(0,7));
  const [agDate,setAgDate]           = useState(todayISO());
  const [agView,setAgView]           = useState("day");
  const [agMonth,setAgMonth]         = useState(todayISO().slice(0,7));

  // theme persist
  useEffect(()=>{ localStorage.setItem("sbTheme",theme); },[theme]);

  // ── Firebase listeners ────────────────────────────────────────────────────
  useEffect(()=>{
    let n=0; const done=()=>{ n++; if(n>=4){setLoading(false);setDbOk(true);} };

    const unsubE = onSnapshot(query(collection(db,"entries"),orderBy("createdAt","desc")),
      s=>{setEntries(s.docs.map(d=>({id:d.id,...d.data()})));done();},
      ()=>{setLoading(false);setDbOk(false);});

    const unsubX = onSnapshot(query(collection(db,"expenses"),orderBy("createdAt","desc")),
      s=>{setExpenses(s.docs.map(d=>({id:d.id,...d.data()})));done();},
      ()=>{setLoading(false);setDbOk(false);});

    const unsubA = onSnapshot(query(collection(db,"appointments"),orderBy("date","asc")),
      s=>{setAppts(s.docs.map(d=>({id:d.id,...d.data()})));done();},
      ()=>{setLoading(false);setDbOk(false);});

    const unsubS = onSnapshot(doc(db,"config","services"),
      d=>{ if(d.exists()) setServices(d.data().list||DEFAULT_SERVICES); done(); },
      ()=>{ done(); });

    return()=>{unsubE();unsubX();unsubA();unsubS();};
  },[]);

  // ── CRUD entries/expenses/appts ───────────────────────────────────────────
  const saveEntry = async()=>{
    if(!ef.client||!ef.value)return; setSaving(true);
    await addDoc(collection(db,"entries"),{...ef,value:parseFloat(ef.value),createdAt:serverTimestamp()});
    setSaving(false);setEf(EF0);setME(false);
  };
  const saveExpense = async()=>{
    if(!xf.description||!xf.value)return; setSaving(true);
    await addDoc(collection(db,"expenses"),{...xf,value:parseFloat(xf.value),createdAt:serverTimestamp()});
    setSaving(false);setXf(XF0);setMX(false);
  };
  const saveAppt = async()=>{
    if(!af.client)return; setSaving(true);
    await addDoc(collection(db,"appointments"),{...af,createdAt:serverTimestamp()});
    setSaving(false);setAf(AF0);setMA(false);
  };
  const delEntry   = id=>deleteDoc(doc(db,"entries",id));
  const delExpense = id=>deleteDoc(doc(db,"expenses",id));
  const delAppt    = id=>deleteDoc(doc(db,"appointments",id));
  const updateApptStatus = (id,status)=>updateDoc(doc(db,"appointments",id),{status});

  // ── CRUD services ──────────────────────────────────────────────────────────
  const saveServices = async(list)=>{
    await setDoc(doc(db,"config","services"),{list});
    setServices(list);
  };
  const openNewSvc = ()=>{ setSvcForm({name:"",price:""}); setEditSvc(null); setMSvc(true); };
  const openEditSvc = (s)=>{ setSvcForm({name:s.name,price:String(s.price)}); setEditSvc(s); setMSvc(true); };
  const confirmSvc = async()=>{
    if(!svcForm.name||!svcForm.price)return;
    let list;
    if(editSvc){
      list=services.map(s=>s.id===editSvc.id?{...s,name:svcForm.name,price:parseFloat(svcForm.price)}:s);
    } else {
      list=[...services,{id:"s"+Date.now(),name:svcForm.name,price:parseFloat(svcForm.price)}];
    }
    await saveServices(list); setMSvc(false);
  };
  const deleteSvc = async(id)=>{
    const list=services.filter(s=>s.id!==id);
    await saveServices(list);
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const T_today = todayISO();
  const curMon  = T_today.slice(0,7);
  const monE    = entries.filter(e=>isoMonth(e.date)===curMon);
  const monX    = expenses.filter(e=>isoMonth(e.date)===curMon);
  const kDay    = entries.filter(e=>e.date===T_today).reduce((s,e)=>s+e.value,0);
  const kMon    = monE.reduce((s,e)=>s+e.value,0);
  const kMonX   = monX.reduce((s,e)=>s+e.value,0);

  // ── Report (filtered by reportMonth) ──────────────────────────────────────
  const rE   = entries.filter(e=>isoMonth(e.date)===reportMonth);
  const rX   = expenses.filter(e=>isoMonth(e.date)===reportMonth);
  const rIn  = rE.reduce((s,e)=>s+e.value,0);
  const rOut = rX.reduce((s,e)=>s+e.value,0);
  const rRes = rIn-rOut;

  // weekly breakdown inside report month
  const weeklyBreak = useMemo(()=>{
    const map={};
    [...rE.map(e=>({...e,type:"in"})),...rX.map(e=>({...e,type:"out"}))].forEach(e=>{
      const ws=weekStart(e.date);
      if(!map[ws])map[ws]={ws,we:weekEnd(e.date),in:0,out:0};
      if(e.type==="in")map[ws].in+=e.value;else map[ws].out+=e.value;
    });
    return Object.values(map).sort((a,b)=>a.ws.localeCompare(b.ws));
  },[rE,rX]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const last7 = useMemo(()=>{
    return Array.from({length:7},(_,i)=>{
      const d=new Date(T_today+"T12:00:00");d.setDate(d.getDate()-(6-i));
      const iso=d.toISOString().slice(0,10);
      return{iso,l:d.toLocaleDateString("pt-BR",{weekday:"short"}).slice(0,3),
        inc:entries.filter(e=>e.date===iso).reduce((s,e)=>s+e.value,0),
        exp:expenses.filter(e=>e.date===iso).reduce((s,e)=>s+e.value,0)};
    });
  },[entries,expenses]);

  const svcBreak = useMemo(()=>{
    const m={};monE.forEach(e=>{m[e.service]=(m[e.service]||0)+e.value;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[monE]);

  const catBreak = useMemo(()=>{
    const m={};monX.forEach(e=>{m[e.category]=(m[e.category]||0)+e.value;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[monX]);

  const filteredA = useMemo(()=>{
    let list;
    if(agView==="day")   list=appts.filter(a=>a.date===agDate);
    else if(agView==="week") list=appts.filter(a=>weekStart(a.date)===weekStart(agDate));
    else                 list=appts.filter(a=>isoMonth(a.date)===agMonth);
    return list.sort((a,b)=>a.date.localeCompare(b.date)||a.time?.localeCompare(b.time));
  },[appts,agView,agDate,agMonth]);

  // ── Style helpers ──────────────────────────────────────────────────────────
  const IS  = {width:"100%",background:T.input,border:`1px solid ${T.inputBorder}`,borderRadius:"10px",padding:"9px 13px",color:T.text,fontSize:".875rem",outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"};
  const BT  = (v="p")=>({display:"inline-flex",alignItems:"center",gap:"6px",padding:"8px 15px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:".82rem",fontWeight:600,fontFamily:"'DM Sans',sans-serif",
    ...(v==="p"?{background:T.accentGrad,color:"#fff"}:
        v==="r"?{background:theme==="dark"?"#200814":"#fff1f2",color:T.red,border:`1px solid ${T.red}40`}:
                {background:T.input,color:T.textMuted,border:`1px solid ${T.inputBorder}`})});
  const CARD = {background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:"14px",padding:"1.25rem"};
  const TH   = {fontSize:".68rem",color:T.theadColor,textTransform:"uppercase",letterSpacing:".07em"};

  const TABS=[
    {id:"dashboard",l:"Dashboard",i:Ic.dash},
    {id:"entries",  l:"Entradas",  i:Ic.entry},
    {id:"expenses", l:"Saídas",    i:Ic.exit},
    {id:"report",   l:"Relatório", i:Ic.report},
    {id:"agenda",   l:"Agenda",    i:Ic.cal},
    {id:"config",   l:"Configurações",i:Ic.config},
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text,display:"flex",transition:"background .3s,color .3s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{font-family:'DM Sans',sans-serif;}
        button{transition:opacity .15s}button:hover{opacity:.82}
        input:focus,select:focus,textarea:focus{border-color:#7c3aed!important;outline:none}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        input[type="month"]::-webkit-calendar-picker-indicator{filter:${theme==="dark"?"invert(1)":"none"};cursor:pointer}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:${theme==="dark"?"invert(1)":"none"};cursor:pointer}
        option{background:${T.card};color:${T.text}}
        select{color:${T.text}}
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{width:"200px",minHeight:"100vh",background:T.sidebar,borderRight:`1px solid ${T.sidebarBorder}`,display:"flex",flexDirection:"column",padding:"1.5rem .875rem",flexShrink:0,transition:"background .3s"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",color:T.accent,lineHeight:1.25,marginBottom:".2rem"}}>Studio<br/>Binha Brito</div>
        <div style={{fontSize:".6rem",color:T.textSub,letterSpacing:".12em",textTransform:"uppercase",marginBottom:"1.75rem"}}>Gestão</div>

        {TABS.map(t=>{
          const a=tab===t.id;
          return <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 12px",borderRadius:"10px",border:"none",cursor:"pointer",width:"100%",fontSize:".82rem",fontFamily:"'DM Sans',sans-serif",marginBottom:"2px",background:a?T.navActive:"transparent",color:a?T.navActiveText:T.navText,fontWeight:a?600:400,transition:"all .2s"}}>{t.i}{t.l}</button>;
        })}

        <div style={{marginTop:"auto",borderTop:`1px solid ${T.sidebarBorder}`,paddingTop:".875rem"}}>
          {/* Theme toggle */}
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}
            style={{...BT("g"),width:"100%",justifyContent:"center",fontSize:".75rem",marginBottom:"10px"}}>
            {theme==="dark"?Ic.sun:Ic.moon}
            {theme==="dark"?"Modo Claro":"Modo Escuro"}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:".7rem",color:dbOk?T.green:T.yellow}}>
            <div style={{width:"6px",height:"6px",borderRadius:"50%",background:dbOk?T.green:T.yellow,animation:dbOk?"":"pulse 1.5s infinite"}}/>
            {dbOk?"Firebase OK":"Configurar Firebase"}
          </div>
          {saving&&<div style={{fontSize:".68rem",color:T.accent,marginTop:"4px",display:"flex",alignItems:"center",gap:"4px"}}><div style={{width:"8px",height:"8px",border:`1.5px solid ${T.accent}`,borderTop:"1.5px solid transparent",borderRadius:"50%",animation:"spin .6s linear infinite"}}/> Salvando...</div>}
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{flex:1,padding:"1.75rem 2rem",overflowY:"auto",transition:"background .3s"}}>
        {loading?<Spinner T={T}/>:<>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.75rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Dashboard</h1>
            <span style={{fontSize:".8rem",color:T.textSub}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
            {[
              {l:"Hoje – Entradas",v:fmt(kDay),c:T.accent},
              {l:"Mês – Entradas",v:fmt(kMon),c:T.blue},
              {l:"Mês – Saídas",v:fmt(kMonX),c:T.red},
              {l:"Resultado Mês",v:fmt(kMon-kMonX),c:kMon-kMonX>=0?T.green:T.red},
            ].map(k=>(
              <div key={k.l} style={CARD}>
                <div style={{fontSize:"1.3rem",fontFamily:"'Playfair Display',serif",fontWeight:700,color:k.c}}>{k.v}</div>
                <div style={{fontSize:".68rem",color:T.textSub,textTransform:"uppercase",letterSpacing:".05em",marginTop:"4px"}}>{k.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:"1.25rem",marginBottom:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimos 7 dias</div>
              {(()=>{const maxV=Math.max(...last7.map(d=>Math.max(d.inc,d.exp)),1);return(
                <div>
                  <div style={{display:"flex",gap:"8px",alignItems:"flex-end",height:"90px"}}>
                    {last7.map((d,i)=>(
                      <div key={i} style={{flex:1,display:"flex",gap:"2px",alignItems:"flex-end"}}>
                        <div style={{flex:1,borderRadius:"3px 3px 0 0",height:`${(d.inc/maxV)*82}px`,minHeight:d.inc>0?3:0,background:"linear-gradient(to top,#7c3aed,#c084fc)"}}/>
                        <div style={{flex:1,borderRadius:"3px 3px 0 0",height:`${(d.exp/maxV)*82}px`,minHeight:d.exp>0?3:0,background:"linear-gradient(to top,#be123c,#fb7185)"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:"8px",marginTop:"5px"}}>{last7.map((d,i)=><div key={i} style={{flex:1,fontSize:".6rem",color:T.textSub,textAlign:"center"}}>{d.l}</div>)}</div>
                  <div style={{display:"flex",gap:"14px",marginTop:"8px",fontSize:".7rem"}}><span style={{color:"#c084fc"}}>■ Entradas</span><span style={{color:"#fb7185"}}>■ Saídas</span></div>
                </div>
              );})()}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Serviços do Mês</div>
              {svcBreak.length===0&&<div style={{color:T.textSub,fontSize:".82rem"}}>Sem dados</div>}
              {svcBreak.map(([s,v])=>{const p=kMon>0?Math.round(v/kMon*100):0;return(
                <div key={s} style={{marginBottom:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",marginBottom:"3px"}}><span style={{color:T.text}}>{s}</span><span style={{color:T.accent,fontWeight:600}}>{p}%</span></div>
                  <div style={{height:"4px",borderRadius:"2px",background:T.cardBorder}}><div style={{height:"100%",borderRadius:"2px",width:`${p}%`,background:T.accentGrad}}/></div>
                </div>
              );})}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimas Entradas</div>
              {entries.length===0&&<div style={{color:T.textSub,fontSize:".82rem"}}>Sem entradas</div>}
              {entries.slice(0,6).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".8rem"}}>
                  <span style={{color:T.text}}>{e.client} <span style={{color:T.textSub}}>·</span> <span style={{color:T.textSub}}>{e.service}</span></span>
                  <span style={{color:T.accent,fontWeight:700}}>{fmt(e.value)}</span>
                </div>
              ))}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimas Saídas</div>
              {expenses.length===0&&<div style={{color:T.textSub,fontSize:".82rem"}}>Sem saídas</div>}
              {expenses.slice(0,6).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".8rem"}}>
                  <span style={{color:T.text}}>{e.description} <span style={{color:T.textSub}}>·</span> <span style={{color:T.textSub}}>{e.category}</span></span>
                  <span style={{color:T.red,fontWeight:700}}>{fmt(e.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ══ ENTRADAS ══ */}
        {tab==="entries"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Entradas</h1>
            <button style={BT()} onClick={()=>{setEf({...EF0,service:services[0]?.name||""});setME(true);}}>{Ic.plus} Nova Entrada</button>
          </div>
          <div style={{display:"flex",gap:"1rem",marginBottom:"1.5rem"}}>
            {[{l:"Hoje",v:fmt(kDay),c:T.accent},{l:"Mês",v:fmt(kMon),c:T.blue},{l:"Qtd. Mês",v:monE.length,c:"#ec4899"}].map(k=>(
              <div key={k.l} style={{...CARD,flex:1,padding:"1rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:k.c}}>{k.v}</div><div style={{fontSize:".68rem",color:T.textSub,textTransform:"uppercase",marginTop:"3px"}}>{k.l}</div></div>
            ))}
          </div>
          <div style={CARD}>
            <div style={{display:"grid",gridTemplateColumns:"95px 1fr 1.1fr 90px 110px 32px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Data","Cliente","Serviço","Valor","Pgto",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {entries.length===0&&<div style={{color:T.textSub,padding:"1rem",fontSize:".82rem"}}>Nenhuma entrada lançada.</div>}
            {entries.map(e=>(
              <div key={e.id} style={{display:"grid",gridTemplateColumns:"95px 1fr 1.1fr 90px 110px 32px",gap:"12px",padding:"9px 12px",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".82rem",alignItems:"center"}}>
                <span style={{color:T.textSub}}>{fmtD(e.date)}</span>
                <span style={{fontWeight:600,color:T.text}}>{e.client}</span>
                <span style={{color:T.textMuted}}>{e.service}</span>
                <span style={{color:T.accent,fontWeight:700}}>{fmt(e.value)}</span>
                <span style={{fontSize:".72rem",color:T.green,background:T.green+"18",padding:"2px 8px",borderRadius:"20px",textAlign:"center"}}>{e.payment}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,display:"flex"}} onClick={()=>delEntry(e.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>}

        {/* ══ SAÍDAS ══ */}
        {tab==="expenses"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Saídas</h1>
            <button style={BT()} onClick={()=>{setXf(XF0);setMX(true);}}>{Ic.plus} Nova Saída</button>
          </div>
          <div style={{display:"flex",gap:"1rem",marginBottom:"1.5rem"}}>
            {[
              {l:"Hoje",v:fmt(expenses.filter(e=>e.date===T_today).reduce((s,e)=>s+e.value,0)),c:T.red},
              {l:"Mês",v:fmt(kMonX),c:"#ef4444"},
              {l:"Qtd. Mês",v:monX.length,c:T.yellow},
            ].map(k=>(
              <div key={k.l} style={{...CARD,flex:1,padding:"1rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:k.c}}>{k.v}</div><div style={{fontSize:".68rem",color:T.textSub,textTransform:"uppercase",marginTop:"3px"}}>{k.l}</div></div>
            ))}
          </div>
          {catBreak.length>0&&(
            <div style={{...CARD,marginBottom:"1.25rem"}}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Por Categoria – Mês</div>
              <div style={{display:"flex",gap:".75rem",flexWrap:"wrap"}}>
                {catBreak.map(([c,v])=>(
                  <div key={c} style={{background:T.input,border:`1px solid ${T.cardBorder}`,borderRadius:"10px",padding:"8px 14px"}}>
                    <div style={{color:T.red,fontWeight:700,fontSize:".9rem"}}>{fmt(v)}</div>
                    <div style={{color:T.textSub,fontSize:".72rem",marginTop:"2px"}}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={CARD}>
            <div style={{display:"grid",gridTemplateColumns:"95px 1.2fr 1fr 90px 110px 32px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Data","Descrição","Categoria","Valor","Pgto",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {expenses.length===0&&<div style={{color:T.textSub,padding:"1rem",fontSize:".82rem"}}>Nenhuma saída lançada.</div>}
            {expenses.map(e=>(
              <div key={e.id} style={{display:"grid",gridTemplateColumns:"95px 1.2fr 1fr 90px 110px 32px",gap:"12px",padding:"9px 12px",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".82rem",alignItems:"center"}}>
                <span style={{color:T.textSub}}>{fmtD(e.date)}</span>
                <span style={{fontWeight:600,color:T.text}}>{e.description}</span>
                <span style={{color:T.textMuted}}>{e.category}</span>
                <span style={{color:T.red,fontWeight:700}}>{fmt(e.value)}</span>
                <span style={{fontSize:".72rem",color:T.yellow,background:T.yellow+"18",padding:"2px 8px",borderRadius:"20px",textAlign:"center"}}>{e.payment}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,display:"flex"}} onClick={()=>delExpense(e.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>}

        {/* ══ RELATÓRIO ══ */}
        {tab==="report"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem",flexWrap:"wrap",gap:"1rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Relatório</h1>
            <MonthNav value={reportMonth} onChange={setReportMonth} T={T}/>
          </div>
          <div style={{fontSize:".85rem",color:T.textSub,marginBottom:"1.5rem"}}>
            Período: <span style={{color:T.text,fontWeight:600}}>{monthName(reportMonth)}</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
            <div style={{...CARD,borderColor:T.accent+"40"}}>
              <div style={{fontSize:".68rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Entradas</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:T.accent,fontWeight:700}}>{fmt(rIn)}</div>
              <div style={{fontSize:".72rem",color:T.textSub,marginTop:"4px"}}>{rE.length} lançamento(s)</div>
            </div>
            <div style={{...CARD,borderColor:T.red+"40"}}>
              <div style={{fontSize:".68rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Saídas</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:T.red,fontWeight:700}}>{fmt(rOut)}</div>
              <div style={{fontSize:".72rem",color:T.textSub,marginTop:"4px"}}>{rX.length} lançamento(s)</div>
            </div>
            <div style={{...CARD,borderColor:(rRes>=0?T.green:T.red)+"40"}}>
              <div style={{fontSize:".68rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Resultado Líquido</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:rRes>=0?T.green:T.red,fontWeight:700}}>{fmt(rRes)}</div>
              <div style={{fontSize:".72rem",color:rRes>=0?T.green:T.red,marginTop:"4px"}}>{rRes>=0?"✓ Positivo":"✗ Negativo"}</div>
            </div>
          </div>

          {(rIn>0||rOut>0)&&(()=>{
            const total=rIn+rOut||1;const pIn=Math.round(rIn/total*100);
            return(
              <div style={{...CARD,marginBottom:"1.5rem"}}>
                <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Proporção Entradas × Saídas</div>
                <div style={{height:"12px",borderRadius:"6px",overflow:"hidden",display:"flex"}}>
                  <div style={{width:`${pIn}%`,background:T.accentGrad,transition:"width .5s"}}/>
                  <div style={{flex:1,background:"linear-gradient(90deg,#be123c,#fb7185)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px",fontSize:".75rem"}}>
                  <span style={{color:T.accent}}>Entradas {pIn}%</span>
                  <span style={{color:T.red}}>Saídas {100-pIn}%</span>
                </div>
              </div>
            );
          })()}

          {weeklyBreak.length>0&&(
            <div style={{...CARD,marginBottom:"1.5rem"}}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Resumo por Semana</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 110px 110px 110px",gap:"10px",padding:"4px 10px",marginBottom:"4px"}}>
                {["Semana","Entradas","Saídas","Resultado"].map((h,i)=><span key={i} style={TH}>{h}</span>)}
              </div>
              {weeklyBreak.map(w=>(
                <div key={w.ws} style={{display:"grid",gridTemplateColumns:"1fr 110px 110px 110px",gap:"10px",padding:"8px 10px",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".8rem",alignItems:"center"}}>
                  <span style={{color:T.textSub}}>{fmtD(w.ws)} – {fmtD(w.we)}</span>
                  <span style={{color:T.accent,fontWeight:600}}>{fmt(w.in)}</span>
                  <span style={{color:T.red,fontWeight:600}}>{fmt(w.out)}</span>
                  <span style={{color:w.in-w.out>=0?T.green:T.red,fontWeight:700}}>{fmt(w.in-w.out)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Entradas do Mês</div>
              {rE.length===0&&<div style={{color:T.textSub,fontSize:".82rem"}}>Sem entradas</div>}
              {rE.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".78rem"}}><div><div style={{color:T.text}}>{e.client}</div><div style={{color:T.textSub,fontSize:".7rem"}}>{fmtD(e.date)} · {e.service}</div></div><span style={{color:T.accent,fontWeight:700}}>{fmt(e.value)}</span></div>))}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:T.textMuted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Saídas do Mês</div>
              {rX.length===0&&<div style={{color:T.textSub,fontSize:".82rem"}}>Sem saídas</div>}
              {rX.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".78rem"}}><div><div style={{color:T.text}}>{e.description}</div><div style={{color:T.textSub,fontSize:".7rem"}}>{fmtD(e.date)} · {e.category}</div></div><span style={{color:T.red,fontWeight:700}}>{fmt(e.value)}</span></div>))}
            </div>
          </div>
        </>}

        {/* ══ AGENDA ══ */}
        {tab==="agenda"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem",flexWrap:"wrap",gap:"1rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Agenda</h1>
            <button style={BT()} onClick={()=>{setAf({...AF0,service:services[0]?.name||""});setMA(true);}}>{Ic.plus} Novo Agendamento</button>
          </div>

          {/* View toggle + filter */}
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1.5rem",flexWrap:"wrap"}}>
            {[["day","Dia"],["week","Semana"],["month","Mês"]].map(([v,l])=>(
              <button key={v} onClick={()=>setAgView(v)}
                style={{...BT(agView===v?"p":"g"),padding:"6px 14px",fontSize:".8rem"}}>{l}</button>
            ))}
            <div style={{width:"1px",height:"24px",background:T.cardBorder,margin:"0 4px"}}/>
            {agView==="month"
              ? <MonthNav value={agMonth} onChange={setAgMonth} T={T}/>
              : <input type="date" value={agDate} onChange={e=>setAgDate(e.target.value)} style={{...IS,width:"155px"}}/>
            }
            <span style={{fontSize:".82rem",color:T.textSub,marginLeft:"4px"}}>{filteredA.length} agendamento(s)</span>
          </div>

          {/* Summary bar for week/month */}
          {agView!=="day"&&(()=>{
            const conf=filteredA.filter(a=>a.status==="confirmado").length;
            const pend=filteredA.filter(a=>a.status==="pendente").length;
            const canc=filteredA.filter(a=>a.status==="cancelado").length;
            const conc=filteredA.filter(a=>a.status==="concluído").length;
            return filteredA.length>0&&(
              <div style={{display:"flex",gap:"1rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
                {[
                  {l:"Confirmados",v:conf,c:STATUS_C.confirmado},
                  {l:"Pendentes",v:pend,c:STATUS_C.pendente},
                  {l:"Concluídos",v:conc,c:STATUS_C.concluído},
                  {l:"Cancelados",v:canc,c:STATUS_C.cancelado},
                ].map(k=>(
                  <div key={k.l} style={{background:T.card,border:`1px solid ${k.c}30`,borderRadius:"12px",padding:"10px 18px",flex:1,minWidth:"100px"}}>
                    <div style={{fontSize:"1.4rem",fontWeight:700,color:k.c}}>{k.v}</div>
                    <div style={{fontSize:".68rem",color:T.textSub,textTransform:"uppercase",marginTop:"2px"}}>{k.l}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Group by date for week/month views */}
          {agView==="day"?(
            <div style={CARD}>
              <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
                {["Hora","Cliente","Serviço","Status",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
              </div>
              {filteredA.length===0&&<div style={{color:T.textSub,padding:"1rem",fontSize:".82rem"}}>Sem agendamentos para este dia.</div>}
              {filteredA.map(a=>(
                <div key={a.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"9px 12px",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".82rem",alignItems:"center"}}>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:T.accent}}>{a.time}</span>
                  <span style={{fontWeight:600,color:T.text}}>{a.client}</span>
                  <span style={{color:T.textMuted}}>{a.service}</span>
                  <select value={a.status} onChange={e=>updateApptStatus(a.id,e.target.value)}
                    style={{background:T.input,border:`1px solid ${T.inputBorder}`,borderRadius:"8px",padding:"3px 8px",color:STATUS_C[a.status],fontSize:".75rem",cursor:"pointer"}}>
                    {Object.keys(STATUS_C).map(s=><option key={s}>{s}</option>)}
                  </select>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,display:"flex"}} onClick={()=>delAppt(a.id)}>{Ic.trash}</button>
                </div>
              ))}
            </div>
          ):(()=>{
            // group by date
            const groups={};
            filteredA.forEach(a=>{
              if(!groups[a.date])groups[a.date]=[];
              groups[a.date].push(a);
            });
            const dates=Object.keys(groups).sort();
            if(dates.length===0)return <div style={{...CARD,color:T.textSub,fontSize:".82rem"}}>Sem agendamentos neste período.</div>;
            return dates.map(date=>(
              <div key={date} style={{...CARD,marginBottom:"1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem",paddingBottom:"10px",borderBottom:`1px solid ${T.cardBorder}`}}>
                  <div style={{background:T.accentGrad,borderRadius:"8px",padding:"4px 12px",fontSize:".8rem",fontWeight:700,color:"#fff"}}>{fmtD(date)}</div>
                  <span style={{fontSize:".8rem",color:T.textSub}}>{new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"})}</span>
                  <span style={{marginLeft:"auto",fontSize:".75rem",color:T.textMuted}}>{groups[date].length} atendimento(s)</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"0 0 4px"}}>
                  {["Hora","Cliente","Serviço","Status",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
                </div>
                {groups[date].map(a=>(
                  <div key={a.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"9px 0",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".82rem",alignItems:"center"}}>
                    <span style={{fontFamily:"monospace",fontWeight:700,color:T.accent}}>{a.time}</span>
                    <span style={{fontWeight:600,color:T.text}}>{a.client}</span>
                    <span style={{color:T.textMuted}}>{a.service}</span>
                    <select value={a.status} onChange={e=>updateApptStatus(a.id,e.target.value)}
                      style={{background:T.input,border:`1px solid ${T.inputBorder}`,borderRadius:"8px",padding:"3px 8px",color:STATUS_C[a.status],fontSize:".75rem",cursor:"pointer"}}>
                      {Object.keys(STATUS_C).map(s=><option key={s}>{s}</option>)}
                    </select>
                    <button style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,display:"flex"}} onClick={()=>delAppt(a.id)}>{Ic.trash}</button>
                  </div>
                ))}
              </div>
            ));
          })()}
        </>}

        {/* ══ CONFIGURAÇÕES ══ */}
        {tab==="config"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.75rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:T.text}}>Configurações</h1>
          </div>

          {/* Services */}
          <div style={{...CARD,marginBottom:"1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
              <div>
                <div style={{fontWeight:600,color:T.text,fontSize:".95rem"}}>Serviços e Preços</div>
                <div style={{fontSize:".75rem",color:T.textSub,marginTop:"2px"}}>Gerencie os serviços disponíveis e seus preços padrão</div>
              </div>
              <button style={BT()} onClick={openNewSvc}>{Ic.plus} Novo Serviço</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 120px 80px 80px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Serviço","Preço Padrão","",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {services.map(s=>(
              <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 120px 80px 80px",gap:"12px",padding:"10px 12px",borderBottom:`1px solid ${T.rowBorder}`,fontSize:".85rem",alignItems:"center"}}>
                <span style={{fontWeight:600,color:T.text}}>{s.name}</span>
                <span style={{color:T.accent,fontWeight:700}}>{fmt(s.price)}</span>
                <button style={{...BT("g"),padding:"5px 10px",fontSize:".75rem"}} onClick={()=>openEditSvc(s)}>{Ic.edit} Editar</button>
                <button style={{...BT("r"),padding:"5px 10px",fontSize:".75rem"}} onClick={()=>deleteSvc(s.id)}>{Ic.trash} Excluir</button>
              </div>
            ))}
            {services.length===0&&<div style={{color:T.textSub,padding:"1rem",fontSize:".82rem"}}>Nenhum serviço cadastrado.</div>}
          </div>

          {/* Theme */}
          <div style={CARD}>
            <div style={{fontWeight:600,color:T.text,fontSize:".95rem",marginBottom:".5rem"}}>Aparência</div>
            <div style={{fontSize:".75rem",color:T.textSub,marginBottom:"1rem"}}>Escolha entre o modo escuro e claro</div>
            <div style={{display:"flex",gap:"1rem"}}>
              {["dark","light"].map(th=>(
                <button key={th} onClick={()=>setTheme(th)} style={{flex:1,padding:"1rem",borderRadius:"12px",border:`2px solid ${theme===th?T.accent:T.cardBorder}`,background:th==="dark"?"#05020e":"#f5f3ff",cursor:"pointer",transition:"all .2s"}}>
                  <div style={{fontSize:"1.5rem",marginBottom:"6px"}}>{th==="dark"?"🌙":"☀️"}</div>
                  <div style={{fontSize:".82rem",fontWeight:600,color:th==="dark"?"#e8d8ff":"#1f1235"}}>{th==="dark"?"Modo Escuro":"Modo Claro"}</div>
                  {theme===th&&<div style={{fontSize:".7rem",color:T.accent,marginTop:"4px"}}>✓ Ativo</div>}
                </button>
              ))}
            </div>
          </div>
        </>}

        </>}
      </main>

      {/* ══ MODAL ENTRADA ══ */}
      {mE&&<Modal title="Nova Entrada" onClose={()=>setME(false)} T={T}>
        <Field label="Data" T={T}><input type="date" style={IS} value={ef.date} onChange={e=>setEf(p=>({...p,date:e.target.value}))}/></Field>
        <Field label="Cliente" T={T}><input style={IS} placeholder="Nome da cliente" value={ef.client} onChange={e=>setEf(p=>({...p,client:e.target.value}))}/></Field>
        <Field label="Serviço" T={T}>
          <select style={IS} value={ef.service} onChange={e=>{
            const svc=services.find(s=>s.name===e.target.value);
            setEf(p=>({...p,service:e.target.value,value:svc?String(svc.price):p.value}));
          }}>
            {services.map(s=><option key={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Valor (R$)" T={T}><input type="number" style={IS} placeholder="0,00" value={ef.value} onChange={e=>setEf(p=>({...p,value:e.target.value}))}/></Field>
          <Field label="Pagamento" T={T}><select style={IS} value={ef.payment} onChange={e=>setEf(p=>({...p,payment:e.target.value}))}>{PAYMENTS.map(p=><option key={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Observações" T={T}><textarea style={{...IS,resize:"vertical",minHeight:"60px"}} placeholder="Opcional..." value={ef.notes} onChange={e=>setEf(p=>({...p,notes:e.target.value}))}/></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setME(false)}>Cancelar</button>
          <button style={BT()} onClick={saveEntry} disabled={saving}>{saving?"Salvando...":"Salvar Entrada"}</button>
        </div>
      </Modal>}

      {/* ══ MODAL SAÍDA ══ */}
      {mX&&<Modal title="Nova Saída" onClose={()=>setMX(false)} T={T}>
        <Field label="Data" T={T}><input type="date" style={IS} value={xf.date} onChange={e=>setXf(p=>({...p,date:e.target.value}))}/></Field>
        <Field label="Descrição" T={T}><input style={IS} placeholder="Ex: Aluguel, henna, curso..." value={xf.description} onChange={e=>setXf(p=>({...p,description:e.target.value}))}/></Field>
        <Field label="Categoria" T={T}><select style={IS} value={xf.category} onChange={e=>setXf(p=>({...p,category:e.target.value}))}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Valor (R$)" T={T}><input type="number" style={IS} placeholder="0,00" value={xf.value} onChange={e=>setXf(p=>({...p,value:e.target.value}))}/></Field>
          <Field label="Pagamento" T={T}><select style={IS} value={xf.payment} onChange={e=>setXf(p=>({...p,payment:e.target.value}))}>{PAYMENTS.map(p=><option key={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Observações" T={T}><textarea style={{...IS,resize:"vertical",minHeight:"60px"}} placeholder="Opcional..." value={xf.notes} onChange={e=>setXf(p=>({...p,notes:e.target.value}))}/></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setMX(false)}>Cancelar</button>
          <button style={BT()} onClick={saveExpense} disabled={saving}>{saving?"Salvando...":"Salvar Saída"}</button>
        </div>
      </Modal>}

      {/* ══ MODAL AGENDAMENTO ══ */}
      {mA&&<Modal title="Novo Agendamento" onClose={()=>setMA(false)} T={T}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Data" T={T}><input type="date" style={IS} value={af.date} onChange={e=>setAf(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="Horário" T={T}><input type="time" style={IS} value={af.time} onChange={e=>setAf(p=>({...p,time:e.target.value}))}/></Field>
        </div>
        <Field label="Cliente" T={T}><input style={IS} placeholder="Nome da cliente" value={af.client} onChange={e=>setAf(p=>({...p,client:e.target.value}))}/></Field>
        <Field label="Serviço" T={T}><select style={IS} value={af.service} onChange={e=>setAf(p=>({...p,service:e.target.value}))}>{services.map(s=><option key={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Status" T={T}><select style={IS} value={af.status} onChange={e=>setAf(p=>({...p,status:e.target.value}))}>{Object.keys(STATUS_C).map(s=><option key={s}>{s}</option>)}</select></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setMA(false)}>Cancelar</button>
          <button style={BT()} onClick={saveAppt} disabled={saving}>{saving?"Salvando...":"Agendar"}</button>
        </div>
      </Modal>}

      {/* ══ MODAL SERVIÇO ══ */}
      {mSvc&&<Modal title={editSvc?"Editar Serviço":"Novo Serviço"} onClose={()=>setMSvc(false)} T={T}>
        <Field label="Nome do Serviço" T={T}><input style={IS} placeholder="Ex: Design de Sobrancelha" value={svcForm.name} onChange={e=>setSvcForm(p=>({...p,name:e.target.value}))}/></Field>
        <Field label="Preço Padrão (R$)" T={T}><input type="number" style={IS} placeholder="0,00" value={svcForm.price} onChange={e=>setSvcForm(p=>({...p,price:e.target.value}))}/></Field>
        <div style={{fontSize:".75rem",color:T.textSub,marginBottom:"1rem"}}>O preço será preenchido automaticamente ao lançar uma entrada, mas pode ser alterado manualmente.</div>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setMSvc(false)}>Cancelar</button>
          <button style={BT()} onClick={confirmSvc}>{editSvc?"Salvar Alteração":"Adicionar Serviço"}</button>
        </div>
      </Modal>}
    </div>
  );
}
