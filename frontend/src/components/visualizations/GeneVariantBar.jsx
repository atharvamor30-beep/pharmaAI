import React, {useMemo} from 'react'

export default React.memo(function GeneVariantBar({data}){
  const gene = data?.pharmacogenomic_profile?.primary_gene || null
  const variants = data?.pharmacogenomic_profile?.detected_variants || []

  if(!gene) return <div className="text-sm muted">No gene track available</div>

  return (
    <div className="gene-track p-2">
      <div className="text-xs muted">{gene}</div>
      <div className="w-full bg-[#061523] h-6 rounded mt-2 relative">
        {variants.map((v,i)=>{
          const left = Math.min(90, i*12)
          return (<div key={i} title={v.rsid} style={{position:'absolute', left:`${left}px`, top:'6px', width:10, height:10, borderRadius:6, background: v.impact==='high' ? '#ef4444' : '#06d6a0'}} />)
        })}
      </div>
      <div className="text-xs muted mt-2">{variants.length} variant(s)</div>
    </div>
  )
})
