import React from 'react'

export default React.memo(function CpicTrustCard({data}){
  const gene = data?.pharmacogenomic_profile?.primary_gene || '—'
  const drug = data?.drug || 'Unknown'
  return (
    <div className="p-3 rounded bg-[#071226]" style={{width:220}}>
      <div className="text-xs muted">CPIC-based Recommendation</div>
      <div className="font-medium mt-1">{gene} → {drug}</div>
      <div className="text-sm muted mt-2">Recommendation: {data?.clinical_recommendation || 'N/A'}</div>
    </div>
  )
})
