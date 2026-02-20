import React, { useRef, useState } from 'react'
import { IconUpload } from './icons'

export default function UploadZone({ file, setFile, uploadError, setUploadError }) {
  const ref = useRef()
  const [dragActive, setDragActive] = useState(false)

  function onPick(e) {
    const f = e.target.files[0]
    handleFile(f)
  }

  function handleFile(f) {
    // reset previous error
    setUploadError && setUploadError('')
    if (!f) return
    const name = (f.name || '').toLowerCase()
    if (!name.endsWith('.vcf')) {
      setFile(null)
      setUploadError && setUploadError('Invalid file format. Please upload a .vcf (Variant Call Format) file.')
      return
    }
    setFile(f)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files[0])
  }

  function onDragOver(e) { e.preventDefault(); setDragActive(true) }
  function onDragLeave(e) { e.preventDefault(); setDragActive(false) }

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">Upload Genomic VCF</label>
      <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} className={`border-2 border-dashed rounded-lg p-8 mt-3 transition-all duration-200 ${dragActive ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:border-sky-400'}`} role="region" aria-label="VCF upload">
        <div className="flex items-center justify-center flex-col">
          <div className="mb-3 text-slate-400" style={{ transform: dragActive ? 'scale(1.05)' : 'scale(1)', transition: 'transform 180ms' }}><IconUpload /></div>
          <div className="text-base font-semibold text-slate-900">Upload Genomic VCF</div>
          <div className="text-sm text-slate-600 mt-2">.vcf files only</div>

          <div className="mt-4">
            <label className="px-4 py-2 bg-sky-600 text-white rounded-lg cursor-pointer hover:bg-sky-700 transition-colors duration-200 font-medium text-sm">Choose file
              <input className="sr-only" ref={ref} onChange={onPick} type="file" accept=".vcf" />
            </label>
          </div>

          {file && !uploadError && (
            <div className="mt-4 w-full max-w-xs">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="text-sm font-medium text-green-700">VCF verified</div>
                  <div className="text-xs text-slate-600">{file.name}</div>
                </div>
              </div>
            </div>
          )}

          {uploadError && <div className="mt-3 text-sm text-red-700 flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 17h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{uploadError}</span></div>}
        </div>
      </div>
    </div>
  )
}
