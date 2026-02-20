import React, { useState, useRef, useEffect, useCallback } from 'react'
import ResultsPanel from '../components/ResultsPanel'
import normalizeResult from '../utils/normalizeResult'
import Header from '../components/Header'
import { useAnalysis } from '../context/AnalysisContext'
import axios from 'axios'
import { API_BASE } from '../services/api'

const SUPPORTED_DRUGS = ['CODEINE', 'WARFARIN', 'CLOPIDOGREL', 'SIMVASTATIN', 'AZATHIOPRINE', 'FLUOROURACIL']
const HISTORY_KEY = 'pharma_sessions'

/* ── localStorage helpers ───────────────────────────────────────────────── */

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveSessions(sessions) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions))
}

/* ── Typing Indicator ───────────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/* ── Chat message renderer ──────────────────────────────────────────────── */

function ChatMessage({ msg, onSelectDrug, onAnalyze, selectedDrugs, onAddCustomDrug }) {
  const [customText, setCustomText] = useState('')

  if (msg.type === 'system') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">💊</div>
            <span className="text-xs text-neutral-500 font-medium">PharmaGuard</span>
          </div>
          <div className="bg-neutral-800 text-neutral-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-line border border-neutral-700">
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'user') {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'drug-select') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[90%] sm:max-w-[75%]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">💊</div>
            <span className="text-xs text-neutral-500 font-medium">PharmaGuard</span>
          </div>
          <div className="bg-neutral-800 text-neutral-200 px-4 py-4 rounded-2xl rounded-tl-sm border border-neutral-700">
            <p className="text-sm mb-3">Great! Your VCF file has been uploaded. Now select the drugs you'd like to analyze:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SUPPORTED_DRUGS.map(d => (
                <button key={d} onClick={() => onSelectDrug(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${selectedDrugs.includes(d)
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
                    : 'bg-neutral-900 text-neutral-300 border-neutral-600 hover:border-emerald-400 hover:text-emerald-300'
                    }`}>{selectedDrugs.includes(d) ? '✓ ' : ''}{d}</button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={customText} onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customText.trim()) { onAddCustomDrug(customText.trim().toUpperCase()); setCustomText('') } }}
                placeholder="Or type a custom drug name..."
                className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
              <button onClick={() => { if (customText.trim()) { onAddCustomDrug(customText.trim().toUpperCase()); setCustomText('') } }}
                disabled={!customText.trim()}
                className="px-3 py-1.5 bg-neutral-900 border border-neutral-600 rounded-lg text-xs text-neutral-300 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add</button>
            </div>
            {selectedDrugs.length > 0 && (
              <div className="mb-3 text-xs text-neutral-400">Selected: <span className="text-emerald-400 font-semibold">{selectedDrugs.join(', ')}</span></div>
            )}
            <button onClick={onAnalyze} disabled={selectedDrugs.length === 0}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${selectedDrugs.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30' : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                }`}>{selectedDrugs.length > 0 ? `🔬 Analyze ${selectedDrugs.length} drug${selectedDrugs.length > 1 ? 's' : ''}` : 'Select drugs to continue'}</button>
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'loading') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">💊</div>
            <span className="text-xs text-neutral-500 font-medium">PharmaGuard</span>
          </div>
          <div className="bg-neutral-800 rounded-2xl rounded-tl-sm border border-neutral-700">
            <TypingIndicator />
            <div className="px-4 pb-3 text-xs text-neutral-400">Analyzing genomic variants...</div>
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'error') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">⚠️</div>
            <span className="text-xs text-neutral-500 font-medium">PharmaGuard</span>
          </div>
          <div className="bg-red-900/40 text-red-300 px-4 py-3 rounded-2xl rounded-tl-sm text-sm border border-red-800/50">{msg.content}</div>
        </div>
      </div>
    )
  }

  return null
}

/* ── Q&A Chat Panel (Right Side) ─────────────────────────────────────────── */

