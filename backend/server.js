const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const app = express()

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env')
    if (!fs.existsSync(envPath)) return
    const raw = fs.readFileSync(envPath, 'utf8')
    for (const lineRaw of raw.split(/\r?\n/)) {
      const line = String(lineRaw || '').trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).trim()
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch (e) {
    return
  }
}

loadDotEnv()

const analyzeRoute = require('./routes/analyze')
const chatRoute = require('./routes/chat')

const corsOrigin = process.env.CORS_ORIGIN
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : undefined))
app.use(express.json())

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Get all logs (define BEFORE app.use('/api', analyzeRoute))
app.get('/api/logs', (req, res) => {
  try {
    const logsFile = path.join(logsDir, 'analysis_logs.json')

    if (!fs.existsSync(logsFile)) {
      return res.json({ success: true, logs: [], total: 0 })
    }

    const raw = fs.readFileSync(logsFile, 'utf8')
    const logs = JSON.parse(raw)

    res.json({
      success: true,
      logs: Array.isArray(logs) ? logs : [],
      total: Array.isArray(logs) ? logs.length : 0
    })
  } catch (err) {
    console.error('Error reading logs:', err)
    res.status(500).json({ success: false, error: 'Failed to read logs' })
  }
})

// Clear logs (optional)
app.delete('/api/logs', (req, res) => {
  try {
    const logsFile = path.join(logsDir, 'analysis_logs.json')
    if (fs.existsSync(logsFile)) {
      fs.unlinkSync(logsFile)
    }
    res.json({ success: true, message: 'Logs cleared' })
  } catch (err) {
    console.error('Error clearing logs:', err)
    res.status(500).json({ success: false, error: 'Failed to clear logs' })
  }
})

app.use('/api', analyzeRoute)
app.use('/api', chatRoute)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`))

// Export logsDir for use in other modules
module.exports = { logsDir }
