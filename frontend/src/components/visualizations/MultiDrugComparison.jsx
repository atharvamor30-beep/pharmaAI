import React, {useMemo} from 'react'

export default React.memo(function MultiDrugComparison({data, raw}){
  const results = raw?.results || []
  if(!results || results.length<=1) return null

  const items = results.map(r=>({drug: r.drug || r.drug_name || 'Unknown', severity: (r.risk_assessment?.severity||'low'), label: r.risk_assessment?.risk_label || r.risk_label || 'Safe'}))

  return (
    <div className="multi-drug p-2">
      <div className="text-xs muted">Multi-drug comparison</div>
      <div className="grid grid-cols-1 gap-2 mt-2">
        {items.map((it,i)=>(
          <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#071226] rounded">
            <div className="font-medium">{it.drug}</div>
            <div className="text-sm">{it.label} · {it.severity}</div>
          </div>
        ))}
      </div>
    </div>
  )
})
