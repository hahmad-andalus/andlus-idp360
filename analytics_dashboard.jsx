// ═══════════════════════════════════════════════════════════
// AnalyticsDashboard — لوحة معلومات ذكية تتكيّف مع النطاق
// scope: مصفوفة المستخدمين ضمن نطاق الحساب
// mode: "growth" | "eval"
// ═══════════════════════════════════════════════════════════
function AnalyticsDashboard({ scope, evals, idps, impactData, unitLabel="فرع", getUnit }) {
  const [mode,setMode] = useState("growth");
  const [unitFilter,setUnitFilter] = useState("");

  // تحديد وحدة كل شخص (فرع أو إدارة)
  const unitOf = getUnit || ((u)=>u.branch||"—");
  const units = [...new Set((scope||[]).map(unitOf).filter(Boolean))].sort();
  const visScope = (scope||[]).filter(u=>!unitFilter||unitOf(u)===unitFilter);
  const n = visScope.length;

  // ═══ حسابات التطور المهني ═══
  const growthStats = useMemo(()=>{
   const planned=visScope.filter(u=>(idps[u.id]?.plan||[]).length>0).length;
   const approved=visScope.filter(u=>idps[u.id]?.approved).length;
   const totalRows=visScope.reduce((s,u)=>s+((idps[u.id]?.plan||[]).length),0);
   const execRows=visScope.reduce((s,u)=>s+((idps[u.id]?.plan||[]).filter(r=>r.status==="تم التنفيذ").length),0);
   const measRows=visScope.reduce((s,u)=>{ return s+((idps[u.id]?.plan||[]).filter(r=>{const im=impactData?.[`${u.id}__${r.id}`];return im&&(im.before!=null||im.after!=null||im.note);}).length); },0);
   const budget=visScope.reduce((s,u)=>s+planCost(idps[u.id]),0);
   const approvedBudget=visScope.filter(u=>idps[u.id]?.financeApproved||idps[u.id]?.branchFinanceApproved).reduce((s,u)=>s+planCost(idps[u.id]),0);
   const completedPlans=visScope.filter(u=>{const p=idps[u.id]?.plan||[];return p.length>0&&p.every(r=>r.status==="تم التنفيذ");}).length;
   const pct=(x)=>n?Math.round((x/n)*100):0;
   const rpct=(x)=>totalRows?Math.round((x/totalRows)*100):0;
   // لكل وحدة
   const byUnit=units.map(unit=>{
    const us=visScope.filter(u=>unitOf(u)===unit); const un=us.length;
    const pl=us.filter(u=>(idps[u.id]?.plan||[]).length>0).length;
    const ap=us.filter(u=>idps[u.id]?.approved).length;
    const tr=us.reduce((s,u)=>s+((idps[u.id]?.plan||[]).length),0);
    const ex=us.reduce((s,u)=>s+((idps[u.id]?.plan||[]).filter(r=>r.status==="تم التنفيذ").length),0);
    return {label:unit,count:un,planPct:un?Math.round(pl/un*100):0,apprPct:un?Math.round(ap/un*100):0,execPct:tr?Math.round(ex/tr*100):0};
   });
   return {planned,approved,totalRows,execRows,measRows,budget,approvedBudget,completedPlans,pct,rpct,byUnit};
  },[visScope,idps,impactData,units.join()]);

  // ═══ حسابات تقييم الأداء ═══
  const evalStats = useMemo(()=>{
   const rows=visScope.map(u=>({u,st:getEmpFullStats(u,evals[u.id]||{})}));
   const evaluated=rows.filter(r=>r.st?.avg!=null).length;
   const scores=rows.map(r=>r.st?.avg).filter(x=>x!=null);
   const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
   // الانحراف المعياري
   const sd=scores.length>1?Math.sqrt(scores.reduce((s,x)=>s+Math.pow(x-avg,2),0)/scores.length):0;
   // توزيع المستويات
   const levels={"يفوق التوقعات":0,"ممتاز":0,"جيد جداً":0,"جيد":0,"دون التوقعات":0};
   scores.forEach(x=>{const l=getLevel(x).label; if(levels[l]!=null)levels[l]++;});
   // متوسّط كل طرف
   const partyAvg={};
   EVAL_PARTIES.forEach(p=>{const v=rows.map(r=>r.st?.partyScores?.[p.key]?.avg).filter(x=>x!=null); partyAvg[p.key]=v.length?v.reduce((a,b)=>a+b,0)/v.length:null;});
   // لكل وحدة
   const byUnit=units.map(unit=>{
    const us=rows.filter(r=>unitOf(r.u)===unit);
    const sc=us.map(r=>r.st?.avg).filter(x=>x!=null);
    const a=sc.length?sc.reduce((x,y)=>x+y,0)/sc.length:null;
    return {label:unit,count:us.length,avg:a,evalPct:us.length?Math.round(sc.length/us.length*100):0};
   });
   const pct=(x)=>n?Math.round((x/n)*100):0;
   return {evaluated,avg,sd,levels,partyAvg,byUnit,pct};
  },[visScope,evals,units.join()]);

  const C={growth:"#10B981",eval:"#2E7FB8"};
  const col=C[mode];

  return (
  <div>
   {/* تبديل النمط + الفلتر */}
   <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
   {[{k:"growth",l:"🎯 التطور المهني",c:"#10B981"},{k:"eval",l:"📊 تقييم الأداء",c:"#2E7FB8"}].map(t=>(
   <button key={t.k} onClick={()=>setMode(t.k)} style={{padding:"10px 20px",borderRadius:24,border:"none",background:mode===t.k?`linear-gradient(135deg,${t.c},${t.c}cc)`:"#fff",color:mode===t.k?"#fff":"#5B7A9E",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:mode===t.k?`0 6px 18px ${t.c}45`:"0 2px 8px rgba(46,127,184,0.08)"}}>{t.l}</button>
   ))}
   <div style={{flex:1}}/>
   {units.length>1&&(
   <select value={unitFilter} onChange={e=>setUnitFilter(e.target.value)} style={{padding:"9px 14px",borderRadius:12,border:"1px solid #DDE9F5",background:"#fff",color:"#15385C",fontSize:12,fontWeight:700}}>
   <option value="">كل {unitLabel==="فرع"?"الفروع والإدارات":unitLabel}</option>
   {units.map(u=><option key={u} value={u}>{u}</option>)}
   </select>
   )}
   </div>

   <div style={{fontSize:11,color:"#8CA3BD",marginBottom:14}}>
   يعرض {n} شخصاً {unitFilter?`في ${unitFilter}`:`عبر ${units.length} ${unitLabel==="فرع"?"فرع/إدارة":unitLabel}`} • آخر تحديث: {new Date().toLocaleDateString("ar-SA")}
   </div>

   {mode==="growth"?(
   <>
   {/* بطاقات KPI */}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:16}}>
   <KpiCard label="نسبة التخطيط" value={growthStats.pct(growthStats.planned)+"%"} sub={`${growthStats.planned} من ${n}`} color="#10B981" icon="📋"/>
   <KpiCard label="نسبة الاعتماد" value={growthStats.pct(growthStats.approved)+"%"} sub={`${growthStats.approved} خطة معتمدة`} color="#2E7FB8" icon="✅"/>
   <KpiCard label="نسبة التنفيذ" value={growthStats.rpct(growthStats.execRows)+"%"} sub={`${growthStats.execRows} من ${growthStats.totalRows} بند`} color="#F59E0B" icon="⚡"/>
   <KpiCard label="قياس الأثر" value={growthStats.rpct(growthStats.measRows)+"%"} sub={`${growthStats.measRows} بند مقيس`} color="#8B5CF6" icon="📈"/>
   <KpiCard label="خطط مكتملة" value={growthStats.completedPlans} sub={`من ${n} خطة`} color="#0891B2" icon="🏆"/>
   <KpiCard label="الميزانية المعتمدة" value={growthStats.approvedBudget.toLocaleString("en-US")} sub={`من ${growthStats.budget.toLocaleString("en-US")} ريال`} color="#6D28D9" icon="💰"/>
   </div>

   {/* الرسوم */}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
   <ChartCard title="مؤشّرات التطوّر العامة" icon="🎯" color="#10B981">
   <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:10}}>
   <DonutChart percent={growthStats.pct(growthStats.planned)} color="#10B981" label="التخطيط" size=120/>
   <DonutChart percent={growthStats.rpct(growthStats.execRows)} color="#F59E0B" label="التنفيذ" size=120/>
   <DonutChart percent={growthStats.rpct(growthStats.measRows)} color="#8B5CF6" label="قياس الأثر" size=120/>
   </div>
   </ChartCard>

   <ChartCard title={`نسبة التنفيذ حسب ${unitLabel==="فرع"?"الفرع/الإدارة":unitLabel}`} icon="🏛️" color="#10B981">
   <HBarChart data={growthStats.byUnit.map(u=>({label:u.label,value:u.execPct}))} color="#10B981" maxOverride={100}/>
   </ChartCard>

   <ChartCard title="التخطيط والاعتماد حسب الوحدة" icon="📊" color="#2E7FB8" span={2}>
   <HBarChart data={growthStats.byUnit.map(u=>({label:u.label+` (${u.count})`,value:u.planPct}))} color="#2E7FB8" maxOverride={100}/>
   </ChartCard>
   </div>
   </>
   ):(
   <>
   {/* بطاقات KPI للتقييم */}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:16}}>
   <KpiCard label="اكتمال التقييم" value={evalStats.pct(evalStats.evaluated)+"%"} sub={`${evalStats.evaluated} من ${n}`} color="#2E7FB8" icon="✅"/>
   <KpiCard label="متوسّط الأداء العام" value={evalStats.avg!=null?evalStats.avg.toFixed(2):"—"} sub={evalStats.avg!=null?getLevel(evalStats.avg).label:"لم يُقيّم"} color={evalStats.avg!=null?getLevel(evalStats.avg).color:"#8CA3BD"} icon="⭐"/>
   <KpiCard label="الانحراف المعياري" value={evalStats.sd.toFixed(2)} sub="تباعد الأداء" color="#F59E0B" icon="📐"/>
   <KpiCard label="مكتملو التقييم" value={evalStats.evaluated} sub={`من ${n} موظف`} color="#0891B2" icon="👥"/>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
   <ChartCard title="توزيع مستويات الأداء" icon="📊" color="#2E7FB8">
   <VBarChart data={[
    {label:"يفوق",value:evalStats.levels["يفوق التوقعات"],color:"#10B981"},
    {label:"ممتاز",value:evalStats.levels["ممتاز"],color:"#3B82F6"},
    {label:"جيد جداً",value:evalStats.levels["جيد جداً"],color:"#F59E0B"},
    {label:"جيد",value:evalStats.levels["جيد"],color:"#F97316"},
    {label:"دون",value:evalStats.levels["دون التوقعات"],color:"#EF4444"},
   ]}/>
   </ChartCard>

   <ChartCard title="متوسّط الأداء حسب الطرف المُقيّم" icon="🤝" color="#8B5CF6">
   <HBarChart unit="" maxOverride={5} data={EVAL_PARTIES.filter(p=>evalStats.partyAvg[p.key]!=null).map(p=>({label:p.label,value:+evalStats.partyAvg[p.key].toFixed(2),color:p.color}))} color="#8B5CF6"/>
   <div style={{fontSize:9,color:"#8CA3BD",marginTop:8,textAlign:"center"}}>المتوسّط من 5</div>
   </ChartCard>

   <ChartCard title={`متوسّط الأداء حسب ${unitLabel==="فرع"?"الفرع/الإدارة":unitLabel}`} icon="🏛️" color="#2E7FB8" span={2}>
   <HBarChart unit="" maxOverride={5} data={evalStats.byUnit.filter(u=>u.avg!=null).map(u=>({label:u.label+` (${u.count})`,value:+u.avg.toFixed(2),color:getLevel(u.avg).color}))} color="#2E7FB8"/>
   <div style={{fontSize:9,color:"#8CA3BD",marginTop:8,textAlign:"center"}}>المتوسّط من 5 — اكتمال التقييم يظهر بعدد الأشخاص</div>
   </ChartCard>
   </div>
   </>
   )}
  </div>
  );
}
