"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";

const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0);

export default function Home(){
 const [session,setSession]=useState(null),[authMode,setAuthMode]=useState("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[authBusy,setAuthBusy]=useState(false),[authMsg,setAuthMsg]=useState("");
 const [tab,setTab]=useState("Dashboard"),[sites,setSites]=useState([]),[updates,setUpdates]=useState([]),[expenses,setExpenses]=useState([]),[payments,setPayments]=useState([]),[loading,setLoading]=useState(false);
 const [sf,setSf]=useState({name:"",client_name:"",location:"",contract_amount:""}),[uf,setUf]=useState({site_id:"",work_completed:"",labour_count:"",progress:""}),[ff,setFf]=useState({site_id:"",type:"expense",category:"Materials",amount:"",description:""});

 useEffect(()=>{
   supabase.auth.getSession().then(({data})=>setSession(data.session));
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
   return ()=>subscription.unsubscribe();
 },[]);

 useEffect(()=>{if(session) load();},[session]);

 async function load(){
   setLoading(true);
   const a=await Promise.all([
    supabase.from("sites").select("*").order("created_at",{ascending:false}),
    supabase.from("work_updates").select("*,sites(name)").order("created_at",{ascending:false}),
    supabase.from("expenses").select("*,sites(name)").order("created_at",{ascending:false}),
    supabase.from("payments").select("*,sites(name)").order("created_at",{ascending:false})
   ]);
   setSites(a[0].data||[]);setUpdates(a[1].data||[]);setExpenses(a[2].data||[]);setPayments(a[3].data||[]);setLoading(false);
 }

 async function authenticate(e){
   e.preventDefault();setAuthBusy(true);setAuthMsg("");
   const result=authMode==="login"
    ? await supabase.auth.signInWithPassword({email,password})
    : await supabase.auth.signUp({email,password});
   setAuthBusy(false);
   if(result.error){setAuthMsg(result.error.message);return;}
   if(authMode==="signup") setAuthMsg("Account created. If Supabase asks for email confirmation, confirm your email and then log in.");
 }
 async function logout(){await supabase.auth.signOut();setSites([]);setUpdates([]);setExpenses([]);setPayments([]);}

 async function addSite(e){
   e.preventDefault();
   const p={...sf,contract_amount:+sf.contract_amount||0,created_by:session.user.id};
   const {error}=await supabase.from("sites").insert(p);
   if(error)return alert(error.message);
   setSf({name:"",client_name:"",location:"",contract_amount:""});load();
 }
 async function addUpdate(e){
   e.preventDefault();
   const p={site_id:uf.site_id,work_completed:uf.work_completed,labour_count:+uf.labour_count||0,progress:+uf.progress||0,created_by:session.user.id};
   const {error}=await supabase.from("work_updates").insert(p);
   if(error)return alert(error.message);
   await supabase.from("sites").update({progress:p.progress}).eq("id",p.site_id);
   setUf({site_id:"",work_completed:"",labour_count:"",progress:""});load();
 }
 async function addFinance(e){
   e.preventDefault();
   const p={site_id:ff.site_id,category:ff.category,amount:+ff.amount||0,description:ff.description,created_by:session.user.id};
   const {error}=await supabase.from(ff.type==="expense"?"expenses":"payments").insert(p);
   if(error)return alert(error.message);
   setFf({...ff,amount:"",description:""});load();
 }

 if(!session) return <AuthScreen {...{authMode,setAuthMode,email,setEmail,password,setPassword,authBusy,authMsg,authenticate}}/>;

 const contract=sites.reduce((a,s)=>a+(+s.contract_amount||0),0),ex=expenses.reduce((a,x)=>a+(+x.amount||0),0),pay=payments.reduce((a,x)=>a+(+x.amount||0),0),pl=pay-ex;
 const FormInput=({label,k})=><label>{label}<input required={k!=="contract_amount"} value={sf[k]} onChange={e=>setSf({...sf,[k]:e.target.value})}/></label>;
 return <div className="app">
  <header><div><b>BUILDTRACK</b><small>Construction Site Manager</small></div><div className="userbox"><span>{session.user.email}</span><button onClick={logout}>LOGOUT</button></div></header>
  <nav>{["Dashboard","Sites","Work Updates","Finance"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>
  <main>
   {loading&&<div className="loading">Loading…</div>}
   {tab==="Dashboard"&&<><h1>Dashboard</h1><div className="stats"><Stat l="Active Sites" v={sites.filter(s=>s.status!=="Completed").length}/><Stat l="Contract Value" v={money(contract)}/><Stat l="Expenses" v={money(ex)}/><Stat l="Current P/L" v={money(pl)} c={pl>=0?"green":"red"}/></div><Panel title="Projects">{sites.length?sites.map(s=><Site s={s} key={s.id}/>):<p className="muted">No sites yet. Add your first construction site from Sites.</p>}</Panel></>}
   {tab==="Sites"&&<><h1>Sites</h1><Panel title="Add New Site"><form onSubmit={addSite} className="form"><FormInput label="Site name" k="name"/><FormInput label="Client name" k="client_name"/><FormInput label="Location" k="location"/><FormInput label="Contract amount (₹)" k="contract_amount"/><button className="primary">Save Site</button></form></Panel><Panel title="All Sites">{sites.length?sites.map(s=><Site s={s} key={s.id}/>):<p className="muted">No sites yet.</p>}</Panel></>}
   {tab==="Work Updates"&&<><h1>Work Updates</h1><Panel title="Add Work Update"><form onSubmit={addUpdate} className="form"><select required value={uf.site_id} onChange={e=>setUf({...uf,site_id:e.target.value})}><option value="">Select site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input placeholder="Labour count" type="number" min="0" value={uf.labour_count} onChange={e=>setUf({...uf,labour_count:e.target.value})}/><textarea required placeholder="Work completed" value={uf.work_completed} onChange={e=>setUf({...uf,work_completed:e.target.value})}/><input required placeholder="Progress %" type="number" min="0" max="100" value={uf.progress} onChange={e=>setUf({...uf,progress:e.target.value})}/><button className="primary">Save Update</button></form></Panel><Panel title="Recent Updates">{updates.length?updates.map(u=><div className="item" key={u.id}><b>{u.sites?.name||"Site"}</b><span>{u.progress}% · {u.labour_count} labour</span><p>{u.work_completed}</p></div>):<p className="muted">No work updates yet.</p>}</Panel></>}
   {tab==="Finance"&&<><h1>Finance</h1><div className="stats"><Stat l="Payments" v={money(pay)} c="green"/><Stat l="Expenses" v={money(ex)} c="red"/><Stat l="Current P/L" v={money(pl)} c={pl>=0?"green":"red"}/></div><Panel title="Add Transaction"><form onSubmit={addFinance} className="form"><select required value={ff.site_id} onChange={e=>setFf({...ff,site_id:e.target.value})}><option value="">Select site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={ff.type} onChange={e=>setFf({...ff,type:e.target.value})}><option value="expense">Expense</option><option value="payment">Payment</option></select><input placeholder="Category" value={ff.category} onChange={e=>setFf({...ff,category:e.target.value})}/><input required placeholder="Amount" type="number" min="0" value={ff.amount} onChange={e=>setFf({...ff,amount:e.target.value})}/><input placeholder="Description" value={ff.description} onChange={e=>setFf({...ff,description:e.target.value})}/><button className="primary">Save Transaction</button></form></Panel></>}
  </main>
 </div>
}
function AuthScreen({authMode,setAuthMode,email,setEmail,password,setPassword,authBusy,authMsg,authenticate}){return <div className="auth"><div className="authcard"><b className="brand">BUILDTRACK</b><h1>{authMode==="login"?"Welcome back":"Create your account"}</h1><p>Construction Site Manager</p><form onSubmit={authenticate}><input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input required minLength="6" type="password" placeholder="Password (6+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary" disabled={authBusy}>{authBusy?"Please wait…":authMode==="login"?"Login":"Create Account"}</button></form>{authMsg&&<div className="authmsg">{authMsg}</div>}<button className="linkbtn" onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setAuthMsg("")}}>{authMode==="login"?"New user? Create an account":"Already have an account? Login"}</button></div></div>}
function Stat({l,v,c=""}){return <div className="stat"><small>{l}</small><strong className={c}>{v}</strong></div>}
function Panel({title,children}){return <section className="panel"><h2>{title}</h2>{children}</section>}
function Site({s}){return <div className="site"><div className="row"><div><b>{s.name}</b><small>{s.client_name} · {s.location}</small></div><em>{s.status}</em></div><div className="bar"><i style={{width:(s.progress||0)+"%"}}/></div><div className="row"><small>{s.progress||0}% complete</small><b>{money(s.contract_amount)}</b></div></div>}
