'use client'
import { useRef, useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { formatDate } from '@/lib/utils'
import { Upload, Trash2, Download, FileText, X, ExternalLink, Archive } from 'lucide-react'
import { DOCUMENT_CATEGORIES, DocumentCategory } from '@/lib/types'

const CATEGORY_COLORS: Record<DocumentCategory, { bg: string; color: string }> = {
  contract: { bg: '#eff6ff', color: '#2f6bdc' },
  ks2:      { bg: '#f0fdf4', color: '#16a34a' },
  ks3:      { bg: '#f0fdf4', color: '#1f8a5b' },
  estimate: { bg: '#fff7ed', color: '#e07a1a' },
  act:      { bg: '#fdf4ff', color: '#9b5de5' },
  project:  { bg: '#fff1f2', color: '#e11d48' },
  other:    { bg: '#f9fafb', color: '#6b7280' },
}

function getDocInfo(fileType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const isImage = fileType.startsWith('image/')
  const isPdf = fileType === 'application/pdf' || ext === 'pdf'
  const isOffice = ['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)
  const isArchive = ['zip','rar','7z','tar','gz','bz2'].includes(ext)
  const canPreview = isImage || isPdf || isOffice
  return { isImage, isPdf, isOffice, isArchive, canPreview }
}

function getPdfProxyUrl(fileUrl: string, filePath?: string) {
  return filePath
    ? `/api/preview-doc?path=${encodeURIComponent(filePath)}`
    : `/api/preview-public?url=${encodeURIComponent(fileUrl)}`
}

export function ContractDocuments({ contractId }: { contractId: string }) {
  const { documents, contracts, addDocument, deleteDocument, syncDocuments } = useStore()
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('other')
  const [filterCat, setFilterCat] = useState<DocumentCategory | 'all'>('all')
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const contract = contracts.find(c => c.id === contractId)

  useEffect(() => {
    setSyncing(true)
    syncDocuments().catch(console.error).finally(() => setSyncing(false))
  }, [contractId])

  const contractDocs = documents
    .filter(d => d.contractId === contractId)
    .filter(d => filterCat === 'all' || d.category === filterCat)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  const allDocs = documents.filter(d => d.contractId === contractId)

  const handleFiles = async (files: File[]) => {
    if (!files.length || !contract) return
    setUploading(true); setError('')
    try {
      const contractNumber = contract.number || contractId
      for (const file of files) {
        const urlRes = await fetch('/api/get-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, contractNumber, contractId }),
        })
        const urlData = await urlRes.json()
        if (!urlRes.ok) throw new Error(urlData?.error || 'Не удалось получить ссылку')

        const uploadRes = await fetch(urlData.uploadUrl, {
          method: 'PUT', body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        })
        if (!uploadRes.ok) throw new Error(`Ошибка загрузки: ${uploadRes.status}`)

        const finalRes = await fetch('/api/finalize-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: urlData.path, contractId, fileName: file.name, fileSize: file.size, fileType: file.type || 'application/octet-stream', category }),
        })
        const finalData = await finalRes.json()
        if (!finalRes.ok) throw new Error(finalData?.error || 'Ошибка сохранения')
        await addDocument(finalData.document)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(Array.from(e.target.files ?? []))
  }

  const handleDrop = async (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading || syncing) return
    await handleFiles(Array.from(e.dataTransfer.files))
  }

  const [catOverrides, setCatOverrides] = useState<Record<string, DocumentCategory>>({})

  const handleCategoryChange = async (docId: string, newCategory: DocumentCategory) => {
    setCatOverrides(prev => ({ ...prev, [docId]: newCategory }))
    try {
      await fetch('/api/mutate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'documents', action: 'update', data: { category: newCategory }, id: docId }),
      })
    } catch (err) {
      setCatOverrides(prev => { const n = { ...prev }; delete n[docId]; return n })
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm('Удалить документ?') || !contract) return
    try {
      const doc = documents.find(d => d.id === docId)
      const resp = await fetch('/api/delete-doc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, fileName: doc?.fileName, contractNumber: contract.number || contractId }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Delete failed')
      await deleteDocument(docId)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: 20 }}>

      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>📎 Документы ({allDocs.length})</div>
      </div>

      {/* Фильтр по категориям */}
      {allDocs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setFilterCat('all')}
            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: filterCat === 'all' ? '#2f6bdc' : '#fff', color: filterCat === 'all' ? '#fff' : 'var(--muted-ink)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
            Все {allDocs.length}
          </button>
          {DOCUMENT_CATEGORIES.filter(c => allDocs.some(d => (d.category || 'other') === c.value)).map(c => {
            const count = allDocs.filter(d => (d.category || 'other') === c.value).length
            const col = CATEGORY_COLORS[c.value]
            return (
              <button key={c.value} onClick={() => setFilterCat(c.value)}
                style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${filterCat === c.value ? col.color : 'var(--line)'}`, background: filterCat === c.value ? col.color : col.bg, color: filterCat === c.value ? '#fff' : col.color, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
                {c.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Список документов */}
      {contractDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 300, overflowY: 'auto' }}>
          {contractDocs.map(doc => {
            const cat = (catOverrides[doc.id] ?? doc.category ?? 'other') as DocumentCategory
            const col = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other
            const { canPreview, isOffice, isArchive } = getDocInfo(doc.fileType, doc.fileName)
            const openDoc = async () => {
              if (!canPreview) { window.open(doc.fileUrl, '_blank'); return }
              if (isOffice) {
                // Office: получаем прямую ссылку, потом Office Online viewer
                const params = doc.filePath
                  ? `path=${encodeURIComponent(doc.filePath)}`
                  : `url=${encodeURIComponent(doc.fileUrl)}`
                const res = await fetch(`/api/office-url?${params}`)
                const { href } = await res.json()
                const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(href)}`
                setPreview({ url: viewerUrl, name: doc.fileName, type: doc.fileType })
              } else {
                setPreview({ url: getPdfProxyUrl(doc.fileUrl, doc.filePath), name: doc.fileName, type: doc.fileType })
              }
            }
            return (
              <div key={doc.id} onClick={openDoc}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, transition: 'background .12s, border-color .12s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbfc'; (e.currentTarget as HTMLElement).style.borderColor = '#c5ccd6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isArchive ? '#fef3c7' : col.bg, color: isArchive ? '#d97706' : col.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {isArchive ? <Archive size={16} /> : <FileText size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.fileName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <select value={cat} onChange={e => handleCategoryChange(doc.id, e.target.value as DocumentCategory)}
                      onClick={e => e.stopPropagation()}
                      style={{ background: col.bg, color: col.color, border: `1px solid ${col.color}30`, padding: '1px 5px', borderRadius: 4, fontWeight: 600, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                      {DOCUMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span>{(doc.fileSize / 1024).toFixed(1)} KB · {formatDate(doc.uploadedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => window.open(doc.fileUrl, '_blank')} title="Скачать"
                    style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--maf)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--faint)'}>
                    <Download size={15} />
                  </button>
                  <button onClick={() => handleDelete(doc.id, doc.fileName)} title="Удалить"
                    style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--faint)' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Загрузка с выбором категории */}
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}
          style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, background: '#fff', color: 'var(--ink)', flexShrink: 0 }}>
          {DOCUMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading || syncing}
          onDragEnter={e => { e.preventDefault(); if (!uploading && !syncing) setDragOver(true) }}
          onDragOver={e => { e.preventDefault(); if (!uploading && !syncing) e.dataTransfer.dropEffect = 'copy' }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
          onDrop={handleDrop}
          title={syncing ? 'Дождитесь окончания синхронизации' : ''}
          style={{ flex: 1, padding: '9px 14px', border: `1.5px dashed ${syncing ? '#f59e0b' : dragOver ? '#2f6bdc' : '#d4dae2'}`, borderRadius: 10, background: syncing ? '#fffbeb' : dragOver ? '#eff6ff' : 'none', fontFamily: 'inherit', fontSize: 13, color: syncing ? '#d97706' : dragOver ? 'var(--maf)' : 'var(--faint)', cursor: uploading || syncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'border-color .15s, background .15s, color .15s' }}
          onMouseEnter={e => { if (!uploading && !syncing) { (e.currentTarget as HTMLElement).style.borderColor = '#2f6bdc'; (e.currentTarget as HTMLElement).style.color = 'var(--maf)' } }}
          onMouseLeave={e => { if (!syncing) { (e.currentTarget as HTMLElement).style.borderColor = '#d4dae2'; (e.currentTarget as HTMLElement).style.color = 'var(--faint)' } }}>
          {syncing ? (
            <>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #f59e0b', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Подождите, идёт синхронизация...
            </>
          ) : uploading ? (
            <>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #2f6bdc', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Загрузка...
            </>
          ) : (
            <><Upload size={14} /> {dragOver ? 'Отпустите файлы для загрузки' : 'Перетащите документы сюда или нажмите'}</>
          )}
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.dwg,.zip,.rar,.7z,.tar,.gz,.bz2" style={{ display: 'none' }} />

      {/* Модал просмотра */}
      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 960, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Шапка */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</span>
              <a href={preview.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--maf)', textDecoration: 'none', fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--line)' }}>
                <ExternalLink size={13} /> Открыть
              </a>
              <button onClick={() => setPreview(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)' }}>
                <X size={16} />
              </button>
            </div>
            {/* Контент */}
            <div style={{ flex: 1, overflow: 'hidden', background: '#f0f0f0' }}>
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={preview.url} style={{ width: '100%', height: '100%', border: 'none' }} title={preview.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
