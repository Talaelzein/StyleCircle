import {useEffect,useState} from 'react';
import {API_URL,getResponseData} from '../services/api.js';
export default function useClosetData(token){
  const [clothes,setClothes]=useState([]),[outfits,setOutfits]=useState([]),[error,setError]=useState('');
  useEffect(()=>{
    const c=new AbortController(),headers={Authorization:`Bearer ${token}`};
    Promise.all([
      fetch(`${API_URL}/api/clothing-items`,{headers,signal:c.signal}).then(getResponseData),
      fetch(`${API_URL}/api/outfits`,{headers,signal:c.signal}).then(getResponseData)
    ]).then(([a,b])=>{setClothes(a.items||[]);setOutfits(b.outfits||[])})
      .catch(e=>{if(!c.signal.aborted)setError(e.message)});
    return ()=>c.abort();
  },[token]);
  return {clothes,outfits,error};
}
