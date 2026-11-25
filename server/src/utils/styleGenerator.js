// StyleCircle's rule-based stylist. This does not claim to use an AI model.
const normalize = value => String(value || '').trim().toLowerCase();
const CATEGORY_ORDER = ['top','bottom','dress','outerwear','shoes','bag','accessory'];
const NEUTRAL = ['white','black','beige','cream','tan','brown','gray','grey','navy','denim','ivory','khaki'];
const HARMONIES = [['blue','brown'],['blue','beige'],['blue','white'],['burgundy','cream'],['pink','brown'],['green','beige'],['olive','cream'],['red','black'],['purple','yellow'],['blue','orange']];
const isNeutral = color => NEUTRAL.some(x => normalize(color).includes(x));
const hasWord = (haystack, needle) => {
  const a = normalize(haystack); const b = normalize(needle);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
};
const colorsMatch = (a,b) => {
  const x=normalize(a),y=normalize(b);
  if(!x || !y) return 0.65;
  if(x===y || isNeutral(x) || isNeutral(y)) return 1;
  if(HARMONIES.some(([m,n]) => (x.includes(m)&&y.includes(n))||(x.includes(n)&&y.includes(m)))) return 1;
  return 0.35;
};
const weatherTags = weather => {
  const w=normalize(weather);
  if(['hot','warm'].includes(w)) return ['summer','spring','light','linen','cotton','breathable'];
  if(['cold','chilly'].includes(w)) return ['winter','fall','autumn','warm','knit','wool'];
  return ['spring','autumn','fall','all','cotton','denim','linen','light'];
};
const likelyUnsuitable = (item, preferences) => {
  const weather=normalize(preferences.weather), occasion=normalize(preferences.occasion), style=normalize(preferences.style);
  const joined=normalize([item.name,item.material,item.style,item.occasion,item.season].join(' '));
  if ((weather==='hot'||weather==='warm') && /winter|heavy coat|thick wool|fleece|snow boot/.test(joined)) return true;
  if (weather==='cold' && /beach|swimwear|bikini|flip flop/.test(joined)) return true;
  if (/university|school|class/.test(occasion) && /swimwear|bikini|evening gown|wedding gown|formal dress/.test(joined)) return true;
  if(style==='casual' && /black tie|ball gown/.test(joined)) return true;
  return false;
};
const orderItems = items => [...items].sort((a,b) => CATEGORY_ORDER.indexOf(a.category)-CATEGORY_ORDER.indexOf(b.category));
const signature = items => orderItems(items).map(i=>String(i._id)).join(':');

export function scoreStyleOutfit(items, preferences={}) {
  const colorPairs=[];
  for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++) colorPairs.push(colorsMatch(items[i].color,items[j].color));
  const color = Math.round(25*(colorPairs.length ? colorPairs.reduce((s,v)=>s+v,0)/colorPairs.length : 0.65));
  const occasion=normalize(preferences.occasion);
  const style=normalize(preferences.style);
  const weather=normalize(preferences.weather);
  const season=normalize(preferences.season);
  const assess=(field,query,max,otherwise=0.65)=>{
    if(!query) return max*otherwise;
    const checked=items.filter(item=>normalize(item[field]));
    if(!checked.length) return max*0.6;
    const hits=checked.filter(item=>hasWord(item[field],query)).length;
    return max*(0.25+0.75*hits/checked.length);
  };
  const occasionScore=assess('occasion',occasion,25);
  const styleScore=assess('style',style,20);
  const matchingWeather=weatherTags(weather);
  const known=items.filter(i=>i.season || i.material);
  const weatherMatch=known.filter(i=>matchingWeather.some(t=>hasWord(i.season,t)||hasWord(i.material,t))).length;
  const weatherScore=Math.round(20*(known.length?0.4+0.6*(weatherMatch/known.length):0.65));
  const seasonMatches=!season || items.every(i=>!i.season||hasWord(i.season,season));
  const variety = Math.max(0,10-(items.some(i=>likelyUnsuitable(i,preferences))?8:0)-(seasonMatches?0:3));
  let total=Math.round(color+occasionScore+weatherScore+styleScore+variety);
  total=Math.max(0,Math.min(100,total));
  const reasons=[];
  if(color>=18) reasons.push('Coordinated colors');
  if(occasion && occasionScore>=17) reasons.push(`Suitable for ${preferences.occasion}`);
  if(style && styleScore>=14) reasons.push(`${preferences.style} style match`);
  if(weather && weatherScore>=13) reasons.push(`Works for ${preferences.weather} weather`);
  if(!reasons.length) reasons.push('Complementary wardrobe categories');
  return { score:total, reason:reasons.join(' · ') };
}

