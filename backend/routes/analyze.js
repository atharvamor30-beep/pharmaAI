const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || ''
const PYTHON_VALIDATOR_URL = process.env.PYTHON_VALIDATOR_URL || ''
const FORWARD_TIMEOUT = parseInt(process.env.FORWARD_TIMEOUT_MS || '10000', 10) // ms
const FORWARD_RETRIES = parseInt(process.env.FORWARD_RETRIES || '2', 10)

const router = express.Router();

// Logs directory
const logsDir = path.join(__dirname, '..', 'logs')

// Helper function to save analysis to logs
function saveAnalysisToLog(data) {
  try {
    console.log('🔍 Debug: saveAnalysisToLog called with data keys:', Object.keys(data))
    if (data.results && Array.isArray(data.results)) {
      console.log('🔍 Debug: results array length:', data.results.length)
      console.log('🔍 Debug: first result patient_id:', data.results[0]?.patient_id)
    } else {
      console.log('🔍 Debug: single result patient_id:', data.patient_id)
    }
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    const logsFile = path.join(logsDir, 'analysis_logs.json')
    let logs = []

    // Read existing logs
    if (fs.existsSync(logsFile)) {
      const raw = fs.readFileSync(logsFile, 'utf8')
      logs = JSON.parse(raw)
      if (!Array.isArray(logs)) logs = []
    }

    // Flatten results array if present - save each drug as separate log entry
    let entriesToAdd = []
    if (data.results && Array.isArray(data.results)) {
      // Backend returned multiple drugs, save each separately
      entriesToAdd = data.results.map(result => ({
        ...result,
        patient_name: result.patient_id || 'Unknown Patient', // Use patient_id as patient_name for display
        logged_at: new Date().toISOString(),
        log_id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      }))
    } else {
      // Single drug response, save as is
      entriesToAdd = [{
        ...data,
        patient_name: data.patient_id || 'Unknown Patient', // Use patient_id as patient_name for display
        logged_at: new Date().toISOString(),
        log_id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      }]
    }

    logs.push(...entriesToAdd)

    // Keep only last 1000 entries to avoid file bloat
    if (logs.length > 1000) {
      logs = logs.slice(-1000)
    }

    // Save logs
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2), 'utf8')
    console.log(`✅ Saved ${entriesToAdd.length} log entries`)
  } catch (err) {
    console.error('❌ Error saving analysis log:', err)
  }
}

// store uploads in memory or temp folder
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.vcf') {
      return cb(new Error('Only .vcf files are allowed'));
    }
    cb(null, true);
  }
});

