import React from 'react'

function VariantChip({v}){
  const severity = (v && v.severity) || ''
  const color = severity && severity.toLowerCase().includes('high') ? 'danger' : 'badge'
  return (
    <div className="variant-chip px-2 py-1 rounded-full" title={`${v.rsid || 'unknown'} ${v.gene?'- '+v.gene:''}${v.info?': '+v.info:''}`} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.04)'}}>
      <div className="text-xs font-medium">{v.rsid || (v.id) || 'unknown'}</div>
      <div className="text-[11px] muted">{v.gene || ''}</div>
    </div>
  )
}

export default React.memo(function VariantChips({data}){
  const variants = data?.pharmacogenomic_profile?.detected_variants || []
  if(!variants || variants.length===0) return <div className="text-sm muted">No significant variants detected</div>

  return (
    <div className="flex flex-wrap gap-2">
      {variants.map((v,i)=>(<VariantChip key={i} v={v} />))}
    </div>
  )
})
