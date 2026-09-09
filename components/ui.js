'use client';
import {useEffect,useState} from 'react';
export function useToast(){
 const [t,setT]=useState(null);
 useEffect(()=>{if(!t)return;const h=setTimeout(()=>setT(null),3200);return()=>clearTimeout(h);},[t]);
 const node=t?<div className="toast" role="status"><b>{t.title}</b>{t.msg}</div>:null;
 return [node,(title,msg)=>setT({title,msg})];
}
export function Tag({c,children}){return <span className={'tag '+c}>{children}</span>;}
export function Stat({k,v,d,color}){return <div className="card stat"><div className="k">{k}</div>
 <div className="v mono" style={color?{color}:undefined}>{v}</div><div className="d">{d}</div></div>;}
export function Table({head,rows}){return <div className="card"><div className="scrollx"><table className="tbl">
 <thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead>
 <tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className={j===0?'k':''}>{c}</td>)}</tr>)}</tbody>
</table></div></div>;}
export function Page({title,sub,children,actions}){return <div className="page">
 <div className="phead"><div><h1>{title}</h1><p className="sub">{sub}</p></div>
  <span className="spacer"/>{actions}</div>{children}</div>;}
