import React from 'react'

function Step({idx, title, value}){
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">{idx}</div>
      <div>
        <div className="text-xs muted">{title}</div>
        <div className="font-medium">{value || 'N/A'}</div>
      </div>
    </div>
  )
}

export default React.memo(function GenotypePhenotypeFlow({data}){
  const diplotype = data?.pharmacogenomic_profile?.diplotype || 'N/A'
  const phenotype = data?.pharmacogenomic_profile?.phenotype || 'N/A'
  const recommendation = typeof data?.clinical_recommendation === 'string' ? data.clinical_recommendation : (data?.clinical_recommendation || 'N/A')

  return (
    <div className="flow-stepper flex gap-6 items-start">
      <Step idx={1} title="Genotype (Diplotype)" value={diplotype} />
      <div className="flex-1 border-l h-0" />
      <Step idx={2} title="Phenotype" value={phenotype} />
      <div className="flex-1 border-l h-0" />
      <Step idx={3} title="Clinical Recommendation" value={recommendation} />
    </div>
  )
})
