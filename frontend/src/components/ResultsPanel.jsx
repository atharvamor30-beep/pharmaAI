import React, { useState, useEffect, useMemo } from 'react'

function ConfidenceGauge({ value = 0, id, size = 60 }) {
  const pct = Math.max(0, Math.min(100, value || 0))
  const radius = (size / 2) - 6
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const to = circumference - (pct / 100) * circumference
    const t = setTimeout(() => setOffset(to), 100)
    return () => clearTimeout(t)
  }, [pct, circumference])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <defs>
        <linearGradient id={id} x1="0%" x2="100%">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth="4"
      />

      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1000ms cubic-bezier(.2,.9,.3,1)' }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />

      <text
        x={size / 2}
        y={(size / 2) + 2}
        fontSize="14"
        fontWeight="bold"
        fill="#0EA5E9"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

function RiskBadge({ risk_label }) {
  const badges = {
    'Safe': { bg: 'bg-green-100', text: 'text-green-800' },
    'Adjust Dosage': { bg: 'bg-amber-100', text: 'text-amber-800' },
    'Ineffective': { bg: 'bg-orange-100', text: 'text-orange-800' },
    'Toxic': { bg: 'bg-red-100', text: 'text-red-800' },
  }

  const badge = badges[risk_label] || badges['Safe']

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
      {risk_label}
    </span>
  )
}

