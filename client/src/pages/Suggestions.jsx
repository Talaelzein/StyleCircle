import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ClothingPreview from '../components/ClothingPreview.jsx';
import { API_URL, getResponseData } from '../services/api.js';
import useDraftState from '../hooks/useDraftState.js';
import '../styles/styling-studio.css';

const defaults = { occasion:'University', weather:'mild', style:'Casual', season:'' };
const pretty = v => v.charAt(0).toUpperCase()+v.slice(1);
const SELECT_OPTIONS = { occasion:['University','Work','Everyday','Dinner','Party','Travel','Beach','Formal'], style:['Casual','Chic','Elegant','Sporty','Streetwear','Minimal','Formal'], weather:['mild','hot','cold','chilly'] };
export default function Suggestions({token,user}) {
  const navigate=useNavigate();
  const prefix=`stylecircle-draft:${user.id}:stylistV2`;
  const [preferences,setPreferences]=useDraftState(`${prefix}:prefs`,defaults);
  const [locks,setLocks]=useDraftState(`${prefix}:locks`,[]);
  const [looks,setLooks]=useDraftState(`${prefix}:looks`,[]);
  const [savedIds,setSavedIds]=useDraftState(`${prefix}:saved`,{});
  const [names,setNames]=useDraftState(`${prefix}:names`,{});
  const [clothes,setClothes]=useState([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [history,setHistory]=useState([]);
  const headers={Authorization:`Bearer ${token}`};

  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${API_URL}/api/clothing-items`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(getResponseData).then(d=>setClothes(d.items||[]))
      .catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return ()=>controller.abort();
  },[token]);
  const byId=new Map(clothes.map(i=>[String(i._id),i]));
  const selectedLocks=locks.map(id=>byId.get(id)).filter(Boolean);
  async function api(path,body){
    const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return getResponseData(response);
  }
  function toggleLock(id){
    setLocks(current=>current.includes(id)?current.filter(x=>x!==id):[...current.filter(x=>byId.get(x)?.category!==byId.get(id)?.category),id]);
  }
  async function generate(){
    setError('');setMessage('');setLoading(true);
    try{
      const excludeSignatures=[...new Set([...history,...looks.map(l=>l.signature)])].slice(-60);
      let d=await api('/api/suggestions/generate',{preferences,lockedItemIds:locks,excludeSignatures,limit:3});
      if(!d.looks?.length && excludeSignatures.length) d=await api('/api/suggestions/generate',{preferences,lockedItemIds:locks,excludeSignatures:[],limit:3});
      if(!d.looks?.length){setError(d.error||'Add a compatible top and bottom, or a dress with another item.');return;}
      setHistory(excludeSignatures);
      setLooks(d.looks);setSavedIds({});setNames({});
      setMessage(`Found ${d.looks.length} coordinated outfit ideas. Lock any piece to keep it next time.`);
    }catch(e){setError(e.message)}finally{setLoading(false)}
  }
  async function replace(index,category){
    setBusy(`${index}:${category}`);setError('');setMessage('');
    try{
      const data=await api('/api/suggestions/replace',{preferences,clothingItemIds:looks[index].clothingItemIds,category,lockedItemIds:locks});
      setLooks(current=>current.map((l,i)=>i===index?data.look:l));
      setSavedIds(current=>({...current,[index]:null}));
    }catch(e){setError(e.message)}finally{setBusy('')}
  }
  async function saveLook(index){
    if(savedIds[index])return savedIds[index];
    const look=looks[index];
    const name=(names[index]||`StyleCircle Look ${index+1}`).trim();
    const d=await api('/api/outfits',{name,occasion:preferences.occasion,notes:`Generated for ${preferences.style} style and ${preferences.weather} weather. Match: ${look.score}/100.`,clothingItemIds:look.clothingItemIds});
    setSavedIds(current=>({...current,[index]:d.outfit._id}));
    return d.outfit._id;
  }
  async function save(index){setBusy(`save:${index}`);setError('');try{await saveLook(index);setMessage('Outfit saved in Outfit Builder.')}catch(e){setError(e.message)}finally{setBusy('')}}
  async function compare(){
    if(looks.length<2) return;
    setBusy('compare');setError('');
    try{
      const a=await saveLook(0);
      const b=await saveLook(1);
      sessionStorage.setItem(`stylecircle-draft:${user.id}:fitcheck:question`,JSON.stringify('Which StyleCircle look should I wear?'));
      sessionStorage.setItem(`stylecircle-draft:${user.id}:fitcheck:outfitA`,JSON.stringify(a));
      sessionStorage.setItem(`stylecircle-draft:${user.id}:fitcheck:outfitB`,JSON.stringify(b));
      navigate(`/fitchecks?lookA=${a}&lookB=${b}`);
    }catch(e){setError(e.message)}finally{setBusy('')}
  }
  return <main className="editorial-page styling-page">
    <section className="page-heading"><div><p className="eyebrow">STYLECIRCLE STYLING STUDIO</p><h1>Mix, Match & Discover</h1><p>Your personal stylist combines your real wardrobe into complete looks with a little creative variety.</p></div><Link className="button-outline" to="/wardrobe">Browse My Closet</Link></section>
    <section className="studio-panel">
      <div className="section-heading"><div><p className="eyebrow">STYLE DIRECTION</p><h2>Dress for your day.</h2></div></div>
      <div className="studio-form-grid">
        {['occasion','weather','style'].map(field=><label key={field}>{pretty(field)}<select value={preferences[field]} onChange={e=>setPreferences(s=>({...s,[field]:e.target.value}))}>{SELECT_OPTIONS[field].map(option=><option key={option} value={option}>{pretty(option)}</option>)}</select></label>)}
        <label>Season (optional)<input value={preferences.season} onChange={e=>setPreferences(s=>({...s,season:e.target.value}))} placeholder="Spring, Autumn, Summer..." maxLength={40}/></label>
      </div>
      <div className="studio-locks"><h3>Lock pieces you love <span>({locks.length} locked)</span></h3><p>Tap the lock on a piece. Shuffle and replace will never change locked items.</p>
        {!clothes.length?<p>Start by <Link to="/wardrobe">adding clothes to My Closet</Link>.</p>:<div className="studio-mini-grid">{clothes.map(item=><button className={`studio-mini-item ${locks.includes(String(item._id))?'is-locked':''}`} key={item._id} onClick={()=>toggleLock(String(item._id))} type="button"><ClothingPreview item={item} token={token} size={74}/><span><strong>{item.name}</strong><small>{pretty(item.category)}</small></span><b>{locks.includes(String(item._id))?'🔒':'○'}</b></button>)}</div>}
      </div>
      <div className="studio-actions"><button className="button-primary" type="button" disabled={loading||busy!==''} onClick={generate}>{loading?'Styling your looks…':looks.length?'↻ Shuffle Again':'✦ Generate My Looks'}</button>{locks.length>0&&<button className="button-outline" type="button" onClick={()=>setLocks([])}>Unlock All</button>}</div>
      {selectedLocks.length>0&&<p className="studio-muted">Locked: {selectedLocks.map(x=>x.name).join(', ')}</p>}
      {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    </section>
    {!!looks.length&&<section className="studio-results"><div className="section-heading"><div><p className="eyebrow">CURATED FROM YOUR CLOSET</p><h2>Your new looks</h2></div>{looks.length>=2&&<button className="button-outline" disabled={busy!==''} onClick={compare}>Compare Looks 1 & 2 in FitCheck</button>}</div>
      <div className="studio-look-grid">{looks.map((look,index)=><article className="studio-look" key={`${look.signature}:${index}`}>
        <div className="studio-look-heading"><h3>Look {index+1}</h3><span>{look.score}/100 match</span></div>
        <p>{look.reason}</p>
        <div className="studio-piece-list">{look.items.map(item=><div className="studio-piece" key={item._id}><ClothingPreview item={item} token={token} size={93}/><div><strong>{item.name}</strong><small>{pretty(item.category)} · {item.color||'Color not specified'}</small><div className="studio-piece-actions"><button type="button" onClick={()=>toggleLock(item._id)}>{locks.includes(item._id)?'🔒 Locked':'Lock'}</button><button type="button" disabled={busy!==''||locks.includes(item._id)} onClick={()=>replace(index,item.category)}>↻ Replace {pretty(item.category)}</button></div></div></div>)}</div>
        <label>Save as<input value={names[index]??`StyleCircle Look ${index+1}`} onChange={e=>setNames(s=>({...s,[index]:e.target.value}))} maxLength={80}/></label>
        <button className="button-primary" type="button" disabled={busy!==''||Boolean(savedIds[index])} onClick={()=>save(index)}>{savedIds[index]?'✓ Saved to Outfits':busy===`save:${index}`?'Saving…':'Save This Look'}</button>
      </article>)}</div>
    </section>}
    <p className="studio-footnote">StyleCircle's stylist uses wardrobe categories, color harmony, weather suitability, occasions, style tags and controlled randomness. Recommendations are rule-based, not guaranteed fashion judgments. For the best suggestions, label your garments accurately.</p>
  </main>;
}