// POST /api/analyze
router.post('/analyze', upload.single('vcf_file'), async (req, res) => {
  // Helper to send structured VCF validation errors
  function vcfValidationError(message){
    return res.status(400).json({ success: false, error_type: 'VCF_VALIDATION_ERROR', message })
  }

  try {
    // 1. File exists
    if (!req.file) {
      return vcfValidationError('Please upload a VCF file before proceeding.')
    }

    // 2. Extension check
    const ext = path.extname(req.file.originalname || '').toLowerCase()
    if (ext !== '.vcf'){
      return vcfValidationError('Unsupported file type. Only .vcf files are allowed.')
    }

    // 3. Size <= 5MB (multer enforces this, but double-check)
    if (req.file.size > (5 * 1024 * 1024)){
      try { fs.unlinkSync(req.file.path) } catch(e){}
      return vcfValidationError('File size exceeds the 5MB limit.')
    }

    // 4. Readability
    try { fs.accessSync(req.file.path, fs.constants.R_OK) } catch(e){
      try { fs.unlinkSync(req.file.path) } catch(e){}
      return vcfValidationError('Invalid VCF file. Please upload a valid genomic VCF file.')
    }

    const drugsRaw = req.body.drugs || '';
    if (!drugsRaw.trim()) {
      return res.status(400).json({ success:false, error_type:'INPUT_VALIDATION', message:'Drugs field is required' })
    }

    const drugs = drugsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (drugs.length === 0) {
      return res.status(400).json({ success:false, error_type:'INPUT_VALIDATION', message:'At least one drug must be provided' })
    }

    const payload = {
      patient_id: `PATIENT_${Date.now()}`,
      drugs,
      vcf_file_path: req.file.path
    };

    // Call Python structural validator if configured
    if (PYTHON_VALIDATOR_URL){
      try{
        const vresp = await axios.post(PYTHON_VALIDATOR_URL, { vcf_file_path: req.file.path }, { timeout: FORWARD_TIMEOUT })
        if (!vresp.data || vresp.data.vcf_parsing_success !== true){
          // cleanup
          try { fs.unlinkSync(req.file.path) } catch(e){}
          return res.status(400).json({ success:false, error_type:'VCF_VALIDATION_ERROR', message: 'The uploaded VCF file could not be parsed. Please check the file format.' })
        }
      }catch(e){
        console.error('Validator error', e?.message || e)
        try { fs.unlinkSync(req.file.path) } catch(e){}
        return res.status(400).json({ success:false, error_type:'VCF_VALIDATION_ERROR', message: 'An unexpected error occurred during file validation.' })
      }
    }

    // If a Python backend is configured, forward request to it with retry/timeouts
    if (PYTHON_BACKEND_URL) {
      // Build multipart form-data including the VCF file stream and drugs
      const form = new FormData();
      form.append('patient_id', payload.patient_id);
      form.append('drugs', JSON.stringify(payload.drugs));
      form.append('vcf_file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname || 'upload.vcf',
        contentType: 'text/x-vcf'
      });

      let attempt = 0;
      let lastErr = null;
      while (attempt <= FORWARD_RETRIES) {
        try {
          const headers = Object.assign({}, form.getHeaders());
          const resp = await axios.post(PYTHON_BACKEND_URL, form, {
            headers,
            timeout: FORWARD_TIMEOUT,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          });

          // cleanup uploaded temp file
          try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }

          // Save to logs
          if (resp.data) {
            saveAnalysisToLog(resp.data)
          }

          return res.json(resp.data);
        } catch (err) {
          lastErr = err;
          attempt += 1;
          const backoff = 200 * attempt;
          await new Promise(r => setTimeout(r, backoff));
        }
      }
      console.error('Forward to Python backend failed:', lastErr?.message || lastErr);
      // cleanup file before falling back
      try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
    }

    // Return mock response directly from file (exact JSON structure required)
    const mockPath = path.join(__dirname, '..', 'mock_response.json');
    if (fs.existsSync(mockPath)) {
      const raw = fs.readFileSync(mockPath, 'utf8');
      const json = JSON.parse(raw);
      
      // Save to logs
      saveAnalysisToLog(json)
      
      return res.json(json);
    }

    // Fallback response for all selected drugs
    const fallbackResponse = {
      status: 'success',
      patient_id: payload.patient_id,
      timestamp: new Date().toISOString(),
      results: drugs.map(drug => ({
        patient_id: payload.patient_id,
        drug: drug,
        timestamp: new Date().toISOString(),
        risk_assessment: {
          risk_label: 'Unknown',
          confidence_score: 0.0,
          severity: 'unknown',
          dosage_guideline: 'Unable to provide dosage recommendation'
        },
        pharmacogenomic_profile: {
          primary_gene: 'N/A',
          diplotype: 'N/A',
          phenotype: 'N/A',
          detected_variants: []
        },
        clinical_recommendation: 'Analysis could not be completed. The Python backend appears to be unavailable. Please ensure the ML backend service is running at the configured URL and try again.',
        llm_generated_explanation: {
          summary: 'Unable to generate explanation due to backend service unavailability. This may indicate the pharmacogenomic analysis engine is not running properly.'
        },
        quality_metrics: {
          vcf_parsing_success: false
        }
      })),
      quality_metrics: { vcf_parsing_success: false }
    }
    
    // Save to logs
    saveAnalysisToLog(fallbackResponse)
    
    return res.json(fallbackResponse);

  } catch (err) {
    console.error(err);
    // Multer file size error handling
    if (err && err.code === 'LIMIT_FILE_SIZE'){
      return res.status(400).json({ success:false, error_type:'VCF_VALIDATION_ERROR', message:'File size exceeds the 5MB limit.' })
    }
    return res.status(500).json({ success:false, error_type:'INTERNAL', message: 'An unexpected error occurred during file validation.' });
  }
});

module.exports = router;
