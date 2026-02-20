import React, { createContext, useState, useContext, useEffect } from 'react'

const AnalysisContext = createContext()

export function AnalysisProvider({ children }) {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [file, setFile] = useState(null)
  const [drugs, setDrugs] = useState([])
  const [uploadError, setUploadError] = useState('')

  // Load from localStorage on mount
  useEffect(() => {
    const savedResult = localStorage.getItem('analysisResult')
    const savedFile = localStorage.getItem('fileName')
    const savedDrugs = localStorage.getItem('selectedDrugs')
    
    if (savedResult) {
      try {
        setAnalysisResult(JSON.parse(savedResult))
      } catch (e) {
        console.error('Error loading analysis result:', e)
      }
    }
    
    if (savedFile) {
      setFile(savedFile)
    }
    
    if (savedDrugs) {
      try {
        setDrugs(JSON.parse(savedDrugs))
      } catch (e) {
        console.error('Error loading drugs:', e)
      }
    }
  }, [])

  // Save to localStorage whenever result changes
  useEffect(() => {
    if (analysisResult) {
      localStorage.setItem('analysisResult', JSON.stringify(analysisResult))
    }
  }, [analysisResult])

  // Save to localStorage whenever file/drugs change
  useEffect(() => {
    if (file) {
      localStorage.setItem('fileName', file)
    }
  }, [file])

  useEffect(() => {
    if (drugs.length > 0) {
      localStorage.setItem('selectedDrugs', JSON.stringify(drugs))
    }
  }, [drugs])

  const clearAll = () => {
    setAnalysisResult(null)
    setFile(null)
    setDrugs([])
    setUploadError('')
    localStorage.removeItem('analysisResult')
    localStorage.removeItem('fileName')
    localStorage.removeItem('selectedDrugs')
  }

  return (
    <AnalysisContext.Provider
      value={{
        analysisResult,
        setAnalysisResult,
        file,
        setFile,
        drugs,
        setDrugs,
        uploadError,
        setUploadError,
        clearAll
      }}
    >
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const context = useContext(AnalysisContext)
  if (!context) {
    throw new Error('useAnalysis must be used within AnalysisProvider')
  }
  return context
}