// Pharmacogenomic gene mapping for common drugs - Comprehensive Database
const DRUG_GENE_MAPPING = {
  // Antidepressants & Psychiatric
  'Citalopram': 'CYP2C19',
  'Citopram': 'CYP2C19',
  'Escitalopram': 'CYP2C19',
  'Sertraline': 'CYP2C19, CYP2D6',
  'Fluoxetine': 'CYP2D6, CYP2C19',
  'Paroxetine': 'CYP2D6',
  'Venlafaxine': 'CYP2D6',
  'Duloxetine': 'CYP1A2, CYP2D6',
  'Imipramine': 'CYP2D6',
  'Amitriptyline': 'CYP2D6',
  'Nortriptyline': 'CYP2D6',
  'Doxepin': 'CYP2D6',
  'Aripiprazole': 'CYP3A4, CYP2D6',
  'Haloperidol': 'CYP2D6',
  'Risperidone': 'CYP2D6',
  'Quetiapine': 'CYP3A4',
  'Olanzapine': 'CYP1A2',
  'Clozapine': 'CYP1A2, CYP2D6',

  // Beta Blockers & CVascular
  'Metoprolol': 'CYP2D6',
  'Propranolol': 'CYP2D6',
  'Timolol': 'CYP2D6',
  'Atenolol': 'Not metabolized',
  'Carvedilol': 'CYP2D6',
  'Lisinopril': 'Not metabolized',
  'Enalapril': 'Not metabolized',
  'Valsartan': 'CYP3A4',
  'Losartan': 'CYP2C9',
  'Amlodipine': 'CYP3A4',
  'Diltiazem': 'CYP3A4',
  'Verapamil': 'CYP3A4',
  'Simvastatin': 'CYP3A4',
  'Atorvastatin': 'CYP3A4',
  'Pravastatin': 'Not metabolized',

  // Anticoagulants & Antiplatelet
  'Warfarin': 'CYP2C9, VKORC1',
  'Clopidogrel': 'CYP2C19',
  'Prasugrel': 'CYP3A4, CYP2B6',
  'Ticagrelor': 'CYP3A4',
  'Dabigatran': 'Not CYP metabolized',
  'Rivaroxaban': 'CYP3A4, CYP2J2',
  'Apixaban': 'CYP3A4, CYP2J2',
  'Edoxaban': 'CYP3A4, CYP2J2',

  // Anticonvulsants & Neurological
  'Phenytoin': 'CYP2C9',
  'Carbamazepine': 'CYP3A4, CYP2C9',
  'Lamotrigine': 'UGT1A4',
  'Levetiracetam': 'Not metabolized',
  'Oxcarbazepine': 'CYP2C19',
  'Topiramate': 'Not metabolized',
  'Valproic Acid': 'CYP2C9',
  'Phenobarbital': 'CYP2C19',

  // Asthma & Respiratory
  'Theophylline': 'CYP1A2, CYP3A4',
  'Albuterol': 'Not CYP metabolized',
  'Montelukast': 'CYP3A4, CYP2C9',

  // Pain Management & Analgesics
  'Ibuprofen': 'CYP2C9',
  'Naproxen': 'CYP2C9',
  'Celecoxib': 'CYP2C9, CYP3A4',
  'Meloxicam': 'CYP2C9',
  'Indomethacin': 'CYP2C9',
  'Diclofenac': 'CYP2C9',
  'Codeine': 'CYP2D6',
  'Tramadol': 'CYP2D6, CYP3A4',
  'Morphine': 'UGT2B7',
  'Oxycodone': 'CYP3A4, CYP2D6',
  'Hydrocodone': 'CYP2D6',
  'Methadone': 'CYP3A4, CYP2D6',

  // GI Medications
  'Omeprazole': 'CYP2C19',
  'Lansoprazole': 'CYP3A4, CYP2C19',
  'Pantoprazole': 'CYP2C19',
  'Esomeprazole': 'CYP2C19',
  'Rabeprazole': 'CYP3A4, CYP2C19',
  'Cimetidine': 'CYP2D6, CYP3A4, CYP2C9',
  'Ranitidine': 'Not CYP metabolized',
  'Famotidine': 'Not CYP metabolized',
  'Ondansetron': 'CYP3A4, CYP2D6',
  'Metoclopramide': 'CYP2D6',

  // Hormone Replacement & Antiestrogens
  'Tamoxifen': 'CYP2D6, CYP3A4',
  'Estradiol': 'CYP2D6, CYP2C9',
  'Levothyroxine': 'Not metabolized',
  'Finasteride': 'CYP3A4',

  // Cancer Chemotherapy
  'Mercaptopurine': 'TPMT',
  'Azathioprine': 'TPMT',
  '5-Fluorouracil': 'DPYD',
  'Irinotecan': 'UGT1A1',
  'Topotecan': 'CYP3A4',
  'Docetaxel': 'CYP3A4',
  'Paclitaxel': 'CYP2C8, CYP3A4',
  'Tamsulosin': 'CYP3A4',
  'Doxorubicin': 'CYP3A4',
  'Cyclophosphamide': 'CYP2B6, CYP3A4',

  // Antiretrovirals
  'Abacavir': 'HLA-B*5701',
  'Efavirenz': 'CYP2B6, CYP3A4',
  'Lopinavir': 'CYP3A4',
  'Ritonavir': 'CYP3A4',
  'Atazanavir': 'CYP3A4',
  'Zidovudine': 'UGT2B7',

  // Immunosuppressants
  'Tacrolimus': 'CYP3A4',
  'Cyclosporine': 'CYP3A4',
  'Mycophenolate': 'TPMT',

  // Antibiotics
  'Erythromycin': 'CYP3A4',
  'Clarithromycin': 'CYP3A4',
  'Azithromycin': 'CYP3A4',
  'Fluoroquinolones': 'Not CYP metabolized',
  'Rifampin': 'CYP3A4 inducer',

  // Diabetes Medications
  'Metformin': 'Not metabolized',
  'Glibenclamide': 'CYP2C9',
  'Glipizide': 'CYP2C9',
  'Glyburide': 'CYP2C9',
  'Repaglinide': 'CYP2C8, CYP3A4',
  'Rosiglitazone': 'CYP2C8',
  'Pioglitazone': 'CYP2C8, CYP3A4',

  // Thyroid
  'Propylthiouracil': 'Not metabolized',
  'Methimazole': 'Not metabolized',

  // Dermatologic
  'Isotretinoin': 'CYP2C8, CYP3A4',
  'Acitretin': 'Not metabolized',

  // GU/Urologic
  'Tolterodine': 'CYP2D6, CYP3A4',
  'Oxybutynin': 'CYP3A4',
  'Solifenacin': 'CYP3A4',
  'Alfuzosin': 'CYP3A4',
  'Doxazosin': 'CYP3A4',

  // Anxiolytics & Hypnotics
  'Alprazolam': 'CYP3A4',
  'Diazepam': 'CYP2C19, CYP3A4',
  'Lorazepam': 'Not CYP metabolized',
  'Temazepam': 'Not CYP metabolized',
  'Zolpidem': 'CYP3A4, CYP2C9',
  'Buspirone': 'CYP3A4',

  // Migraine
  'Sumatriptan': 'MAO-A',
  'Naratriptan': 'CYP3A4',
  'Rizatriptan': 'MAO-A',
  'Almotriptan': 'Not CYP metabolized',
  'Frovatriptan': 'Not CYP metabolized',
  'Zolmitriptan': 'MAO-A',

  // Default fallbacks for unmapped drugs
  'Default': 'CYP450'
}

