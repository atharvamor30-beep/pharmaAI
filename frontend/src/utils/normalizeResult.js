function clamp01(n) {
  const v = Number(n)
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v
  }
  return undefined
}

function normalizeRiskLabel(rawLabel) {
  if (!rawLabel) return 'Safe'
  const s = String(rawLabel).toLowerCase()
  if (s.includes('safe')) return 'Safe'
  if (s.includes('adjust') || s.includes('dose') || s.includes('dosage')) return 'Adjust Dosage'
  if (s.includes('toxic') || s.includes('critical') || s.includes('fatal')) return 'Toxic'
  if (s.includes('ineffect') || s.includes('ineffic') || s.includes('fail') || s.includes('ineffective')) return 'Ineffective'
  return 'Safe'
}

function normalizeVariant(v) {
  if (!v) return null
  if (typeof v === 'string') return { rsid: v, gene: undefined, info: undefined }
  // common shapes
  const rsid = v.rsid || v.id || v.name || (v.variant && v.variant.rsid) || undefined
  const gene = v.gene || v.g || v.symbol || (v.pharmacogene) || undefined
  const info = v.info || v.notes || v.annotation || undefined
  return { rsid, gene, info }
}

export default function normalizeResult(raw) {
  if (!raw) return null

  // Handle array of results (multiple drugs)
  if (Array.isArray(raw.results) && raw.results.length > 1) {
    return raw.results.map(r => normalizeResultItem(r))
  }

  // Handle single result
  const source = (Array.isArray(raw.results) && raw.results.length > 0) ? raw.results[0] : raw
  return normalizeResultItem(source)
}

function normalizeResultItem(source) {
  if (!source) return null

  // ensure we never mutate raw; read from source
  const drug = pick(source.drug, source.drug_name, source.input && source.input.drug, 'Unknown Drug')
  const patient_id = pick(source.patient_id, source.sample_id, source.metadata && source.metadata.patient_id, 'Anonymous')

  const risk_label_raw = pick(
    source.risk_assessment && source.risk_assessment.risk_label,
    source.risk && source.risk.label,
    source.classification,
    source.risk_label
  )
  const risk_label = normalizeRiskLabel(risk_label_raw)

  const severity = pick(
    source.risk_assessment && source.risk_assessment.severity,
    source.risk && source.risk.severity,
    'Moderate'
  )

  const confidence_score = clamp01(pick(
    source.risk_assessment && source.risk_assessment.confidence_score,
    source.confidence,
    source.score,
    0
  ))

  const primary_gene = pick(
    source.pharmacogenomic_profile && source.pharmacogenomic_profile.primary_gene,
    source.gene,
    (Array.isArray(source.genes) && source.genes[0]),
    '—'
  )

  const diplotype = pick(
    source.pharmacogenomic_profile && source.pharmacogenomic_profile.diplotype,
    source.genotype,
    'N/A'
  )

  const phenotype = pick(
    source.pharmacogenomic_profile && source.pharmacogenomic_profile.phenotype,
    source.metabolizer_status,
    'N/A'
  )

  const variantsSource = pick(source.variants, source.detected_variants, source.pharmacogenomic_profile && source.pharmacogenomic_profile.variants, [])
  const detected_variants = Array.isArray(variantsSource) ? variantsSource.map(normalizeVariant).filter(Boolean) : []

  // Clinical recommendation: preserve full object if available
  const clinicRecRaw = pick(source.clinical_recommendation, source.recommendation, source.action)
  let clinical_recommendation = ''
  let cpic_guideline = ''
  let clinical_action = ''
  let data_quality_notes = ''
  if (!clinicRecRaw) {
    clinical_recommendation = ''
  } else if (typeof clinicRecRaw === 'string') {
    clinical_recommendation = clinicRecRaw
  } else if (typeof clinicRecRaw === 'object') {
    cpic_guideline = clinicRecRaw.cpic_guideline || ''
    clinical_action = clinicRecRaw.action || ''
    data_quality_notes = clinicRecRaw.data_quality_notes || ''
    clinical_recommendation = cpic_guideline || clinicRecRaw.recommendation || clinicRecRaw.action || JSON.stringify(clinicRecRaw)
  } else {
    clinical_recommendation = String(clinicRecRaw)
  }

  // Dosage guideline from risk_assessment
  const dosage_guideline = pick(
    source.risk_assessment && source.risk_assessment.dosage_guideline,
    source.dosage_guideline,
    ''
  )

  // LLM explanation: preserve all fields
  const llmRaw = source.llm_generated_explanation || {}
  const llm_summary = pick(llmRaw.summary, source.explanation, source.reasoning, '')
  const llm_clinician_summary = llmRaw.clinician_summary || ''
  const llm_limitations = llmRaw.limitations || ''
  const llm_next_steps = llmRaw.recommended_next_steps || ''

  // construct normalized object (ui-safe)
  const normalized = {
    // preserve top-level identifiers
    drug,
    patient_id,
    timestamp: source.timestamp || source.generated_at || source.time || undefined,

    risk_assessment: {
      risk_label,
      severity,
      confidence_score,
      dosage_guideline
    },

    pharmacogenomic_profile: {
      primary_gene,
      diplotype,
      phenotype,
      detected_variants
    },

    clinical_recommendation,
    clinical_recommendation_detail: {
      cpic_guideline,
      action: clinical_action,
      data_quality_notes
    },

    llm_generated_explanation: {
      summary: llm_summary,
      clinician_summary: llm_clinician_summary,
      limitations: llm_limitations,
      recommended_next_steps: llm_next_steps
    },

    // attach a shallow copy of some raw fields for reference (do not mutate raw)
    _meta: {
      original_keys: Object.keys(source || {}),
      source_is_array: false
    }
  }

  return normalized
}
