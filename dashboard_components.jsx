// ═══════════════════════════════════════════════════════════
// لوحة المعلومات البصرية (Dashboard) — رسوم SVG خفيفة بلا مكتبات
// ═══════════════════════════════════════════════════════════

// بطاقة مؤشّر علوية (KPI)
function KpiCard({ label, value, sub, color, icon, trend }) {
  return (
  <div style={{background:"#fff",border:`1px solid ${color}22`,borderRadius:18,padding:"16px 18px",boxShadow:`0 6px 20px ${color}10`,position:"relative",overflow:"hidden"}}>
   <div style={{position:"absolute",top:-18,left:-18,width:70,height:70,borderRadius:"50%",background:`${color}0D`}}/>
   <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,position:"relative"}}>
   <div style={{width:34,height:34,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{icon}</div>
   <div style={{fontSize:11,color:"#5B7A9E",fontWeight:700,lineHeight:1.3}}>{label}</div>
   </div>
   <div style={{fontSize:28,fontWeight:900,color:color,fontFamily:MONO,lineHeight:1,position:"relative"}}>{value}</div>
   {sub&&<div style={{fontSize:10,color:"#8CA3BD",marginTop:6}}>{sub}</div>}
  </div>
  );
}

// رسم حلقي (Donut) — value 0..100
function DonutChart({ percent, color, label, sub, size=140 }) {
  const r = size/2 - 14, cx = size/2, cy = size/2, circ = 2*Math.PI*r;
  const pct = Math.max(0,Math.min(100,percent||0));
  const dash = (pct/100)*circ;
  return (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
   <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
   <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF4FB" strokeWidth={12}/>
   <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
    strokeDasharray={`${dash} ${circ-dash}`} style={{transition:"stroke-dasharray 0.6s ease"}}/>
   </svg>
   <div style={{marginTop:-size/2-8,marginBottom:size/2-24,textAlign:"center",transform:"translateY("+(size/2-14)+"px)"}}>
   <div style={{fontSize:size*0.2,fontWeight:900,color:color,fontFamily:MONO,lineHeight:1}}>{Math.round(pct)}<span style={{fontSize:size*0.11}}>%</span></div>
   </div>
   {label&&<div style={{fontSize:12,fontWeight:800,color:"#15385C",marginTop:2}}>{label}</div>}
   {sub&&<div style={{fontSize:10,color:"#8CA3BD",marginTop:1}}>{sub}</div>}
  </div>
  );
}

// رسم أعمدة أفقية (لكل فرع/وحدة)
function HBarChart({ data, color, maxOverride, unit="%" }) {
  const max = maxOverride || Math.max(1,...data.map(d=>d.value));
  return (
  <div style={{display:"flex",flexDirection:"column",gap:9}}>
   {data.map((d,i)=>(
   <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
   <div style={{width:110,fontSize:11,color:"#5B7A9E",fontWeight:700,textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={d.label}>{d.label}</div>
   <div style={{flex:1,height:22,background:"#F4F9FE",borderRadius:8,overflow:"hidden",position:"relative"}}>
   <div style={{height:"100%",width:`${(d.value/max)*100}%`,background:`linear-gradient(90deg,${d.color||color},${d.color||color}bb)`,borderRadius:8,transition:"width 0.6s ease",minWidth:d.value>0?4:0}}/>
   </div>
   <div style={{width:52,fontSize:12,fontWeight:900,color:d.color||color,fontFamily:MONO,textAlign:"left"}}>{typeof d.value==="number"?(unit==="%"?Math.round(d.value):d.value.toLocaleString("en-US")):d.value}{unit==="%"?"%":""}</div>
   </div>
   ))}
   {data.length===0&&<div style={{textAlign:"center",padding:16,color:"#8CA3BD",fontSize:11}}>لا بيانات</div>}
  </div>
  );
}

// رسم أعمدة عمودية (توزيع)
function VBarChart({ data, height=150 }) {
  const max = Math.max(1,...data.map(d=>d.value));
  return (
  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-around",gap:8,height,padding:"0 4px"}}>
   {data.map((d,i)=>(
   <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%",justifyContent:"flex-end"}}>
   <div style={{fontSize:12,fontWeight:900,color:d.color,fontFamily:MONO}}>{d.value}</div>
   <div style={{width:"100%",maxWidth:46,height:`${(d.value/max)*100}%`,minHeight:d.value>0?6:0,background:`linear-gradient(180deg,${d.color},${d.color}aa)`,borderRadius:"8px 8px 0 0",transition:"height 0.6s ease"}}/>
   <div style={{fontSize:9,color:"#5B7A9E",fontWeight:700,textAlign:"center",lineHeight:1.2}}>{d.label}</div>
   </div>
   ))}
  </div>
  );
}

// رسم خطّي بسيط (اتجاه) — points: [{x,y}]
function LineChart({ series, height=140, color="#2E7FB8", labels }) {
  const w=320, pad=10;
  const all=series.flatMap(s=>s.values);
  const max=Math.max(1,...all), min=Math.min(0,...all);
  const range=max-min||1;
  const xStep=(w-pad*2)/Math.max(1,(series[0]?.values.length||1)-1);
  const toXY=(v,i)=>[pad+i*xStep, height-pad-((v-min)/range)*(height-pad*2)];
  return (
  <svg viewBox={`0 0 ${w} ${height}`} style={{width:"100%",height}}>
   {[0.25,0.5,0.75].map((f,i)=><line key={i} x1={pad} y1={pad+f*(height-pad*2)} x2={w-pad} y2={pad+f*(height-pad*2)} stroke="#EEF4FB" strokeWidth={1}/>)}
   {series.map((s,si)=>{
   const pts=s.values.map((v,i)=>toXY(v,i));
   const path=pts.map((p,i)=>(i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
   const area=path+` L${pts[pts.length-1][0].toFixed(1)},${height-pad} L${pts[0][0].toFixed(1)},${height-pad} Z`;
   return (<g key={si}>
    <path d={area} fill={`${s.color||color}12`}/>
    <path d={path} fill="none" stroke={s.color||color} strokeWidth={2.5} strokeLinejoin="round"/>
    {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={3} fill={s.color||color}/>)}
   </g>);
   })}
  </svg>
  );
}

// قسم رسم بعنوان
function ChartCard({ title, icon, color, children, right, span }) {
  return (
  <div style={{background:"#fff",border:"1px solid #E8F0F9",borderRadius:18,padding:18,boxShadow:"0 4px 16px rgba(46,127,184,0.06)",gridColumn:span?`span ${span}`:undefined}}>
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
   <div style={{display:"flex",alignItems:"center",gap:8}}>
   <span style={{fontSize:16}}>{icon}</span>
   <span style={{fontSize:13,fontWeight:900,color:"#15385C"}}>{title}</span>
   </div>
   {right}
   </div>
   {children}
  </div>
  );
}
