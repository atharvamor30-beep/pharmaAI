const express = require('express')
const router = express.Router()

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// POST /api/chat
// Body: { question: string, reports: array }
router.post('/chat', async (req, res) => {
    try {
        const { question, reports } = req.body || {}

        if (!question || !question.trim()) {
            return res.status(400).json({ success: false, message: 'Question is required' })
        }

        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'GROQ_API_KEY is not configured on the server.' })
        }

        // Build grounded context from drug reports
        const reportsContext = (reports || []).map((r, i) => {
            const drug = r.drug || 'Unknown'
            const risk = r.risk_assessment?.risk_label || 'Unknown'
            const confidence = r.risk_assessment?.confidence_score || 0
            const severity = r.risk_assessment?.severity || 'unknown'
            const gene = r.pharmacogenomic_profile?.primary_gene || 'N/A'
            const diplotype = r.pharmacogenomic_profile?.diplotype || 'N/A'
            const phenotype = r.pharmacogenomic_profile?.phenotype || 'N/A'
            const clinicalRec = typeof r.clinical_recommendation === 'string'
                ? r.clinical_recommendation
                : (r.clinical_recommendation?.cpic_guideline || r.clinical_recommendation?.action || JSON.stringify(r.clinical_recommendation || ''))
            const llmSummary = r.llm_generated_explanation?.summary || ''
            const llmClinician = r.llm_generated_explanation?.clinician_summary || ''
            return `Drug ${i + 1}: ${drug}
  Risk: ${risk} (confidence: ${(confidence * 100).toFixed(0)}%, severity: ${severity})
  Gene: ${gene}, Diplotype: ${diplotype}, Phenotype: ${phenotype}
  Clinical Recommendation: ${clinicalRec}
  AI Summary: ${llmSummary}${llmClinician ? '\n  Clinician Summary: ' + llmClinician : ''}`
        }).join('\n\n')

        const systemPrompt = `You are PharmaGuard AI, a clinical pharmacogenomics assistant. You answer questions based ONLY on the patient's drug analysis reports provided below. Be concise, clinically accurate, and cite the specific drug/gene data from the reports. If the answer cannot be determined from the reports, say so clearly.

IMPORTANT FORMATTING RULES:
- Do NOT use any markdown formatting whatsoever.
- Do NOT use asterisks (*), hash symbols (#), pipes (|), or dashes (---) for formatting.
- Do NOT create tables. Use simple lists or paragraphs instead.
- Use plain text only. Use line breaks and numbered lists for structure.
- Keep the response clean and readable as plain text.

=== PATIENT DRUG ANALYSIS REPORTS ===
${reportsContext || 'No reports available.'}
=== END REPORTS ===`

        const payload = {
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ],
            temperature: 0.3,
            max_tokens: 800
        }

        const https = require('https')
        const http_module = require('http')

        const response = await new Promise((resolve, reject) => {
            const url = new URL(GROQ_URL)
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                }
            }

            const reqHttp = https.request(options, (resp) => {
                let data = ''
                resp.on('data', chunk => { data += chunk })
                resp.on('end', () => {
                    try {
                        resolve({ status: resp.statusCode, body: JSON.parse(data) })
                    } catch (e) {
                        reject(new Error(`Failed to parse Groq response: ${data.slice(0, 200)}`))
                    }
                })
            })

            reqHttp.on('error', reject)
            reqHttp.setTimeout(30000, () => {
                reqHttp.destroy()
                reject(new Error('Groq API request timed out'))
            })

            reqHttp.write(JSON.stringify(payload))
            reqHttp.end()
        })

        if (response.status !== 200) {
            const errMsg = response.body?.error?.message || `Groq API returned status ${response.status}`
            return res.status(502).json({ success: false, message: errMsg })
        }

        const answer = response.body?.choices?.[0]?.message?.content || 'No response generated.'
        return res.json({ success: true, answer })

    } catch (err) {
        console.error('Chat endpoint error:', err.message || err)
        return res.status(500).json({ success: false, message: err.message || 'Internal server error' })
    }
})

module.exports = router
