import React, {useMemo} from 'react'

const scale = ['Safe','Low','Moderate','High','Toxic']

export default React.memo(function SeverityScale({data}){
  const sev = (data?.risk_assessment?.severity || 'Moderate')
  const conf = data?.risk_assessment?.confidence_score || 0
  const idx = Math.max(0, Math.min(scale.length-1, scale.findIndex(s=> s.toLowerCase()===String(sev).toLowerCase())))

  return (
    <div className="severity-scale w-full p-2">
      <div className="text-xs muted">Severity scale</div>
      <div className="w-full h-3 bg-[#071226] rounded my-2 relative">
        <div style={{position:'absolute', left:`${(idx/(scale.length-1))*100}%`, transform:'translateX(-50%)'}}>
          <div style={{width:14,height:14,borderRadius:8,background:'#ef4444',opacity:Math.max(0.2,conf)}} />
        </div>
      </div>
      <div className="flex justify-between text-xs muted">
        <div>Safe</div><div>Toxic</div>
      </div>
    </div>
  )
})
