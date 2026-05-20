import { useState, useEffect, useMemo } from "react";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  updateDoc, query, orderBy, serverTimestamp
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

const SERVICES     = ["Design de Sobrancelha","Micropigmentação","Henna","Laminação","Brow Lifting","Remoção","Retoque"];
const EXPENSE_CATS = ["Material/Insumos","Aluguel","Energia/Água","Marketing","Equipamentos","Curso/Treinamento","Outros"];
const PAYMENTS     = ["Pix","Dinheiro","Cartão Débito","Cartão Crédito"];
const STATUS_C     = {confirmado:"#10b981",pendente:"#f59e0b",cancelado:"#ef4444",concluído:"#6366f1"};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic={
  dash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  entry:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  exit:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  report: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-8"/></svg>,
  cal:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>,
  trash:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  close:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  cloud:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const IS  = {width:"100%",background:"#080412",border:"1px solid #281840",borderRadius:"10px",padding:"9px 13px",color:"#f0e6ff",fontSize:".875rem",outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"};
const LS  = {display:"block",fontSize:".68rem",color:"#6a4a90",marginBottom:"4px",letterSpacing:".06em",textTransform:"uppercase"};
const BT  = (v="p") => ({display:"inline-flex",alignItems:"center",gap:"6px",padding:"8px 15px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:".82rem",fontWeight:600,fontFamily:"'DM Sans',sans-serif",
  ...(v==="p"?{background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"#fff"}:
      v==="g"?{background:"#110820",color:"#b898d8",border:"1px solid #281840"}:
              {background:"#0a1a10",color:"#10b981",border:"1px solid #0d3020"})});
const CARD= {background:"#0c0818",border:"1px solid #160d2a",borderRadius:"14px",padding:"1.25rem"};
const TH  = {fontSize:".68rem",color:"#4a3465",textTransform:"uppercase",letterSpacing:".07em"};

function Field({label,children}){
  return <div style={{marginBottom:"1rem"}}><label style={LS}>{label}</label>{children}</div>;
}

function Modal({title,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(6,2,14,.85)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"#0e0620",border:"1px solid #3a2550",borderRadius:"18px",width:"100%",maxWidth:"500px",padding:"1.75rem",boxShadow:"0 40px 100px rgba(0,0,0,.8)",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <h3 style={{margin:0,fontSize:"1rem",fontFamily:"'Playfair Display',serif",color:"#f0e6ff"}}>{title}</h3>
          <button onClick={onClose} style={{background:"#1e1030",border:"none",borderRadius:"8px",padding:"5px",cursor:"pointer",color:"#8a6ab0",display:"flex"}}>{Ic.close}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner(){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"200px",flexDirection:"column",gap:"1rem"}}>
      <div style={{width:"32px",height:"32px",border:"3px solid #281840",borderTop:"3px solid #a855f7",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <span style={{color:"#6a4a90",fontSize:".83rem"}}>Conectando ao banco de dados...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function StudioManager(){
  const [tab,setTab]           = useState("dashboard");
  const [entries,setEntries]   = useState([]);
  const [expenses,setExpenses] = useState([]);
  const [appts,setAppts]       = useState([]);
  const [loading,setLoading]   = useState(true);
  const [dbOk,setDbOk]         = useState(false);
  const [saving,setSaving]     = useState(false);

  // modals
  const [mE,setME] = useState(false);
  const [mX,setMX] = useState(false);
  const [mA,setMA] = useState(false);

  // forms
  const EF0 = {date:todayISO(),client:"",service:SERVICES[0],value:"",payment:PAYMENTS[0],notes:""};
  const XF0 = {date:todayISO(),description:"",category:EXPENSE_CATS[0],value:"",payment:PAYMENTS[0],notes:""};
  const AF0 = {date:todayISO(),time:"09:00",client:"",service:SERVICES[0],status:"confirmado"};
  const [ef,setEf] = useState(EF0);
  const [xf,setXf] = useState(XF0);
  const [af,setAf] = useState(AF0);

  const [rPeriod,setRPeriod] = useState("month");
  const [rRef,setRRef]       = useState(todayISO());
  const [agDate,setAgDate]   = useState(todayISO());

  // ── Firebase listeners ────────────────────────────────────────────────────
  useEffect(()=>{
    let loaded = 0;
    const done = () => { loaded++; if(loaded>=3){ setLoading(false); setDbOk(true); } };

    const unsubE = onSnapshot(
      query(collection(db,"entries"), orderBy("createdAt","desc")),
      (snap) => { setEntries(snap.docs.map(d=>({id:d.id,...d.data()}))); done(); },
      () => { setLoading(false); setDbOk(false); }
    );
    const unsubX = onSnapshot(
      query(collection(db,"expenses"), orderBy("createdAt","desc")),
      (snap) => { setExpenses(snap.docs.map(d=>({id:d.id,...d.data()}))); done(); },
      () => { setLoading(false); setDbOk(false); }
    );
    const unsubA = onSnapshot(
      query(collection(db,"appointments"), orderBy("date","asc")),
      (snap) => { setAppts(snap.docs.map(d=>({id:d.id,...d.data()}))); done(); },
      () => { setLoading(false); setDbOk(false); }
    );

    return () => { unsubE(); unsubX(); unsubA(); };
  },[]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const saveEntry = async () => {
    if(!ef.client||!ef.value) return;
    setSaving(true);
    await addDoc(collection(db,"entries"),{...ef,value:parseFloat(ef.value),createdAt:serverTimestamp()});
    setSaving(false); setEf(EF0); setME(false);
  };

  const saveExpense = async () => {
    if(!xf.description||!xf.value) return;
    setSaving(true);
    await addDoc(collection(db,"expenses"),{...xf,value:parseFloat(xf.value),createdAt:serverTimestamp()});
    setSaving(false); setXf(XF0); setMX(false);
  };

  const saveAppt = async () => {
    if(!af.client) return;
    setSaving(true);
    await addDoc(collection(db,"appointments"),{...af,createdAt:serverTimestamp()});
    setSaving(false); setAf(AF0); setMA(false);
  };

  const delEntry   = (id) => deleteDoc(doc(db,"entries",id));
  const delExpense = (id) => deleteDoc(doc(db,"expenses",id));
  const delAppt    = (id) => deleteDoc(doc(db,"appointments",id));
  const updateApptStatus = (id,status) => updateDoc(doc(db,"appointments",id),{status});

  // ── Period filter ─────────────────────────────────────────────────────────
  const inPeriod=(date,p,ref)=>{
    if(p==="day")   return date===ref;
    if(p==="week")  return weekStart(date)===weekStart(ref);
    if(p==="month") return isoMonth(date)===isoMonth(ref);
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const T      = todayISO();
  const todayE = entries.filter(e=>e.date===T);
  const monE   = entries.filter(e=>isoMonth(e.date)===isoMonth(T));
  const monX   = expenses.filter(e=>isoMonth(e.date)===isoMonth(T));
  const kDay   = todayE.reduce((s,e)=>s+e.value,0);
  const kMon   = monE.reduce((s,e)=>s+e.value,0);
  const kMonX  = monX.reduce((s,e)=>s+e.value,0);

  // ── Report ────────────────────────────────────────────────────────────────
  const rE   = entries.filter(e=>inPeriod(e.date,rPeriod,rRef));
  const rX   = expenses.filter(e=>inPeriod(e.date,rPeriod,rRef));
  const rIn  = rE.reduce((s,e)=>s+e.value,0);
  const rOut = rX.reduce((s,e)=>s+e.value,0);
  const rRes = rIn-rOut;

  // ── Chart data ────────────────────────────────────────────────────────────
  const last7 = useMemo(()=>{
    return Array.from({length:7},(_,i)=>{
      const d=new Date(T+"T12:00:00"); d.setDate(d.getDate()-(6-i));
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

  const periodLabel = useMemo(()=>{
    if(rPeriod==="day")   return fmtD(rRef);
    if(rPeriod==="week")  return `${fmtD(weekStart(rRef))} – ${fmtD(weekEnd(rRef))}`;
    return new Date(rRef+"T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  },[rPeriod,rRef]);

  const filteredA = appts.filter(a=>a.date===agDate).sort((a,b)=>a.time?.localeCompare(b.time));

  const TABS=[
    {id:"dashboard",l:"Dashboard",i:Ic.dash},
    {id:"entries",  l:"Entradas",  i:Ic.entry},
    {id:"expenses", l:"Saídas",    i:Ic.exit},
    {id:"report",   l:"Relatório", i:Ic.report},
    {id:"agenda",   l:"Agenda",    i:Ic.cal},
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:"#05020e",fontFamily:"'DM Sans',sans-serif",color:"#e8d8ff",display:"flex"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{font-family:'DM Sans',sans-serif;color:#f0e6ff}
        button{transition:opacity .15s}button:hover{opacity:.82}
        input:focus,select:focus,textarea:focus{border-color:#7c3aed!important;outline:none}
        option{background:#0e0620;color:#f0e6ff}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#06020e}::-webkit-scrollbar-thumb{background:#2d1f42;border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{width:"200px",minHeight:"100vh",background:"#070316",borderRight:"1px solid #130926",display:"flex",flexDirection:"column",padding:"1.5rem .875rem",flexShrink:0}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.15rem",color:"#f0c8e8",lineHeight:1.25,marginBottom:".2rem"}}>Studio<br/>Binha Brito</div>
        <div style={{fontSize:".62rem",color:"#4a2d6a",letterSpacing:".12em",textTransform:"uppercase",marginBottom:"1.75rem"}}>Gestão</div>

        {TABS.map(t=>{
          const a=tab===t.id;
          return <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 12px",borderRadius:"10px",border:"none",cursor:"pointer",width:"100%",fontSize:".82rem",fontFamily:"'DM Sans',sans-serif",marginBottom:"2px",background:a?"linear-gradient(135deg,#6d28d9,#9d4ec4)":"transparent",color:a?"#fff":"#6a4a90",fontWeight:a?600:400}}>{t.i}{t.l}</button>;
        })}

        <div style={{marginTop:"auto",borderTop:"1px solid #130926",paddingTop:".875rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:".7rem",color:dbOk?"#10b981":"#f59e0b"}}>
            <div style={{width:"6px",height:"6px",borderRadius:"50%",background:dbOk?"#10b981":"#f59e0b",animation:dbOk?"":"pulse 1.5s infinite"}}/>
            {dbOk?"● Firebase conectado":"⚠ Configurar Firebase"}
          </div>
          {saving&&<div style={{fontSize:".68rem",color:"#a855f7",marginTop:"4px",display:"flex",alignItems:"center",gap:"4px"}}><div style={{width:"8px",height:"8px",border:"1.5px solid #a855f7",borderTop:"1.5px solid transparent",borderRadius:"50%",animation:"spin .6s linear infinite"}}/> Salvando...</div>}
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{flex:1,padding:"1.75rem 2rem",overflowY:"auto"}}>

        {/* Firebase config warning */}
        {!dbOk && !loading && (
          <div style={{background:"#1a0a00",border:"1px solid #7c3a00",borderRadius:"14px",padding:"1.25rem 1.5rem",marginBottom:"1.5rem"}}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:".5rem",fontSize:".95rem"}}>⚠ Firebase não configurado</div>
            <div style={{color:"#a07040",fontSize:".83rem",lineHeight:1.6}}>
              Edite o arquivo <code style={{background:"#2a1500",padding:"1px 6px",borderRadius:"4px",color:"#fbbf24"}}>src/firebase.js</code> com suas credenciais do Firebase para ativar o salvamento na nuvem.
            </div>
          </div>
        )}

        {loading ? <Spinner/> : <>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.75rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:"#f0e6ff"}}>Dashboard</h1>
            <span style={{fontSize:".8rem",color:"#4a3465"}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
            {[
              {l:"Hoje – Entradas",v:fmt(kDay),c:"#a855f7"},
              {l:"Mês – Entradas",v:fmt(kMon),c:"#818cf8"},
              {l:"Mês – Saídas",v:fmt(kMonX),c:"#f87171"},
              {l:"Resultado Mês",v:fmt(kMon-kMonX),c:kMon-kMonX>=0?"#10b981":"#f87171"},
            ].map(k=>(
              <div key={k.l} style={CARD}>
                <div style={{fontSize:"1.35rem",fontFamily:"'Playfair Display',serif",fontWeight:700,color:k.c}}>{k.v}</div>
                <div style={{fontSize:".68rem",color:"#4a3465",textTransform:"uppercase",letterSpacing:".05em",marginTop:"4px"}}>{k.l}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:"1.25rem",marginBottom:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimos 7 dias</div>
              {(()=>{
                const maxV=Math.max(...last7.map(d=>Math.max(d.inc,d.exp)),1);
                return(
                  <div>
                    <div style={{display:"flex",gap:"8px",alignItems:"flex-end",height:"90px"}}>
                      {last7.map((d,i)=>(
                        <div key={i} style={{flex:1,display:"flex",gap:"2px",alignItems:"flex-end"}}>
                          <div style={{flex:1,borderRadius:"3px 3px 0 0",height:`${(d.inc/maxV)*82}px`,minHeight:d.inc>0?3:0,background:"linear-gradient(to top,#7c3aed,#c084fc)"}}/>
                          <div style={{flex:1,borderRadius:"3px 3px 0 0",height:`${(d.exp/maxV)*82}px`,minHeight:d.exp>0?3:0,background:"linear-gradient(to top,#be123c,#fb7185)"}}/>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:"8px",marginTop:"5px"}}>{last7.map((d,i)=><div key={i} style={{flex:1,fontSize:".6rem",color:"#3d2550",textAlign:"center"}}>{d.l}</div>)}</div>
                    <div style={{display:"flex",gap:"14px",marginTop:"8px",fontSize:".7rem"}}><span style={{color:"#c084fc"}}>■ Entradas</span><span style={{color:"#fb7185"}}>■ Saídas</span></div>
                  </div>
                );
              })()}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Serviços do Mês</div>
              {svcBreak.length===0&&<div style={{color:"#2d1f42",fontSize:".82rem"}}>Sem dados</div>}
              {svcBreak.map(([s,v])=>{const p=kMon>0?Math.round(v/kMon*100):0;return(
                <div key={s} style={{marginBottom:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",marginBottom:"3px"}}><span style={{color:"#c4a8e8"}}>{s}</span><span style={{color:"#a855f7",fontWeight:600}}>{p}%</span></div>
                  <div style={{height:"4px",borderRadius:"2px",background:"#160d2a"}}><div style={{height:"100%",borderRadius:"2px",width:`${p}%`,background:"linear-gradient(90deg,#7c3aed,#c084fc)"}}/></div>
                </div>
              );})}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimas Entradas</div>
              {entries.length===0&&<div style={{color:"#2d1f42",fontSize:".82rem"}}>Sem entradas</div>}
              {entries.slice(0,6).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #100820",fontSize:".8rem"}}>
                  <span>{e.client} <span style={{color:"#3d2550"}}>·</span> <span style={{color:"#4a3465"}}>{e.service}</span></span>
                  <span style={{color:"#a855f7",fontWeight:700}}>{fmt(e.value)}</span>
                </div>
              ))}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Últimas Saídas</div>
              {expenses.length===0&&<div style={{color:"#2d1f42",fontSize:".82rem"}}>Sem saídas</div>}
              {expenses.slice(0,6).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #100820",fontSize:".8rem"}}>
                  <span>{e.description} <span style={{color:"#3d2550"}}>·</span> <span style={{color:"#4a3465"}}>{e.category}</span></span>
                  <span style={{color:"#f87171",fontWeight:700}}>{fmt(e.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ══ ENTRADAS ══ */}
        {tab==="entries"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:"#f0e6ff"}}>Entradas</h1>
            <button style={BT()} onClick={()=>{setEf(EF0);setME(true);}}>{Ic.plus} Nova Entrada</button>
          </div>
          <div style={{display:"flex",gap:"1rem",marginBottom:"1.5rem"}}>
            {[{l:"Hoje",v:fmt(kDay),c:"#a855f7"},{l:"Mês",v:fmt(kMon),c:"#818cf8"},{l:"Qtd. Mês",v:monE.length,c:"#ec4899"}].map(k=>(
              <div key={k.l} style={{...CARD,flex:1,padding:"1rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:k.c}}>{k.v}</div><div style={{fontSize:".68rem",color:"#4a3465",textTransform:"uppercase",marginTop:"3px"}}>{k.l}</div></div>
            ))}
          </div>
          <div style={CARD}>
            <div style={{display:"grid",gridTemplateColumns:"95px 1fr 1.1fr 90px 110px 32px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Data","Cliente","Serviço","Valor","Pgto",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {entries.length===0&&<div style={{color:"#2d1f42",padding:"1rem",fontSize:".82rem"}}>Nenhuma entrada lançada.</div>}
            {entries.map(e=>(
              <div key={e.id} style={{display:"grid",gridTemplateColumns:"95px 1fr 1.1fr 90px 110px 32px",gap:"12px",padding:"9px 12px",borderBottom:"1px solid #0e0620",fontSize:".82rem",alignItems:"center"}}>
                <span style={{color:"#4a3465"}}>{fmtD(e.date)}</span>
                <span style={{fontWeight:600}}>{e.client}</span>
                <span style={{color:"#9b7ec4"}}>{e.service}</span>
                <span style={{color:"#a855f7",fontWeight:700}}>{fmt(e.value)}</span>
                <span style={{fontSize:".72rem",color:"#10b981",background:"#10b98115",padding:"2px 8px",borderRadius:"20px",textAlign:"center"}}>{e.payment}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:"#3d2055",display:"flex"}} onClick={()=>delEntry(e.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>}

        {/* ══ SAÍDAS ══ */}
        {tab==="expenses"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:"#f0e6ff"}}>Saídas</h1>
            <button style={BT()} onClick={()=>{setXf(XF0);setMX(true);}}>{Ic.plus} Nova Saída</button>
          </div>
          <div style={{display:"flex",gap:"1rem",marginBottom:"1.5rem"}}>
            {[
              {l:"Hoje",v:fmt(expenses.filter(e=>e.date===T).reduce((s,e)=>s+e.value,0)),c:"#f87171"},
              {l:"Mês",v:fmt(kMonX),c:"#ef4444"},
              {l:"Qtd. Mês",v:monX.length,c:"#f59e0b"},
            ].map(k=>(
              <div key={k.l} style={{...CARD,flex:1,padding:"1rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:k.c}}>{k.v}</div><div style={{fontSize:".68rem",color:"#4a3465",textTransform:"uppercase",marginTop:"3px"}}>{k.l}</div></div>
            ))}
          </div>
          {catBreak.length>0&&(
            <div style={{...CARD,marginBottom:"1.25rem"}}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Por Categoria – Mês</div>
              <div style={{display:"flex",gap:".75rem",flexWrap:"wrap"}}>
                {catBreak.map(([c,v])=>(
                  <div key={c} style={{background:"#080412",border:"1px solid #160d2a",borderRadius:"10px",padding:"8px 14px"}}>
                    <div style={{color:"#f87171",fontWeight:700,fontSize:".9rem"}}>{fmt(v)}</div>
                    <div style={{color:"#4a3465",fontSize:".72rem",marginTop:"2px"}}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={CARD}>
            <div style={{display:"grid",gridTemplateColumns:"95px 1.2fr 1fr 90px 110px 32px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Data","Descrição","Categoria","Valor","Pgto",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {expenses.length===0&&<div style={{color:"#2d1f42",padding:"1rem",fontSize:".82rem"}}>Nenhuma saída lançada.</div>}
            {expenses.map(e=>(
              <div key={e.id} style={{display:"grid",gridTemplateColumns:"95px 1.2fr 1fr 90px 110px 32px",gap:"12px",padding:"9px 12px",borderBottom:"1px solid #0e0620",fontSize:".82rem",alignItems:"center"}}>
                <span style={{color:"#4a3465"}}>{fmtD(e.date)}</span>
                <span style={{fontWeight:600}}>{e.description}</span>
                <span style={{color:"#9b7ec4"}}>{e.category}</span>
                <span style={{color:"#f87171",fontWeight:700}}>{fmt(e.value)}</span>
                <span style={{fontSize:".72rem",color:"#f59e0b",background:"#f59e0b15",padding:"2px 8px",borderRadius:"20px",textAlign:"center"}}>{e.payment}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:"#3d2055",display:"flex"}} onClick={()=>delExpense(e.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>}

        {/* ══ RELATÓRIO ══ */}
        {tab==="report"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem",flexWrap:"wrap",gap:"1rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:"#f0e6ff"}}>Relatório</h1>
            <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
              {[["day","Dia"],["week","Semana"],["month","Mês"]].map(([p,l])=>(
                <button key={p} onClick={()=>setRPeriod(p)} style={{...BT(rPeriod===p?"p":"g"),padding:"6px 13px",fontSize:".78rem"}}>{l}</button>
              ))}
              <input type="date" value={rRef} onChange={e=>setRRef(e.target.value)} style={{...IS,width:"145px",padding:"6px 11px",marginLeft:"4px"}}/>
            </div>
          </div>
          <div style={{fontSize:".82rem",color:"#4a3465",marginBottom:"1.5rem"}}>Período: <span style={{color:"#c4a8e8",fontWeight:600}}>{periodLabel}</span></div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
            <div style={{...CARD,borderColor:"#2d1f42"}}>
              <div style={{fontSize:".68rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Entradas</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:"#a855f7",fontWeight:700}}>{fmt(rIn)}</div>
              <div style={{fontSize:".72rem",color:"#4a3465",marginTop:"4px"}}>{rE.length} lançamento(s)</div>
            </div>
            <div style={{...CARD,borderColor:"#3b1428"}}>
              <div style={{fontSize:".68rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Saídas</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:"#f87171",fontWeight:700}}>{fmt(rOut)}</div>
              <div style={{fontSize:".72rem",color:"#4a3465",marginTop:"4px"}}>{rX.length} lançamento(s)</div>
            </div>
            <div style={{...CARD,borderColor:rRes>=0?"#10b98140":"#f8717140"}}>
              <div style={{fontSize:".68rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px"}}>Resultado Líquido</div>
              <div style={{fontSize:"1.5rem",fontFamily:"'Playfair Display',serif",color:rRes>=0?"#10b981":"#f87171",fontWeight:700}}>{fmt(rRes)}</div>
              <div style={{fontSize:".72rem",color:rRes>=0?"#10b981":"#f87171",marginTop:"4px"}}>{rRes>=0?"✓ Positivo":"✗ Negativo"}</div>
            </div>
          </div>

          {(rIn>0||rOut>0)&&(()=>{
            const total=rIn+rOut||1; const pIn=Math.round(rIn/total*100);
            return(
              <div style={{...CARD,marginBottom:"1.5rem"}}>
                <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Proporção Entradas × Saídas</div>
                <div style={{height:"12px",borderRadius:"6px",overflow:"hidden",display:"flex"}}>
                  <div style={{width:`${pIn}%`,background:"linear-gradient(90deg,#7c3aed,#c084fc)",transition:"width .5s"}}/>
                  <div style={{flex:1,background:"linear-gradient(90deg,#be123c,#fb7185)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px",fontSize:".75rem"}}>
                  <span style={{color:"#c084fc"}}>Entradas {pIn}%</span><span style={{color:"#fb7185"}}>Saídas {100-pIn}%</span>
                </div>
              </div>
            );
          })()}

          {rPeriod==="month"&&(()=>{
            const weekMap={};
            [...rE.map(e=>({...e,type:"in"})),...rX.map(e=>({...e,type:"out"}))].forEach(e=>{
              const ws=weekStart(e.date);
              if(!weekMap[ws])weekMap[ws]={ws,we:weekEnd(e.date),in:0,out:0};
              if(e.type==="in")weekMap[ws].in+=e.value;else weekMap[ws].out+=e.value;
            });
            const weeks=Object.values(weekMap).sort((a,b)=>a.ws.localeCompare(b.ws));
            if(weeks.length===0)return null;
            return(
              <div style={{...CARD,marginBottom:"1.5rem"}}>
                <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Resumo por Semana</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 100px 100px 100px",gap:"10px",padding:"4px 10px",marginBottom:"4px"}}>
                  {["Semana","Entradas","Saídas","Resultado"].map((h,i)=><span key={i} style={TH}>{h}</span>)}
                </div>
                {weeks.map(w=>(
                  <div key={w.ws} style={{display:"grid",gridTemplateColumns:"1fr 100px 100px 100px",gap:"10px",padding:"8px 10px",borderBottom:"1px solid #0e0620",fontSize:".8rem",alignItems:"center"}}>
                    <span style={{color:"#6a4a90"}}>{fmtD(w.ws)} – {fmtD(w.we)}</span>
                    <span style={{color:"#a855f7",fontWeight:600}}>{fmt(w.in)}</span>
                    <span style={{color:"#f87171",fontWeight:600}}>{fmt(w.out)}</span>
                    <span style={{color:w.in-w.out>=0?"#10b981":"#f87171",fontWeight:700}}>{fmt(w.in-w.out)}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Entradas do Período</div>
              {rE.length===0&&<div style={{color:"#2d1f42",fontSize:".82rem"}}>Sem entradas</div>}
              {rE.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0e0620",fontSize:".78rem"}}><div><div style={{color:"#c4a8e8"}}>{e.client}</div><div style={{color:"#3d2550",fontSize:".7rem"}}>{fmtD(e.date)} · {e.service}</div></div><span style={{color:"#a855f7",fontWeight:700}}>{fmt(e.value)}</span></div>))}
            </div>
            <div style={CARD}>
              <div style={{fontSize:".72rem",color:"#6a4a90",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"1rem"}}>Saídas do Período</div>
              {rX.length===0&&<div style={{color:"#2d1f42",fontSize:".82rem"}}>Sem saídas</div>}
              {rX.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0e0620",fontSize:".78rem"}}><div><div style={{color:"#c4a8e8"}}>{e.description}</div><div style={{color:"#3d2550",fontSize:".7rem"}}>{fmtD(e.date)} · {e.category}</div></div><span style={{color:"#f87171",fontWeight:700}}>{fmt(e.value)}</span></div>))}
            </div>
          </div>
        </>}

        {/* ══ AGENDA ══ */}
        {tab==="agenda"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:"#f0e6ff"}}>Agenda</h1>
            <button style={BT()} onClick={()=>{setAf(AF0);setMA(true);}}>{Ic.plus} Novo Agendamento</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1.5rem"}}>
            <input type="date" value={agDate} onChange={e=>setAgDate(e.target.value)} style={{...IS,width:"155px"}}/>
            <span style={{fontSize:".82rem",color:"#4a3465"}}>{filteredA.length} agendamento(s)</span>
          </div>
          <div style={CARD}>
            <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"5px 12px",marginBottom:"4px"}}>
              {["Hora","Cliente","Serviço","Status",""].map((h,i)=><span key={i} style={TH}>{h}</span>)}
            </div>
            {filteredA.length===0&&<div style={{color:"#2d1f42",padding:"1rem",fontSize:".82rem"}}>Sem agendamentos para esta data.</div>}
            {filteredA.map(a=>(
              <div key={a.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 1.4fr 120px 36px",gap:"12px",padding:"9px 12px",borderBottom:"1px solid #0e0620",fontSize:".82rem",alignItems:"center"}}>
                <span style={{fontFamily:"monospace",fontWeight:700,color:"#c4a8e8"}}>{a.time}</span>
                <span style={{fontWeight:600}}>{a.client}</span>
                <span style={{color:"#9b7ec4"}}>{a.service}</span>
                <select value={a.status} onChange={e=>updateApptStatus(a.id,e.target.value)}
                  style={{background:"#080412",border:"1px solid #160d2a",borderRadius:"8px",padding:"3px 8px",color:STATUS_C[a.status],fontSize:".75rem",cursor:"pointer"}}>
                  {Object.keys(STATUS_C).map(s=><option key={s}>{s}</option>)}
                </select>
                <button style={{background:"none",border:"none",cursor:"pointer",color:"#3d2055",display:"flex"}} onClick={()=>delAppt(a.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>}

        </>}
      </main>

      {/* ══ MODAL ENTRADA ══ */}
      {mE&&<Modal title="Nova Entrada" onClose={()=>setME(false)}>
        <Field label="Data"><input type="date" style={IS} value={ef.date} onChange={e=>setEf(p=>({...p,date:e.target.value}))}/></Field>
        <Field label="Cliente"><input style={IS} placeholder="Nome da cliente" value={ef.client} onChange={e=>setEf(p=>({...p,client:e.target.value}))}/></Field>
        <Field label="Serviço"><select style={IS} value={ef.service} onChange={e=>setEf(p=>({...p,service:e.target.value}))}>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Valor (R$)"><input type="number" style={IS} placeholder="0,00" value={ef.value} onChange={e=>setEf(p=>({...p,value:e.target.value}))}/></Field>
          <Field label="Pagamento"><select style={IS} value={ef.payment} onChange={e=>setEf(p=>({...p,payment:e.target.value}))}>{PAYMENTS.map(p=><option key={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Observações"><textarea style={{...IS,resize:"vertical",minHeight:"60px"}} placeholder="Opcional..." value={ef.notes} onChange={e=>setEf(p=>({...p,notes:e.target.value}))}/></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setME(false)}>Cancelar</button>
          <button style={BT()} onClick={saveEntry} disabled={saving}>{saving?"Salvando...":"Salvar Entrada"}</button>
        </div>
      </Modal>}

      {/* ══ MODAL SAÍDA ══ */}
      {mX&&<Modal title="Nova Saída" onClose={()=>setMX(false)}>
        <Field label="Data"><input type="date" style={IS} value={xf.date} onChange={e=>setXf(p=>({...p,date:e.target.value}))}/></Field>
        <Field label="Descrição"><input style={IS} placeholder="Ex: Aluguel, henna, curso..." value={xf.description} onChange={e=>setXf(p=>({...p,description:e.target.value}))}/></Field>
        <Field label="Categoria"><select style={IS} value={xf.category} onChange={e=>setXf(p=>({...p,category:e.target.value}))}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Valor (R$)"><input type="number" style={IS} placeholder="0,00" value={xf.value} onChange={e=>setXf(p=>({...p,value:e.target.value}))}/></Field>
          <Field label="Pagamento"><select style={IS} value={xf.payment} onChange={e=>setXf(p=>({...p,payment:e.target.value}))}>{PAYMENTS.map(p=><option key={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Observações"><textarea style={{...IS,resize:"vertical",minHeight:"60px"}} placeholder="Opcional..." value={xf.notes} onChange={e=>setXf(p=>({...p,notes:e.target.value}))}/></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setMX(false)}>Cancelar</button>
          <button style={BT()} onClick={saveExpense} disabled={saving}>{saving?"Salvando...":"Salvar Saída"}</button>
        </div>
      </Modal>}

      {/* ══ MODAL AGENDAMENTO ══ */}
      {mA&&<Modal title="Novo Agendamento" onClose={()=>setMA(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
          <Field label="Data"><input type="date" style={IS} value={af.date} onChange={e=>setAf(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="Horário"><input type="time" style={IS} value={af.time} onChange={e=>setAf(p=>({...p,time:e.target.value}))}/></Field>
        </div>
        <Field label="Cliente"><input style={IS} placeholder="Nome da cliente" value={af.client} onChange={e=>setAf(p=>({...p,client:e.target.value}))}/></Field>
        <Field label="Serviço"><select style={IS} value={af.service} onChange={e=>setAf(p=>({...p,service:e.target.value}))}>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Status"><select style={IS} value={af.status} onChange={e=>setAf(p=>({...p,status:e.target.value}))}>{Object.keys(STATUS_C).map(s=><option key={s}>{s}</option>)}</select></Field>
        <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
          <button style={BT("g")} onClick={()=>setMA(false)}>Cancelar</button>
          <button style={BT()} onClick={saveAppt} disabled={saving}>{saving?"Salvando...":"Agendar"}</button>
        </div>
      </Modal>}
    </div>
  );
}