function variations(base, buckets, preferences, locked=[]) {
  // Add optional accents in a controlled way. No duplicate categories.
  const baseCats=new Set(base.map(i=>i.category));
  const candidates=(cat)=>{
    if(baseCats.has(cat)) return [null];
    const pinned=locked.find(item=>item.category===cat);
    if(pinned) return [pinned];
    return [null,...(buckets[cat]||[]).filter(i=>!likelyUnsuitable(i,preferences)).slice(0,5)];
  };
  const shoes=candidates('shoes'), outerwear=candidates('outerwear');
  const bags=candidates('bag');
  const result=[];
  for(const shoe of shoes) for(const outer of outerwear) for(const bag of bags){
    const clothing=[...base,...[shoe,outer,bag].filter(Boolean)];
    result.push(clothing);
    if(result.length>=140) return result;
  }
  return result;
}

export function generateStyleLooks(clothes, preferences={}, lockedIds=[], excludeSignatures=[], limit=3) {
  const present = (clothes||[]).filter(i=>i && !likelyUnsuitable(i,preferences));
  const byId=new Map(present.map(i=>[String(i._id),i]));
  const locked=lockedIds.map(id=>byId.get(String(id)));
  if(locked.some(v=>!v)) return { looks:[], error:'A locked item is missing or not suitable for these conditions' };
  if(new Set(locked.map(i=>i.category)).size!==locked.length) return { looks:[], error:'Lock only one item per clothing category' };
  if(locked.some(i=>i.category==='dress') && locked.some(i=>['top','bottom'].includes(i.category))) return { looks:[], error:'A dress cannot be locked with a separate top or bottom' };
  const buckets=Object.fromEntries(CATEGORY_ORDER.map(cat=>[cat,present.filter(i=>i.category===cat)]));
  const basic=[];
  for(const t of buckets.top.slice(0,40)) for(const b of buckets.bottom.slice(0,40)) basic.push([t,b]);
  for(const d of buckets.dress.slice(0,40)) basic.push([d]);
  const exclude=new Set(excludeSignatures);
  const seen=new Set();
  const candidates=[];
  for(const pair of basic) {
    const valid=locked.every(item=>pair.some(p=>String(p._id)===String(item._id)) || !['top','bottom','dress'].includes(item.category));
    if(!valid) continue;
    // At least two distinct pieces are needed for saved outfits.
    const optional=variations(pair,buckets,preferences,locked);
    for(const items of optional){
      if(items.length<2 || items.length>10 || locked.some(item=>!items.some(x=>String(x._id)===String(item._id)))) continue;
      const sig=signature(items);
      if(seen.has(sig)||exclude.has(sig)) continue;
      seen.add(sig);
      const result=scoreStyleOutfit(items,preferences);
      candidates.push({
        signature:sig, clothingItemIds:orderItems(items).map(i=>String(i._id)),
        items:orderItems(items).map(i=>({ _id:String(i._id),name:i.name,category:i.category,color:i.color||'',imagePublicId:i.imagePublicId||null,imageUrl:i.imageUrl||null })),
        ...result
      });
    }
  }
  if(!candidates.length) return {looks:[],error:'Add compatible clothing categories, or unlock some items to make more outfits'};
  candidates.sort((a,b)=>b.score-a.score);
  const top=candidates.slice(0,Math.min(45,candidates.length));
  const selected=[];
  while(selected.length<limit && top.length){
    // Weighted toward high quality without returning the exact same top look.
    const weights=top.map(v=>Math.max(1,(v.score-35)**2));
    const total=weights.reduce((s,v)=>s+v,0);let pick=Math.random()*total;let index=0;
    for(;index<weights.length-1;index++){pick-=weights[index];if(pick<=0)break;}
    selected.push(top.splice(index,1)[0]);
  }
  return { looks:selected,error:null,available:candidates.length };
}

export function replaceStylePiece(clothes,currentIds,category,lockedIds,preferences={}) {
  const byId=new Map((clothes||[]).map(i=>[String(i._id),i]));
  const current=currentIds.map(id=>byId.get(String(id)));
  if(current.some(v=>!v)) return {error:'An outfit item was deleted'};
  const target=current.find(i=>i.category===category);
  if(!target) return {error:'This look does not contain that category'};
  if(lockedIds.map(String).includes(String(target._id))) return {error:'Unlock this piece before replacing it'};
  const alternatives=(clothes||[])
    .filter(i=>i.category===category && String(i._id)!==String(target._id) && !likelyUnsuitable(i,preferences))
    .map(item=>{
      const items=current.map(old=>old===target?item:old);
      return {items,signature:signature(items), ...scoreStyleOutfit(items,preferences)};
    }).sort((a,b)=>b.score-a.score);
  if(!alternatives.length) return {error:`Add another ${category} item to My Closet first`};
  const pool=alternatives.slice(0,5);
  const candidate=pool[Math.floor(Math.random()*pool.length)];
  const items=orderItems(candidate.items);
  return {look:{signature:candidate.signature,clothingItemIds:items.map(i=>String(i._id)),items:items.map(i=>({_id:String(i._id),name:i.name,category:i.category,color:i.color||'',imagePublicId:i.imagePublicId||null,imageUrl:i.imageUrl||null})),score:candidate.score,reason:candidate.reason}};
}
