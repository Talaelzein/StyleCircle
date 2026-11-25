import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import useStyleEntries from '../hooks/useStyleEntries.js';
import useClosetData from '../hooks/useClosetData.js';
import '../styles/collections.css';
const pretty=s=>s.charAt(0).toUpperCase()+s.slice(1);
export default function Insights({token}){
  const {clothes,outfits,error:closetError}=useClosetData(token),wears=useStyleEntries('wear',token);
  const categories=useMemo(()=>Object.entries(clothes.reduce((acc,item)=>(acc[item.category]=(acc[item.category]||0)+1,acc),{})).sort((a,b)=>b[1]-a[1]),[clothes]);
  const countById=useMemo(()=>{const counts={};for(const log of wears.entries)for(const id of log.itemIds||[])counts[String(id)]=(counts[String(id)]||0)+1;return counts},[wears.entries]);
  const prices=clothes.filter(i=>typeof i.price==='number'&&i.price>0);
  const total=prices.reduce((sum,i)=>sum+i.price,0);
  const worn=clothes.filter(i=>countById[String(i._id)]>0).length;
  const mostWorn=[...clothes].sort((a,b)=>(countById[String(b._id)]||0)-(countById[String(a._id)]||0)).slice(0,6);
  const topColors=Object.entries(clothes.reduce((acc,i)=>{const c=(i.color||'Unknown').trim().toLowerCase();acc[c]=(acc[c]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return <main className="editorial-page collection-page"><section className="page-heading"><div><p className="eyebrow">WARDROBE INTELLIGENCE</p><h1>Wardrobe Insights</h1><p>Understand what you own, what you wear, and how much value your clothes deliver.</p></div><Link to="/planner" className="button-outline">Plan & log outfits</Link></section>
    <div className="stat-grid">{[['Clothing pieces',clothes.length],['Saved outfits',outfits.length],['Outfits worn',wears.entries.length],['Pieces worn',worn],['Favorites',clothes.filter(i=>i.favorite).length],['Recorded item cost',total.toFixed(2)]].map(([label,value])=><div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <div className="collection-two-col"><section className="collection-card"><h2>Wardrobe composition</h2>{categories.map(([name,count])=><div className="insight-bar" key={name}><span>{pretty(name)}</span><div><i style={{width:`${100*count/Math.max(1,clothes.length)}%`}}/></div><b>{count}</b></div>)}{!categories.length&&<p><Link to="/wardrobe">Add your first item</Link> to see insights.</p>}</section>
    <section className="collection-card"><h2>Colors you wear</h2>{topColors.map(([name,n])=><div className="insight-bar" key={name}><span>{pretty(name)}</span><div><i style={{width:`${100*n/Math.max(1,clothes.length)}%`}}/></div><b>{n}</b></div>)}<p className="collection-help">Color analysis uses the labels you enter when adding clothes.</p></section></div>
    <section className="collection-card"><h2>Cost per wear and wardrobe rotation</h2><p className="collection-help">Currency follows the amounts you enter in My Closet. Cost per wear is item price ÷ the number of times marked worn in Outfit Planner; it is not a predicted cost.</p><div className="entry-list">{mostWorn.map(item=>{const count=countById[String(item._id)]||0;return <article key={item._id}><div><strong>{item.name}</strong><small>{count} recorded wears · {item.category}</small></div><div>{item.price>0&&count>0?`Cost/wear: ${(item.price/count).toFixed(2)}`:count===0?'Not worn yet':'No price set'}</div></article>})}</div></section>
    {(wears.error||closetError)&&<p className="error">{wears.error||closetError}</p>}
  </main>;
}