function getPrimaryGeneForDrug(drugName) {
  if (!drugName) return 'N/A'

  const cleanedName = drugName.trim()

  // Exact match
  if (DRUG_GENE_MAPPING[cleanedName]) {
    return DRUG_GENE_MAPPING[cleanedName]
  }

  // Case-insensitive exact match
  const lowerDrug = cleanedName.toLowerCase()
  for (const [drug, gene] of Object.entries(DRUG_GENE_MAPPING)) {
    if (drug.toLowerCase() === lowerDrug) {
      return gene
    }
  }

  // Partial/substring match for drug names that might have slight variations
  for (const [drug, gene] of Object.entries(DRUG_GENE_MAPPING)) {
    const drugLower = drug.toLowerCase()
    const searchLower = lowerDrug

    // Match if either contains the other (handles spelling variations)
    if (drugLower.includes(searchLower) || searchLower.includes(drugLower)) {
      return gene
    }
  }

  // If still not found, try to identify drug class from name patterns
  if (lowerDrug.includes('pam') || lowerDrug.includes('lam') || lowerDrug.includes('zolam')) {
    return 'CYP3A4' // Benzodiazepines pattern
  }
  if (lowerDrug.includes('prazol') || lowerDrug.includes('zole')) {
    return 'CYP2C19' // PPI pattern
  }
  if (lowerDrug.includes('statin')) {
    return 'CYP3A4' // Statin pattern
  }
  if (lowerDrug.includes('olol')) {
    return 'CYP2D6' // Beta-blocker pattern
  }
  if (lowerDrug.includes('pine')) {
    return 'CYP3A4' // Various drug pattern
  }

  // If no match found, return a generic response
  return 'CYP450 (Common pathway)'
}

