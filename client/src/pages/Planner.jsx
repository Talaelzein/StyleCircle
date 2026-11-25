import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import useStyleEntries from '../hooks/useStyleEntries.js';
import useClosetData from '../hooks/useClosetData.js';
import '../styles/styling-studio.css';
import '../styles/collections.css';
const iso=(d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export default function Planner({token,user}){
  const plans=useStyleEntries('plan',token),wears=useStyleEntries('wear',token);
  const {outfits,clothes}=useClosetData(token);
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7)),[day,setDay]=useState(()=>iso(new Date()));
  const [outfitId,setOutfitId]=useState(''),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [year,m]=month.split('-').map(Number);
  const firstDay=new Date(year,m-1,1).getDay(),days=new Date(year,m,0).getDate();
  const daysGrid=Array.from({length:firstDay+days},(_,i)=>i<firstDay?'':String(i-firstDay+1).padStart(2,'0'));
  const current=useMemo(()=>plans.entries.filter(p=>p.date===day),[plans.entries,day]);
  const byId=new Map(outfits.map(o=>[String(o._id),o]));
  async function add(e){e.preventDefault();setError('');setBusy(true);try{
    const look=byId.get(outfitId);
    if(!look)throw Error('Choose a saved outfit first');
    await plans.create({title:title.trim()||look.name,date:day,outfitId});
    setTitle('');setMessage('Outfit planned.');
  }catch(e){setError(e.message)}finally{setBusy(false)}}
  async function markWorn(plan){setError('');setBusy(true);try{
    const outfit=byId.get(String(plan.outfitId));
    if(!outfit)throw Error('Outfit is unavailable');
    const itemIds=(outfit.clothingItemIds||[]).filter(Boolean).map(c=>typeof c==='string'?c:String(c._id));
    await wears.create({title:plan.title,date:plan.date,outfitId:String(plan.outfitId),itemIds});
    await plans.update(plan._id,{completed:true});setMessage('Logged as worn! Wardrobe Insights will include it.');
  }catch(e){setError(e.message)}finally{setBusy(false)}}
  function moveMonth(delta){const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()+delta);const next=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;setMonth(next);setDay(`${next}-01`)}
  return <main className="editorial-page collection-page"><section className="page-heading"><div><p className="eyebrow">STYLECIRCLE CALENDAR</p><h1>Outfit Planner</h1><p>Plan what to wear, log real outfits, and make getting dressed effortless.</p></div><Link className="button-outline" to="/outfits">Your saved outfits</Link></section>
    <div className="collection-two-col"><section className="collection-card"><div className="collection-month"><button type="button" onClick={()=>moveMonth(-1)}>←</button><h2>{new Date(year,m-1,1).toLocaleString('en-US',{month:'long',year:'numeric'})}</h2><button type="button" onClick={()=>moveMonth(1)}>→</button></div><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((d,i)=><b key={i}>{d}</b>)}{daysGrid.map((v,i)=><button type="button" disabled={!v} key={i} className={`${v && day===`${month}-${v}`?'selected':''} ${plans.entries.some(p=>p.date===`${month}-${v}`)?'has-look':''}`} onClick={()=>setDay(`${month}-${v}`)}>{v?Number(v):''}</button>)}</div><p className="collection-help">Dots mark days with planned outfits. Select a day to see or edit its looks.</p></section>
    <section className="collection-card"><p className="eyebrow">SELECTED DAY</p><h2>{day}</h2><h3>Planned looks</h3>{!current.length?<p>No looks planned yet.</p>:<div className="entry-list">{current.map(p=><article key={p._id}><div><strong>{p.title}</strong><small>{p.completed?'✓ Worn':'Planned'}</small></div><div className="entry-actions">{!p.completed&&<button disabled={busy} onClick={()=>markWorn(p)}>Mark worn</button>}<button onClick={()=>plans.remove(p._id)}>Remove</button></div></article>)}</div>}
      <form className="collection-form" onSubmit={add}><h3>Schedule an outfit</h3><label>Saved outfit<select value={outfitId} onChange={e=>setOutfitId(e.target.value)} required><option value="">Choose an outfit</option>{outfits.map(o=><option key={o._id} value={o._id}>{o.name}</option>)}</select></label><label>Event or note (optional)<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Monday lecture, brunch..." maxLength={120}/></label><button className="button-primary" disabled={busy||!outfitId}>Add to {day}</button></form>
      {!outfits.length&&<p><Link to="/outfits">Create a saved outfit</Link> before planning.</p>}{error&&<p role="alert" className="error">{error}</p>}{(plans.error||wears.error)&&<p className="error">{plans.error||wears.error}</p>}{message&&<p role="status">{message}</p>}
    </section></div><p className="collection-help">Your wear history is private to your account. Marking an outfit worn increases its wardrobe usage statistics; planning alone does not.</p></main>
}
