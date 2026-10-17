import type { RabRow, RabSheet } from './ahspRab'
import type { RabUsageReport } from './ahspRabUsage'

export type RabSavedSession = {
  version: 1; id: string; name: string; savedAt: string; filename: string;
  sheets: RabSheet[]; selected: string[]; rows: RabRow[]; catalogAt: string;
  limitedAccepted: boolean; duplicatesAccepted: boolean; usageReport: RabUsageReport | null;
}
export type RabSavedSummary = Pick<RabSavedSession, 'id' | 'name' | 'savedAt' | 'filename'> & { count: number }

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ahsp-rab', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Penyimpanan browser tidak dapat dibuka.'))
    request.onblocked = () => reject(new Error('Tutup tab RAB lain lalu coba simpan kembali.'))
  })
}
async function access<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('sessions', mode)
      const request = run(transaction.objectStore('sessions'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(new Error('Penyimpanan gagal. Periksa ruang penyimpanan browser, lalu coba lagi.'))
      transaction.onerror = () => reject(new Error('Penyimpanan gagal. Data di halaman masih tersedia.'))
    })
  } finally { db.close() }
}
export async function listRabSessions(): Promise<RabSavedSummary[]> {
  const sessions = await access<RabSavedSession[]>('readonly', store => store.getAll())
  return sessions.filter(session => session.version === 1).map(({ id, name, savedAt, filename, rows }) => ({ id, name, savedAt, filename, count: rows.filter(row => !row.excluded).length })).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}
export async function readRabSession(id: string): Promise<RabSavedSession> {
  const session = await access<RabSavedSession | undefined>('readonly', store => store.get(id))
  if (!session || session.version !== 1 || !Array.isArray(session.rows) || !Array.isArray(session.sheets)) throw new Error('Simpanan tidak ditemukan atau formatnya belum didukung.')
  return session
}
export async function saveRabSession(session: RabSavedSession) {
  await access('readwrite', store => store.put(session))
}
export async function deleteRabSession(id: string) {
  await access('readwrite', store => store.delete(id))
}
