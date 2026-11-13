/* NULL ALIBI mini SQL engine — real in-memory relational evaluation.
   Classic script, zero deps, file:// safe. Exposes window.NA_ENGINE.
   Supports: SELECT cols|* FROM t [JOIN t2 ON a=b] [WHERE c AND...]
   [ORDER BY c [DESC]] [LIMIT n]. DDL/writes are NOT executed here —
   the validator contains them first (see dangerous() in page). */
(function(){
"use strict";
const DB={
 exhibits:[
  {id:1,name:"Capstone rig",location:"Lab",status:"missing"},
  {id:2,name:"Exhibit poster",location:"Hall",status:"found"},
  {id:3,name:"Survey drone",location:"Lab",status:"missing"},
  {id:4,name:"Field journal",location:"Archive",status:"found"}
 ],
 students:[
  {id:1,name:"Rain",role:"lab aide",last_seen:"21:10"},
  {id:2,name:"Will",role:"exhibitor",last_seen:"21:35"},
  {id:3,name:"Jhade",role:"guard",last_seen:"21:30"}
 ],
 access_logs:[
  {id:1,badge:"R",door:"Lab",time:"21:10"},
  {id:2,badge:"W",door:"Lab",time:"21:38"},
  {id:3,badge:"J",door:"Gate",time:"21:30"},
  {id:4,badge:"W",door:"Hall",time:"21:41"}
 ]
};
function tbl(n){return DB[n.toLowerCase()]||null}
function col(row,key){
 if(key in row)return row[key];
 const k=key.split(".").pop();
 for(const f in row)if(f===k||f.endsWith("."+k))return row[f];
 return undefined;
}
function cmp(a,op,b){
 a=(a===undefined||a===null)?"":String(a);
 if(op==="=")return a===b; if(op==="!="||op==="<>" )return a!==b;
 if(op===">")return a>b; if(op==="<")return a<b;
 if(op==="LIKE"){const re=new RegExp("^"+b.replace(/%/g,".*")+"$","i");return re.test(a)}
 return false;
}
function parseWhere(s){
 return s.split(/\s+AND\s+/i).map(p=>{
  let m=p.match(/^([\w.]+)\s*(=|!=|<>|>|<|LIKE)\s*('([^']*)'|"([^"]*)"|(\S+))$/i);
  if(!m)throw "WHERE clause not understood: "+p;
  const v=m[4]!==undefined?m[4]:(m[5]!==undefined?m[5]:m[6]);
  return {c:m[1],op:m[2].toUpperCase(),v};
 });
}
function parse(sql){
 const q=sql.trim().replace(/\s+/g," ").replace(/;$/,"");
 const m=q.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(.*)$/i);
 if(!m)throw "Start with: SELECT … FROM …";
 const out={cols:m[1].trim(),from:m[2].toLowerCase(),rest:m[3]||""};
 let r=out.rest,joins=[],jm=r.match(/\s+JOIN\s+(\w+)\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/i);
 while(jm){joins.push({t:jm[1].toLowerCase(),l:jm[2],r:jm[3]});r=r.slice(jm.index+jm[0].length);jm=r.match(/\s+JOIN\s+(\w+)\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/i)}
 out.joins=joins;
 let wm=r.match(/\s+WHERE\s+(.+?)(\s+ORDER\s+BY\s+|\s+LIMIT\s+|$)/i);
 out.where=wm?wm[1]:"";
 let om=r.match(/\s+ORDER\s+BY\s+([\w.]+)(\s+DESC)?/i);
 out.order=om?{c:om[1],d:!!om[2]}:null;
 let lm=r.match(/\s+LIMIT\s+(\d+)/i);
 out.limit=lm?+lm[1]:0;
 return out;
}
function run(sql){
 let p;try{p=parse(sql)}catch(e){return{ok:false,error:String(e)}}
 let base=tbl(p.from);if(!base)return{ok:false,error:"Unknown table: "+p.from};
 let rows=base.map(r=>{const o={};for(const k in r)o[p.from+"."+k]=r[k];return o});
 for(const j of p.joins){
  const t2=tbl(j.t);if(!t2)return{ok:false,error:"Unknown table: "+j.t};
  const nx=[];
  rows.forEach(a=>t2.forEach(b=>{
   const o2={};for(const k in b)o2[j.t+"."+k]=b[k];
   if(String(col(a,j.l))===String(col(Object.assign({},a,o2),j.r)))nx.push(Object.assign({},a,o2));
  }));
  rows=nx;
 }
 if(p.where){let conds;try{conds=parseWhere(p.where)}catch(e){return{ok:false,error:String(e)}}
  rows=rows.filter(r=>conds.every(c=>cmp(col(r,c.c),c.op,c.v)))}
 if(p.order){const k=p.order.c,d=p.order.d? -1:1;
  rows=rows.slice().sort((a,b)=>String(col(a,k))<String(col(b,k))?-d:(String(col(a,k))>String(col(b,k))?d:0))}
 if(p.limit)rows=rows.slice(0,p.limit);
 if(rows.length>50)return{ok:false,error:"50-row cap hit — add WHERE or LIMIT."};
 let cols;
 if(p.cols==="*"){cols=rows.length?Object.keys(rows[0]).map(k=>k.split(".").pop()):[]}
 else cols=p.cols.split(",").map(s=>s.trim()).filter(Boolean);
 const grid=rows.map(r=>cols.map(c=>{const v=col(r,c);return v===undefined?"NULL":v}));
 return{ok:true,cols,rows:grid,count:grid.length,
  mission:(p.from==="exhibits"&&p.cols==="*"&&!p.where&&!p.joins.length&&grid.length===4)?"M1":
   (p.from==="exhibits"&&/lab/i.test(p.where||"")&&grid.length===2)?"M2":
   (p.joins.length&&p.joins.some(j=>j.t==="access_logs")&&JSON.stringify(grid).includes("21:38"))?"M3":null};
}
function schema(){const o={};for(const t in DB)o[t]=Object.keys(DB[t][0]);return o}
window.NA_ENGINE={run,schema,tables:()=>Object.keys(DB)};
})();
