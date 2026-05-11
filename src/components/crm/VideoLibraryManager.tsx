'use client'

import { useState, useEffect } from 'react'

type CategoryVideo = {
  id: string
  name: string
  url: string
}

type VideoCategory = {
  id: string
  name: string
  videos: CategoryVideo[]
}

export function VideoLibraryManager() {
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)

  const [newVidName, setNewVidName] = useState('')
  const [newVidUrl, setNewVidUrl] = useState('')
  const [addingVid, setAddingVid] = useState(false)

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)
  const [deletingVidId, setDeletingVidId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/video-library')
      const data = await res.json()
      setCategories(data.categories ?? [])
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const selected = categories.find(c => c.id === selectedId) ?? null

  async function createCategory() {
    if (!newCatName.trim() || addingCat) return
    setAddingCat(true)
    try {
      const res = await fetch('/api/whatsapp/video-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const data = await res.json()
      if (data.category) {
        setCategories(prev => [...prev, data.category])
        setSelectedId(data.category.id)
        setNewCatName('')
        setShowNewCat(false)
      }
    } finally {
      setAddingCat(false)
    }
  }

  async function deleteCategory(id: string) {
    if (deletingCatId) return
    setDeletingCatId(id)
    try {
      await fetch(`/api/whatsapp/video-library/${id}`, { method: 'DELETE' })
      setCategories(prev => prev.filter(c => c.id !== id))
      if (selectedId === id) setSelectedId(null)
    } finally {
      setDeletingCatId(null)
    }
  }

  async function addVideo() {
    if (!selectedId || !newVidName.trim() || !newVidUrl.trim() || addingVid) return
    setAddingVid(true)
    try {
      const res = await fetch(`/api/whatsapp/video-library/${selectedId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVidName.trim(), url: newVidUrl.trim() }),
      })
      const data = await res.json()
      if (data.video) {
        setCategories(prev => prev.map(c =>
          c.id === selectedId ? { ...c, videos: [...c.videos, data.video] } : c
        ))
        setNewVidName('')
        setNewVidUrl('')
      }
    } finally {
      setAddingVid(false)
    }
  }

  async function deleteVideo(catId: string, vidId: string) {
    if (deletingVidId) return
    setDeletingVidId(vidId)
    try {
      await fetch(`/api/whatsapp/video-library/${catId}/videos?video_id=${vidId}`, { method: 'DELETE' })
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, videos: c.videos.filter(v => v.id !== vidId) } : c
      ))
    } finally {
      setDeletingVidId(null)
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">

      {/* Painel esquerdo: categorias */}
      <div className="w-72 flex-shrink-0 bg-[#0d1117] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h2 className="text-white font-semibold text-sm">Categorias</h2>
          <button
            onClick={() => setShowNewCat(v => !v)}
            className="text-xs bg-green-600 hover:bg-green-500 text-white px-2.5 py-1 rounded-lg transition font-medium"
          >
            + Nova
          </button>
        </div>

        {showNewCat && (
          <div className="px-3 py-2 border-b border-slate-800 flex gap-2">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCategory()}
              placeholder="Nome da categoria..."
              autoFocus
              className="flex-1 bg-slate-800 text-white text-xs rounded px-2 py-1.5 outline-none border border-slate-700 focus:border-green-500 placeholder-slate-500 transition"
            />
            <button
              onClick={createCategory}
              disabled={!newCatName.trim() || addingCat}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs px-2 py-1 rounded transition"
            >
              {addingCat ? '...' : 'OK'}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-slate-500 text-xs text-center py-6">Carregando...</p>
          ) : categories.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-6 italic px-4">
              Nenhuma categoria ainda. Clique em + Nova para criar.
            </p>
          ) : (
            categories.map(cat => (
              <div
                key={cat.id}
                className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 cursor-pointer transition group ${
                  selectedId === cat.id ? 'bg-slate-800 border-l-2 border-l-green-500' : 'hover:bg-slate-800/50'
                }`}
                onClick={() => setSelectedId(cat.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{cat.name}</p>
                  <p className="text-slate-500 text-xs">{cat.videos.length} vídeo{cat.videos.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}
                  disabled={deletingCatId === cat.id}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition p-1 flex-shrink-0"
                  title="Excluir categoria"
                >
                  {deletingCatId === cat.id ? (
                    <span className="text-[10px]">...</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Painel direito: vídeos da categoria selecionada */}
      <div className="flex-1 bg-[#0d1117] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-10 h-10 text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              <p className="text-slate-500 text-sm">Selecione uma categoria para gerenciar seus vídeos</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div>
                <h2 className="text-white font-semibold">{selected.name}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{selected.videos.length} vídeo{selected.videos.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Formulário adicionar vídeo */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Adicionar vídeo</p>
              <div className="flex flex-col gap-2">
                <input
                  value={newVidName}
                  onChange={e => setNewVidName(e.target.value)}
                  placeholder="Nome do vídeo (ex: Apresentação Divine Luxury)"
                  className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-green-500 placeholder-slate-500 transition"
                />
                <div className="flex gap-2">
                  <input
                    value={newVidUrl}
                    onChange={e => setNewVidUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addVideo()}
                    placeholder="URL do vídeo (https://...)"
                    className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-green-500 placeholder-slate-500 transition"
                  />
                  <button
                    onClick={addVideo}
                    disabled={!newVidName.trim() || !newVidUrl.trim() || addingVid}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    {addingVid ? 'Adicionando...' : '+ Adicionar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de vídeos */}
            <div className="flex-1 overflow-y-auto">
              {selected.videos.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8 italic">
                  Nenhum vídeo nessa categoria ainda.
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {selected.videos.map((vid, i) => (
                    <div key={vid.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition group">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500 font-mono text-xs">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{vid.name}</p>
                        <p className="text-slate-500 text-xs truncate mt-0.5">{vid.url}</p>
                      </div>
                      <a
                        href={vid.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition p-1 flex-shrink-0"
                        title="Abrir URL"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button
                        onClick={() => deleteVideo(selected.id, vid.id)}
                        disabled={deletingVidId === vid.id}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition p-1 flex-shrink-0"
                        title="Remover vídeo"
                      >
                        {deletingVidId === vid.id ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
