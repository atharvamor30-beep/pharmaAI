import React, {useMemo} from 'react'
import PieChart from './PieChart'

const severityOrder = ['low','moderate','high','critical']

function SeverityBar({severity}){
  const idx = Math.max(0, severityOrder.indexOf((severity||'moderate').toLowerCase()))
  const pct = ((idx+1)/severityOrder.length) * 100
  return (
    <div style={{width:160}}>
      <div className="text-xs muted">Severity</div>
      <div className="w-full bg-[#071226] rounded h-2 mt-1 overflow-hidden">
        <div style={{width:`${pct}%`, height:8, background:'linear-gradient(90deg,#f97316,#ef4444)'}} />
      </div>
      <div className="text-xs muted mt-1">{(severity||'Moderate')}</div>
    </div>
  )
}

export default React.memo(function RiskOverview({data}){
  const confidence = useMemo(()=> data?.risk_assessment?.confidence_score || 0, [data?.risk_assessment?.confidence_score])
  const severity = useMemo(()=> data?.risk_assessment?.severity || 'Moderate', [data?.risk_assessment?.severity])
  const label = useMemo(()=> data?.risk_assessment?.risk_label || data?.risk_label || 'Unknown', [data?.risk_assessment?.risk_label, data?.risk_label])

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="text-sm muted">Confidence</div>
        <PieChart value={confidence} size={88} stroke={12} />
      </div>

      <div className="flex flex-col">
        <div className="text-sm muted">Risk</div>
        <div className="mt-1">
          <span className={`badge ${label==='Safe'? 'safe': label==='Adjust Dosage'? 'warn':'danger'}`}>{label}</span>
        </div>
      </div>

      <div className="ml-4">
        <SeverityBar severity={severity} />
      </div>
    </div>
  )
})
