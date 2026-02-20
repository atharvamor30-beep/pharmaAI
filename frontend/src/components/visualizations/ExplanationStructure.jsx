import React from 'react'

export default React.memo(function ExplanationStructure({data}){
  const summary = data?.llm_generated_explanation?.summary || ''
  if(!summary) return <div className="text-sm muted">No explanation available.</div>

  // simple split into sentences for logical blocks
  const parts = summary.split(/(?<=[.?!])\s+/).slice(0,6)

  return (
    <div className="explain-accordion">
      <div className="text-xs muted">Explanation</div>
      <div className="mt-2 grid gap-2">
        <div className="p-2 bg-[#071226] rounded"><strong>Genetic Evidence</strong><div className="text-sm mt-1">{parts.slice(0,2).join(' ')}</div></div>
        <div className="p-2 bg-[#071226] rounded"><strong>CPIC Guideline Mapping</strong><div className="text-sm mt-1">{parts.slice(2,4).join(' ')}</div></div>
        <div className="p-2 bg-[#071226] rounded"><strong>Clinical Rationale</strong><div className="text-sm mt-1">{parts.slice(4).join(' ')}</div></div>
      </div>
    </div>
  )
})