export default function ResultsPanel({ data, selectedDrugs = [] }) {
  const [toast, setToast] = useState(null)

  let results = []
  if (Array.isArray(data)) results = data
  else if (data && typeof data === 'object') results = [data]

  const filteredResults = useMemo(() => {
    if (selectedDrugs.length === 0) return results
    // Case-insensitive filter for drug names
    const selectedDrugsUpper = selectedDrugs.map(d => String(d).toUpperCase())
    return results.filter(r => selectedDrugsUpper.includes(String(r.drug).toUpperCase()))
  }, [results, selectedDrugs])

  if (!filteredResults.length) return null

  const showToast = (message, type = 'success') => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const downloadJSON = (result) => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.patient_id}-${result.drug}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`📥 ${result.drug} file downloaded successfully`)
  }

  const copyJSON = (result) => {
    const json = JSON.stringify(result, null, 2)
    navigator.clipboard.writeText(json)
    showToast(`📋 ${result.drug} data copied to clipboard`)
  }

  const downloadCombinedJSON = () => {
    const combinedData = {
      patient_id: filteredResults[0]?.patient_id || 'patient',
      analysis_date: new Date().toISOString(),
      total_drugs: filteredResults.length,
      drugs: filteredResults
    }
    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `combined-analysis-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`📥 Combined analysis file downloaded successfully`)
  }

  const copyCombinedJSON = () => {
    const combinedData = {
      patient_id: filteredResults[0]?.patient_id || 'patient',
      analysis_date: new Date().toISOString(),
      total_drugs: filteredResults.length,
      drugs: filteredResults
    }
    const json = JSON.stringify(combinedData, null, 2)
    navigator.clipboard.writeText(json)
    showToast(`📋 Combined analysis data copied to clipboard`)
  }

  return (
    <div className="w-full px-4 py-2">
      {/* Combined Download/Copy Section */}
      <div className="mb-6 p-4 bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="text-sm font-semibold text-neutral-200">
          📊 Combined Results ({filteredResults.length} drug{filteredResults.length !== 1 ? 's' : ''})
        </div>
        <div className="flex gap-3 ml-auto">
          <button
            onClick={copyCombinedJSON}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors duration-200"
          >
            📋 Copy All
          </button>
          <button
            onClick={downloadCombinedJSON}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-semibold rounded-lg transition-colors duration-200"
          >
            ⬇️ Download All
          </button>
        </div>
      </div>

      {/* Patient Information */}
      {filteredResults.length > 0 && (
        <div className="mb-6 p-4 bg-neutral-800 border border-neutral-700 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-neutral-200">
              👤 Patient ID:
            </div>
            <div className="font-mono text-emerald-400 bg-neutral-900 px-3 py-1 rounded border border-neutral-600">
              {filteredResults[0]?.patient_id || 'Unknown'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredResults.map((r, idx) => {

          const confidence_pct = Math.round((r.risk_assessment?.confidence_score || 0) * 100)
          const severity = r.risk_assessment?.severity || 'Unknown'
          const risk_label = r.risk_assessment?.risk_label || 'Safe'
          const primary_gene = r.pharmacogenomic_profile?.primary_gene || getPrimaryGeneForDrug(r.drug) || 'N/A'
          const diplotype = r.pharmacogenomic_profile?.diplotype || 'N/A'
          const phenotype = r.pharmacogenomic_profile?.phenotype || 'N/A'
          const dosage_guideline = r.risk_assessment?.dosage_guideline || ''
          const clinical_rec = r.clinical_recommendation || 'No recommendation available'
          const llm = r.llm_generated_explanation || {}
          const llm_summary = llm.summary || ''
          const llm_clinician = llm.clinician_summary || ''
          const llm_limitations = llm.limitations || ''
          const llm_next_steps = llm.recommended_next_steps || ''
          const has_llm = llm_summary || llm_clinician || llm_limitations || llm_next_steps

          return (
            <div
              key={idx}
              className="bg-neutral-900 rounded-lg border border-neutral-700 shadow-sm hover:shadow-md transition-shadow
                         flex flex-col"
            >

              {/* HEADER */}
              <div className="bg-neutral-800 px-5 py-3 border-b border-neutral-700 rounded-t-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-emerald-400 truncate flex-1">
                    {r.drug}
                  </h3>
                  <RiskBadge risk_label={risk_label} />
                </div>
              </div>

              {/* CONTENT */}
              <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto scrollbar-hide" style={{ maxHeight: '700px' }}>

                {/* Confidence + Severity Row */}
                <div className="flex items-center gap-4 bg-neutral-800 p-3 rounded-lg border border-neutral-700">
                  <ConfidenceGauge value={confidence_pct} id={`conf-${idx}`} size={60} />
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-neutral-400 font-medium">Confidence:</span>{' '}
                      <span className="font-semibold text-emerald-400">
                        {confidence_pct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-medium">Severity:</span>{' '}
                      <span className="font-semibold capitalize text-neutral-200">
                        {severity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pharmacogenomic Profile */}
                <div className="bg-neutral-800 p-3 rounded-lg space-y-3 text-xs border border-neutral-700">
                  <div>
                    <div className="text-neutral-400 font-medium mb-1">Primary Gene:</div>
                    <div className="font-mono text-emerald-400 bg-neutral-900 p-2 rounded border border-neutral-600 break-words">
                      {primary_gene}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-400 font-medium mb-1">Diplotype:</div>
                    <div className="font-mono text-emerald-400 bg-neutral-900 p-2 rounded border border-neutral-600 break-words">
                      {diplotype}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-400 font-medium mb-1">Phenotype:</div>
                    <div className="text-neutral-200 bg-neutral-900 p-2 rounded border border-neutral-600 break-words">
                      {phenotype}
                    </div>
                  </div>
                </div>

                {/* ─── SECTION 1: Dosage / Action Guideline ─── */}
                <div className="bg-amber-950/40 p-3 rounded-lg text-xs border border-amber-800/50">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-2">
                    <span>⚠️</span> Dosage & Action Guideline
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 font-medium">Action:</span>
                      <RiskBadge risk_label={risk_label} />
                    </div>
                    {dosage_guideline && (
                      <div className="text-neutral-200 leading-snug bg-neutral-900 p-2.5 rounded border border-amber-800/40 break-words">
                        {dosage_guideline}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── SECTION 2: Clinical Recommendation (CPIC) ─── */}
                <div className="bg-emerald-950/40 p-3 rounded-lg text-xs border border-emerald-800/50">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-2">
                    <span>🏥</span> Clinical Recommendation (CPIC Guideline)
                  </div>
                  <div className="text-neutral-200 leading-relaxed bg-neutral-900 p-2.5 rounded border border-emerald-800/40 break-words whitespace-pre-line">
                    {clinical_rec}
                  </div>
                </div>

                {/* ─── SECTION 3: Extended LLM AI Explanation ─── */}
                {has_llm && (
                  <div className="bg-purple-950/40 p-3 rounded-lg text-xs border border-purple-800/50">
                    <div className="flex items-center gap-1.5 text-purple-400 font-semibold mb-3">
                      <span>🤖</span> AI-Generated Explanation
                    </div>
                    <div className="space-y-3">
                      {llm_summary && (
                        <div>
                          <div className="text-purple-300 font-semibold mb-1">Summary</div>
                          <div className="text-neutral-200 leading-relaxed bg-neutral-900 p-2.5 rounded border border-purple-800/40 break-words">
                            {llm_summary}
                          </div>
                        </div>
                      )}
                      {llm_clinician && (
                        <div>
                          <div className="text-purple-300 font-semibold mb-1">Clinician Summary</div>
                          <div className="text-neutral-200 leading-relaxed bg-neutral-900 p-2.5 rounded border border-purple-800/40 break-words">
                            {llm_clinician}
                          </div>
                        </div>
                      )}
                      {llm_limitations && (
                        <div>
                          <div className="text-purple-300 font-semibold mb-1">Limitations</div>
                          <div className="text-neutral-200 leading-relaxed bg-neutral-900 p-2.5 rounded border border-purple-800/40 break-words">
                            {llm_limitations}
                          </div>
                        </div>
                      )}
                      {llm_next_steps && (
                        <div>
                          <div className="text-purple-300 font-semibold mb-1">Recommended Next Steps</div>
                          <div className="text-neutral-200 leading-relaxed bg-neutral-900 p-2.5 rounded border border-purple-800/40 break-words">
                            {llm_next_steps}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* ACTION BUTTONS */}
              <div className="border-t border-neutral-700 px-5 py-3 bg-neutral-800 flex gap-3">
                <button
                  onClick={() => copyJSON(r)}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 
                             text-white text-xs font-semibold rounded transition-colors duration-200"
                >
                  📋 Copy
                </button>

                <button
                  onClick={() => downloadJSON(r)}
                  className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 
                             text-white text-xs font-semibold rounded transition-colors duration-200"
                >
                  ⬇️ Download
                </button>
              </div>

              {/* FOOTER */}
              <div className="text-xs text-neutral-500 text-center px-5 py-2 bg-neutral-800 border-t border-neutral-700 rounded-b-lg">
                {r.timestamp ? new Date(r.timestamp).toLocaleString() : 'No date'}
              </div>

            </div>
          )
        })}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
