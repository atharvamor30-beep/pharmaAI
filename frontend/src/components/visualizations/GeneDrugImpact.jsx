import React, {useMemo} from 'react'

function activityFromPhenotype(p){
  if(!p) return 'Normal activity'
  const s = String(p).toLowerCase()
  if(s.includes('pm') || s.includes('poor') || s.includes('reduced')) return 'Reduced activity'
  if(s.includes('ultra') || s.includes('rapid')) return 'Increased activity'
  return 'Normal activity'
}

export default React.memo(function GeneDrugImpact({data}){
  const gene = useMemo(()=> data?.pharmacogenomic_profile?.primary_gene || '—', [data])
  const drug = useMemo(()=> data?.drug || 'Unknown', [data])
  const phenotype = useMemo(()=> data?.pharmacogenomic_profile?.phenotype || '', [data])
  const activity = useMemo(()=> activityFromPhenotype(phenotype), [phenotype])

  return (
    <div className="impact-card p-3" style={{display:'flex',alignItems:'center',gap:16}}>
      <div>
        <div className="text-xs muted">Primary Gene</div>
        <div className="font-medium">{gene}</div>
      </div>

      <div style={{fontSize:20}}>→</div>

      <div>
        <div className="text-xs muted">Drug</div>
        <div className="font-medium">{drug}</div>
      </div>

      <div style={{marginLeft:16}}>
        <div className="text-xs muted">Enzyme activity</div>
        <div className="text-sm">{activity}</div>
      </div>
    </div>
  )
})
