import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

export type CustomSound = { slug: string; title: string }
type Snapshot = { custom: CustomSound[]; favorites: string[] }
type Operation =
  | { type: 'import'; custom: CustomSound[]; favorites: string[] }
  | { type: 'add'; slug: string; title: string }
  | { type: 'remove'; slug: string }
  | { type: 'favorite'; slug: string; value: boolean }
export type SoundSyncStatus = 'connecting' | 'synced' | 'pending' | 'offline'

const FAVORITES_STORAGE = 'club42_quiz_myinstants_favorites'
const CUSTOM_STORAGE = 'club42_myinstants_custom'
const PENDING_STORAGE = 'club42_myinstants_pending_v1'
const MIGRATION_FLAG = 'club42_myinstants_db_migrated_v1'
const SLUG = /^[a-z0-9][a-z0-9_-]{0,149}$/

function readJSON(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null') }
  catch { return null }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch { /* Il browser può disabilitare localStorage. */ }
}

function normalizeSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('Archivio soundboard non valido')
  const data = value as { custom?: unknown; favorites?: unknown }
  if (!Array.isArray(data.custom) || !Array.isArray(data.favorites)) {
    throw new Error('Risposta soundboard incompleta')
  }
  const unique = new Set<string>()
  const custom: CustomSound[] = []
  for (const item of data.custom) {
    if (typeof item !== 'object' || item === null) continue
    const { slug, title } = item as { slug?: unknown; title?: unknown }
    if (typeof slug === 'string' && SLUG.test(slug) &&
        typeof title === 'string' && title.trim().length >= 1 &&
        title.trim().length <= 90 && !unique.has(slug)) {
      custom.push({ slug, title: title.trim() })
      unique.add(slug)
      if (custom.length >= 500) break
    }
  }
  const favorites = [...new Set(data.favorites.filter((slug): slug is string =>
    typeof slug === 'string' && SLUG.test(slug)))].slice(0, 500)
  return { custom, favorites }
}

function readCachedSnapshot(): Snapshot {
  return normalizeSnapshot({
    custom: readJSON(CUSTOM_STORAGE) || [],
    favorites: readJSON(FAVORITES_STORAGE) || []
  })
}

function readPending(): Operation[] {
  const candidate = readJSON(PENDING_STORAGE)
  if (!Array.isArray(candidate)) return []
  const result: Operation[] = []
  for (const entry of candidate.slice(0, 1000)) {
    if (!entry || typeof entry !== 'object') continue
    const op = entry as Partial<Operation> & { slug?: string; title?: string; value?: boolean }
    if (op.type === 'import') {
      try {
        const data = normalizeSnapshot(entry)
        result.push({ type: 'import', ...data })
      } catch { /* Ignora importazioni corrotte. */ }
    } else if (typeof op.slug === 'string' && SLUG.test(op.slug)) {
      if (op.type === 'add' && typeof op.title === 'string' &&
          op.title.trim().length >= 1 && op.title.trim().length <= 90) {
        result.push({ type: 'add', slug: op.slug, title: op.title.trim() })
      } else if (op.type === 'remove') {
        result.push({ type: 'remove', slug: op.slug })
      } else if (op.type === 'favorite' && typeof op.value === 'boolean') {
        result.push({ type: 'favorite', slug: op.slug, value: op.value })
      }
    }
  }
  return result
}

function applyOperation(snapshot: Snapshot, op: Operation): Snapshot {
  if (op.type === 'import') {
    const customs = [...snapshot.custom]
    const known = new Set(customs.map(item => item.slug))
    for (const item of op.custom) {
      if (!known.has(item.slug)) {
        customs.push(item)
        known.add(item.slug)
      }
    }
    return {
      custom: customs,
      favorites: [...new Set([...snapshot.favorites, ...op.favorites])]
    }
  }
  if (op.type === 'add') {
    return {
      ...snapshot,
      custom: [
        ...snapshot.custom.filter(item => item.slug !== op.slug),
        { slug: op.slug, title: op.title }
      ]
    }
  }
  if (op.type === 'remove') {
    return {
      custom: snapshot.custom.filter(item => item.slug !== op.slug),
      favorites: snapshot.favorites.filter(slug => slug !== op.slug)
    }
  }
  return {
    ...snapshot,
    favorites: op.value
      ? [...new Set([...snapshot.favorites, op.slug])]
      : snapshot.favorites.filter(slug => slug !== op.slug)
  }
}

