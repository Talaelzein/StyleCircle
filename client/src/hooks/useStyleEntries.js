import {useCallback,useEffect,useState} from 'react';
import {API_URL,getResponseData} from '../services/api.js';
export default function useStyleEntries(kind,token){
  const [entries,setEntries]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const request=useCallback(async(method,path,body)=>{
    const response=await fetch(`${API_URL}/api/entries${path}`,{
      method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    if(response.status===204) return {};
    return getResponseData(response);
  },[token]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{const d=await request('GET',`?kind=${encodeURIComponent(kind)}`);setEntries(d.entries||[]);setError('')}
    catch(e){setError(e.message)}finally{setLoading(false)}
  },[kind,request]);
  useEffect(()=>{refresh()},[refresh]);
  async function create(data){const d=await request('POST','/',{...data,kind});setEntries(old=>[d.entry,...old]);return d.entry;}
  async function update(id,data){const d=await request('PATCH',`/${id}`,data);setEntries(old=>old.map(e=>e._id===id?d.entry:e));return d.entry;}
  async function remove(id){await request('DELETE',`/${id}`);setEntries(old=>old.filter(e=>e._id!==id));}
  return {entries,loading,error,refresh,create,update,remove};
}
