import React, { useState, useEffect } from 'react'
import Header from './Header'
import { API_BASE } from '../services/api'

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

export default function HistoricalLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState(null)
  const [toast, setToast] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => {
    fetchLogs()
    // Set up interval to auto-refresh logs every 3 seconds
    const interval = setInterval(() => {
      fetchLogs()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(false) // Don't show loading state for continuous fetches
      const response = await fetch(`${API_BASE}/api/logs`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs.reverse()) // Show newest first
        console.log('✅ Logs fetched successfully:', data.logs.length, 'entries')
      } else {
        console.warn('⚠️ Unexpected logs response:', data)
        setLogs([])
      }
    } catch (err) {
      console.error('❌ Error fetching logs:', err)
      // Don't show error toast for auto-refresh failures
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const downloadJSON = (log) => {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${log.patient_id}-${log.drug}-${log.log_id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`📥 Log file downloaded successfully`)
  }

  const copyJSON = (log) => {
    const json = JSON.stringify(log, null, 2)
    navigator.clipboard.writeText(json)
    showToast(`📋 Log data copied to clipboard`)
  }

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/logs`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setLogs([])
        setExpandedLog(null)
        showToast('📋 All logs cleared successfully')
      }
    } catch (err) {
      console.error('Error clearing logs:', err)
      showToast('Failed to clear logs', 'error')
    }
  }

  const filteredLogs = logs.filter(log => {
    const searchLower = searchFilter.toLowerCase()
    return (
      log.patient_name?.toLowerCase().includes(searchLower) ||
      log.patient_id?.toLowerCase().includes(searchLower) ||
      log.drug?.toLowerCase().includes(searchLower) ||
      log.log_id?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📋 Historical Analysis Logs</h1>
          <p className="text-slate-600">View all analysis records generated till date</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder="Search by Patient name, Drug name, or Log ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              onClick={fetchLogs}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
            >
              🗑️ Clear All
            </button>
          </div>
          <div className="mt-4 text-sm text-slate-600">
            Total Logs: <span className="font-semibold text-slate-900">{logs.length}</span> |
            Filtered: <span className="font-semibold text-slate-900">{filteredLogs.length}</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
            </div>
            <p className="mt-4 text-slate-600 font-medium">Loading logs...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLogs.length === 0 && logs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-slate-600 text-lg">📭 No analysis logs found</p>
            <p className="text-slate-500 text-sm mt-2">Analysis records will appear here after you run your first analysis</p>
          </div>
        )}

        {/* No Results State */}
        {!loading && filteredLogs.length === 0 && logs.length > 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-slate-600 text-lg">🔍 No logs match your search</p>
            <p className="text-slate-500 text-sm mt-2">Try adjusting your search filter</p>
          </div>
        )}

        {/* Logs List */}
        {!loading && filteredLogs.length > 0 && (
          <div className="space-y-4">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Log Summary */}
                <div
                  onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                  className="px-6 py-4 cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-bold text-sky-600 truncate">
                        {log.drug || 'Unknown Drug'}
                      </h3>
                      <RiskBadge risk_label={log.risk_assessment?.risk_label || 'Unknown'} />
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>👤 Patient: <span className="font-mono font-semibold">{log.patient_name || log.patient_id}</span></p>
                      <p>⏰ Logged: <span className="font-semibold">{new Date(log.logged_at).toLocaleString()}</span></p>
                      {log.timestamp && (
                        <p>📅 Analyzed: <span className="font-semibold">{new Date(log.timestamp).toLocaleString()}</span></p>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl">
                    {expandedLog === idx ? '▼' : '▶'}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === idx && (
                  <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                    {/* Confidence & Severity */}
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-sky-200">
                        <div className="text-sm text-slate-600 font-semibold mb-1">Confidence Score</div>
                        <div className="text-2xl font-bold text-sky-600">
                          {Math.round((log.risk_assessment?.confidence_score || 0) * 100)}%
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-orange-200">
                        <div className="text-sm text-slate-600 font-semibold mb-1">Severity</div>
                        <div className="text-lg font-bold capitalize text-orange-600">
                          {log.risk_assessment?.severity || 'Unknown'}
                        </div>
                      </div>
                    </div>

                    {/* Pharmacogenomic Profile */}
                    {log.pharmacogenomic_profile && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-slate-700 mb-2">Pharmacogenomic Profile</h4>
                        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 text-sm">
                          <p><span className="font-semibold text-slate-600">Primary Gene:</span> <span className="font-mono">{log.pharmacogenomic_profile.primary_gene || 'N/A'}</span></p>
                          <p><span className="font-semibold text-slate-600">Diplotype:</span> <span className="font-mono">{log.pharmacogenomic_profile.diplotype || 'N/A'}</span></p>
                          <p><span className="font-semibold text-slate-600">Phenotype:</span> <span className="font-mono">{log.pharmacogenomic_profile.phenotype || 'N/A'}</span></p>
                        </div>
                      </div>
                    )}

                    {/* Clinical Recommendation */}
                    {log.clinical_recommendation && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-slate-700 mb-2">Clinical Recommendation</h4>
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800">
                          {log.clinical_recommendation}
                        </div>
                      </div>
                    )}

                    {/* LLM Explanation */}
                    {log.llm_generated_explanation && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-slate-700 mb-2">Analysis Explanation</h4>
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 max-h-40 overflow-y-auto">
                          {log.llm_generated_explanation}
                        </div>
                      </div>
                    )}

                    {/* Full JSON Preview */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-700 mb-2">Full JSON Data</h4>
                      <div className="bg-white p-4 rounded-lg border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto max-h-40 overflow-y-auto">
                        <pre>{JSON.stringify(log, null, 2)}</pre>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => copyJSON(log)}
                        className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded transition-colors"
                      >
                        📋 Copy JSON
                      </button>
                      <button
                        onClick={() => downloadJSON(log)}
                        className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded transition-colors"
                      >
                        ⬇️ Download JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