async function sendOperation(token: string, operation: Operation): Promise<void> {
  if (operation.type === 'import') {
    const { error } = await supabase.rpc('master_soundboard_import', {
      p_session_token: token,
      p_custom: operation.custom,
      p_favorites: operation.favorites
    })
    if (error) throw error
    return
  }
  const { error } = await supabase.rpc('master_soundboard_change', {
    p_session_token: token,
    p_operation: operation.type === 'favorite' ? 'favorite' : operation.type,
    p_slug: operation.slug,
    p_title: operation.type === 'add' ? operation.title : null,
    p_favorite: operation.type === 'favorite' ? operation.value : null
  })
  if (error) throw error
}

export function useSoundboardLibrary(token: string) {
  const initial = useRef<Snapshot | null>(null)
  if (initial.current === null) {
    try { initial.current = readCachedSnapshot() }
    catch { initial.current = { custom: [], favorites: [] } }
  }
  const dataRef = useRef<Snapshot>(initial.current)
  const pendingRef = useRef<Operation[]>(readPending())
  const syncingRef = useRef(false)
  const needsResyncRef = useRef(false)
  const localChanges = useRef(0)
  const mountedRef = useRef(true)
  const [custom, setCustom] = useState<CustomSound[]>(initial.current.custom)
  const [favorites, setFavorites] = useState<string[]>(initial.current.favorites)
  const [syncStatus, setSyncStatus] = useState<SoundSyncStatus>('connecting')

  const setSnapshot = useCallback((snapshot: Snapshot) => {
    dataRef.current = snapshot
    setCustom(snapshot.custom)
    setFavorites(snapshot.favorites)
    writeJSON(CUSTOM_STORAGE, snapshot.custom)
    writeJSON(FAVORITES_STORAGE, snapshot.favorites)
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current) {
      needsResyncRef.current = true
      return
    }
    syncingRef.current = true
    try {
      do {
        needsResyncRef.current = false
        if (mountedRef.current) setSyncStatus('connecting')
        // La coda mantiene l'ordine di aggiunte, rimozioni e variazioni preferiti.
        while (pendingRef.current.length > 0) {
          const operation = pendingRef.current[0]
          await sendOperation(token, operation)
          pendingRef.current.shift()
          writeJSON(PENDING_STORAGE, pendingRef.current)
        }
        const revision = localChanges.current
        const { data, error } = await supabase.rpc('master_soundboard_get', {
          p_session_token: token
        })
        if (error) throw error
        const remote = normalizeSnapshot(data)
        if (revision === localChanges.current && mountedRef.current) {
          // Se ci sono state modifiche locali dopo la fetch, non perderle.
          const merged = pendingRef.current.reduce(applyOperation, remote)
          setSnapshot(merged)
          setSyncStatus(pendingRef.current.length ? 'pending' : 'synced')
        } else {
          needsResyncRef.current = true
        }
      } while (needsResyncRef.current && mountedRef.current)
    } catch {
      if (mountedRef.current) setSyncStatus('offline')
      // Le modifiche restano nella coda locale e verranno ritentate.
    } finally {
      syncingRef.current = false
    }
  }, [token, setSnapshot])

  useEffect(() => {
    mountedRef.current = true
    // Trasferimento UNA VOLTA dei dati salvati dalla versione precedente.
    // Se la connessione manca, l'importazione resta nella coda locale.
    let migrated = false
    try { migrated = localStorage.getItem(MIGRATION_FLAG) === '1' } catch { /* noop */ }
    if (!migrated) {
      const snapshot = dataRef.current
      if (snapshot.custom.length || snapshot.favorites.length) {
        pendingRef.current.unshift({ type: 'import', ...snapshot })
        writeJSON(PENDING_STORAGE, pendingRef.current)
      }
      try { localStorage.setItem(MIGRATION_FLAG, '1') } catch { /* noop */ }
    }
    void sync()
    const poll = window.setInterval(() => void sync(), 20000)
    const onReturn = () => void sync()
    const onVisible = () => { if (!document.hidden) void sync() }
    window.addEventListener('online', onReturn)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mountedRef.current = false
      window.clearInterval(poll)
      window.removeEventListener('online', onReturn)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync])

  function change(operation: Operation) {
    localChanges.current += 1
    setSnapshot(applyOperation(dataRef.current, operation))
    pendingRef.current.push(operation)
    writeJSON(PENDING_STORAGE, pendingRef.current)
    setSyncStatus('pending')
    void sync()
  }

  return {
    custom,
    favorites,
    syncStatus,
    pendingCount: pendingRef.current.length,
    addCustom: (sound: CustomSound) => change({ type: 'add', ...sound }),
    removeCustom: (slug: string) => change({ type: 'remove', slug }),
    setFavorite: (slug: string, value: boolean) => change({ type: 'favorite', slug, value }),
    retrySync: () => void sync()
  }
}
