import React from 'react'

export default function PieChart({value=0,size=96,stroke=12}){
  const pct = Math.max(0, Math.min(1, value || 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = `${(pct * circumference).toFixed(2)} ${circumference.toFixed(2)}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#0fb89f" />
        </linearGradient>
      </defs>
      <g transform={`translate(${size/2},${size/2})`}>
        <circle r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={stroke} />
        <circle r={radius} fill="none" stroke="url(#g1)" strokeWidth={stroke} strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90)" />
        <text x="0" y="4" textAnchor="middle" fontSize={size*0.18} fill="white">{Math.round(pct*100)}%</text>
      </g>
    </svg>
  )
}