function QAPanel({ reports, qaMessages, setQaMessages, onSaveSession }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const qaEndRef = useRef(null)

  useEffect(() => { qaEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [qaMessages])

  async function handleAsk() {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    const newMsgs = [...qaMessages, { role: 'user', content: q }]
    setQaMessages(newMsgs)
    setLoading(true)
    try {
      const resp = await axios.post(`${API_BASE}/api/chat`, { question: q, reports })
      const answer = resp.data?.answer || 'No response received.'
      const updated = [...newMsgs, { role: 'assistant', content: answer }]
      setQaMessages(updated)
      onSaveSession()
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Failed to get a response. Please try again.'
      const updated = [...newMsgs, { role: 'assistant', content: `❌ ${errMsg}` }]
      setQaMessages(updated)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 rounded-2xl border border-neutral-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-700 bg-neutral-800 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">🤖</div>
        <div>
          <div className="text-sm font-semibold text-white">PharmaGuard AI</div>
          <div className="text-[10px] text-neutral-500">Ask questions about your results</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {qaMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
            <div className={`max-w-[90%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-tl-sm'
              }`}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-neutral-800 rounded-2xl rounded-tl-sm border border-neutral-700"><TypingIndicator /></div>
          </div>
        )}
        <div ref={qaEndRef} />
      </div>
      <div className="px-3 py-3 border-t border-neutral-700 bg-neutral-800">
        <div className="flex gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
            placeholder="Ask about your results..."
            disabled={loading}
            className="flex-1 bg-neutral-900 border border-neutral-600 rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50" />
          <button onClick={handleAsk} disabled={!question.trim() || loading}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── History Sidebar ─────────────────────────────────────────────────────── */

function HistorySidebar({ sessions, activeId, onSelect, onDelete, sidebarOpen, setSidebarOpen }) {
  return (
    <div className={`h-full bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-10'}`}>
      {/* PharmaGuard branding + Toggle */}
      <div className="px-2.5 py-3 border-b border-neutral-800 flex items-center gap-2">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity whitespace-nowrap">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xs shadow-md flex-shrink-0">
            💊
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-sm font-bold tracking-tight">PharmaGuard</div>
              <div className="text-[9px] text-neutral-400">Genomic Drug Safety</div>
            </div>
          )}
        </button>
        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(false)}
            className="ml-auto text-neutral-500 hover:text-white text-xs transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* Session list — only visible when open */}
      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2 px-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-xs text-neutral-600 text-center py-8">No history yet</div>
          )}
          {sessions.map(s => (
            <div key={s.id}
              onClick={() => onSelect(s.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm ${s.id === activeId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                }`}>
              <span className="text-xs">💊</span>
              <div className="flex-1 truncate">
                <div className="truncate font-medium text-xs">{s.title || 'Untitled'}</div>
                <div className="text-[10px] text-neutral-500">{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-all text-xs p-1">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Dashboard ──────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { analysisResult, setAnalysisResult, file, setFile, drugs, setDrugs, clearAll } = useAnalysis()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [toast, setToast] = useState(null)
  const [rawReports, setRawReports] = useState(null)
  const [qaMessages, setQaMessages] = useState([
    { role: 'assistant', content: '👋 I have your drug analysis reports ready. Ask me anything about the results — drug interactions, dosage adjustments, gene implications, or anything else!' }
  ])
  const [sessions, setSessions] = useState(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const showWelcome = messages.length === 0
  const hasResults = !!analysisResult

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Save current session to localStorage
  const saveCurrentSession = useCallback(() => {
    if (!activeSessionId || !analysisResult) return
    const updated = sessions.map(s =>
      s.id === activeSessionId
        ? { ...s, messages, drugs, analysisResult, rawReports, qaMessages, updatedAt: Date.now() }
        : s
    )
    setSessions(updated)
    saveSessions(updated)
  }, [activeSessionId, messages, drugs, analysisResult, rawReports, qaMessages, sessions])

  // Auto-save when Q&A messages change
  useEffect(() => {
    if (activeSessionId && analysisResult) saveCurrentSession()
  }, [qaMessages])

  function createSession(fileName, drugList) {
    const id = `session_${Date.now()}`
    const title = `${drugList.join(', ')} — ${fileName}`
    const session = {
      id, title, fileName, createdAt: Date.now(), updatedAt: Date.now(), messages: [], drugs: drugList, analysisResult: null, rawReports: null, qaMessages: [
        { role: 'assistant', content: '👋 I have your drug analysis reports ready. Ask me anything about the results — drug interactions, dosage adjustments, gene implications, or anything else!' }
      ]
    }
    const updated = [session, ...sessions]
    setSessions(updated)
    saveSessions(updated)
    setActiveSessionId(id)
    return id
  }

  function handleFileSelect(f) {
    if (!f) return
    const name = (f.name || '').toLowerCase()
    if (!name.endsWith('.vcf')) {
      setToast({ type: 'error', message: '❌ Invalid file format. Please upload a .vcf file.' })
      setTimeout(() => setToast(null), 4000)
      return
    }
    setFile(f)
    setDrugs([])
    setAnalysisResult(null)
    setRawReports(null)
    setQaMessages([{ role: 'assistant', content: '👋 I have your drug analysis reports ready. Ask me anything about the results — drug interactions, dosage adjustments, gene implications, or anything else!' }])
    setMessages(prev => [...prev, { type: 'user', content: `📄 Uploaded ${f.name}` }, { type: 'drug-select' }])
  }

  function toggleDrug(d) {
    if (drugs.includes(d)) setDrugs(drugs.filter(x => x !== d))
    else setDrugs([...drugs, d])
  }

  function addCustomDrug(d) {
    if (!d || drugs.includes(d)) return
    setDrugs([...drugs, d])
  }

  async function handleAnalyze() {
    if (!file || drugs.length === 0) return
    setLoading(true)

    const newMessages = [
      ...messages.filter(m => m.type !== 'drug-select'),
      { type: 'user', content: `🔬 Analyze: ${drugs.join(', ')}` },
      { type: 'loading' }
    ]
    setMessages(newMessages)

    try {
      const form = new FormData()
      form.append('vcf_file', file)
      form.append('drugs', drugs.join(','))
      const resp = await axios.post(`${API_BASE}/api/analyze`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const normalized = normalizeResult(resp.data)
      setAnalysisResult({ normalized, raw: resp.data })

      const reports = resp.data?.results || (Array.isArray(normalized) ? normalized : [normalized])
      setRawReports(reports)

      const finalMessages = newMessages.filter(m => m.type !== 'loading')
      setMessages(finalMessages)

      // Create/update session
      const sid = createSession(file.name, [...drugs])
      const allSessions = loadSessions()
      const updatedSessions = allSessions.map(s =>
        s.id === sid ? { ...s, messages: finalMessages, drugs: [...drugs], analysisResult: { normalized, raw: resp.data }, rawReports: reports, updatedAt: Date.now() } : s
      )
      setSessions(updatedSessions)
      saveSessions(updatedSessions)

    } catch (e) {
      const backendMsg = e.response?.data?.message || e.response?.data?.error || 'Unable to analyze. Please try again.'
      setMessages(prev => [...prev.filter(m => m.type !== 'loading'), { type: 'error', content: `❌ ${backendMsg}` }])
    } finally { setLoading(false) }
  }

  function handleNewChat() {
    clearAll()
    setMessages([])
    setRawReports(null)
    setActiveSessionId(null)
    setQaMessages([{ role: 'assistant', content: '👋 I have your drug analysis reports ready. Ask me anything about the results — drug interactions, dosage adjustments, gene implications, or anything else!' }])
    setLoading(false)
  }

  function handleSelectSession(id) {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    setActiveSessionId(id)
    setMessages(session.messages || [])
    setDrugs(session.drugs || [])
    setAnalysisResult(session.analysisResult || null)
    setRawReports(session.rawReports || null)
    setQaMessages(session.qaMessages || [{ role: 'assistant', content: '👋 I have your drug analysis reports ready. Ask me anything!' }])
    setFile(null) // Can't restore File objects from localStorage
  }

  function handleDeleteSession(id) {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    saveSessions(updated)
    if (activeSessionId === id) handleNewChat()
  }

  function onDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="h-screen bg-neutral-950 text-white flex overflow-hidden">

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar — History */}
        <HistorySidebar
          sessions={sessions} activeId={activeSessionId}
          onSelect={handleSelectSession} onDelete={handleDeleteSession}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {hasResults ? (
            /* ── SPLIT LAYOUT: Results (left) + Q&A (right) ────────── */
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[60%] overflow-y-auto px-6 py-6 border-r border-neutral-800 scrollbar-hide">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">📊 Analysis Results</h2>
                  <button onClick={handleNewChat}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-400 hover:text-white hover:border-neutral-600 transition-all">
                    + New Analysis
                  </button>
                </div>
                <div className="rounded-2xl">
                  <ResultsPanel data={analysisResult.normalized} raw={analysisResult.raw} selectedDrugs={drugs} />
                </div>
              </div>
              <div className="w-[40%] p-4 h-full overflow-hidden">
                <QAPanel reports={rawReports || []} qaMessages={qaMessages} setQaMessages={setQaMessages} onSaveSession={saveCurrentSession} />
              </div>
            </div>
          ) : (
            /* ── SINGLE COLUMN: Welcome / Upload / Drug Select ───── */
            <>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-40 scrollbar-hide">
                <div className="max-w-4xl mx-auto py-8">
                  {showWelcome && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeIn">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-emerald-600/30 mb-6">💊</div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Hi, Welcome to PharmaGuard</h1>
                      <p className="text-neutral-400 text-sm sm:text-base max-w-md mb-2">Ready to analyze your genomic data for drug interactions?</p>

                    </div>
                  )}
                  {!showWelcome && (
                    <div className="space-y-6">
                      {messages.map((msg, idx) => (
                        <ChatMessage key={idx} msg={msg} onSelectDrug={toggleDrug} onAnalyze={handleAnalyze} selectedDrugs={drugs} onAddCustomDrug={addCustomDrug} />
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Bottom Input Bar */}
              <div className="sticky bottom-0 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent pt-8 pb-4 px-4"
                onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragActive(true) }} onDragLeave={e => { e.preventDefault(); setDragActive(false) }}>
                <div className="max-w-3xl mx-auto">
                  <div className={`bg-neutral-800 rounded-2xl border transition-all duration-200 ${dragActive ? 'border-emerald-500 shadow-lg shadow-emerald-600/20' : 'border-neutral-700'}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-600 flex items-center justify-center text-neutral-400 hover:text-emerald-400 hover:border-emerald-500 transition-all duration-200 flex-shrink-0" title="Upload VCF file">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                      <input ref={fileInputRef} type="file" accept=".vcf" className="hidden" onChange={e => handleFileSelect(e.target.files[0])} />
                      <div className="flex-1 text-sm text-neutral-400">
                        {file ? <span className="text-emerald-400">📄 {file.name}</span> : <span>{dragActive ? 'Drop your VCF file here...' : 'Attach your .vcf file to begin analysis'}</span>}
                      </div>
                      {messages.length > 0 && (
                        <button onClick={handleNewChat}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-600 text-xs text-neutral-400 hover:text-white hover:border-neutral-500 transition-all duration-200 flex-shrink-0">+ New</button>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-neutral-600 mt-2">Recommendations based on CPIC guidelines. For informational purposes only — not medical advice.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 px-4 py-3 rounded-lg shadow-lg z-50 animate-fadeIn ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <div className="text-sm font-medium">{toast.message}</div>
        </div>
      )}
    </div>
  )
}
