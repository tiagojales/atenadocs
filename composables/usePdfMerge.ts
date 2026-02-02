// ...existing code...
import { ref, type Ref } from 'vue'

// `useRuntimeConfig` is auto-injected by Nuxt at runtime. Declare a minimal public shape for our usage.
declare function useRuntimeConfig(): { public: { pdfMergeApiBase?: string } }

type PostDetails = {
  url: string
  fields: Record<string, string>
}

export type UploadDescriptor = {
  originalFileName: string
  key: string
  post_details: PostDetails
}

export type UsePdfMergeReturn = {
  isUploading: Ref<boolean>
  error: Ref<string | null>
  overallProgress: Ref<number>
  cancelled: Ref<boolean>
  requestPresignedPosts: (fileNames: string[]) => Promise<{ uploads: UploadDescriptor[] }>
  uploadFileWithPresigned: (post: PostDetails, file: File, onProgress?: (uploaded: number, total: number) => void, attempts?: number, id?: number) => Promise<void>
  uploadFiles: (files: File[], uploads: UploadDescriptor[], opts?: { concurrency?: number, attempts?: number, onFileProgress?: (index: number, uploaded: number, total: number) => void }) => Promise<void>
  cancelUploads: () => void
  requestMerge: (fileKeys: string[]) => Promise<{ message?: string, downloadUrl?: string, fileKey?: string }>

}

export function usePdfMerge(): UsePdfMergeReturn {
  const isUploading = ref(false)
  const error = ref<string | null>(null)
  const overallProgress = ref(0)
  const cancelled = ref(false)
  const activeXhrs: Map<number, XMLHttpRequest> = new Map()

  const getApiBase = () => {
    const config = useRuntimeConfig()
    const base = config.public.pdfMergeApiBase
    if (!base) throw new Error('API base URL not configured (pdfMergeApiBase)')
    return base.replace(/\/$/, '')
  }

  const requestPresignedPosts = async (fileNames: string[]) => {
    const base = getApiBase()
    const resp = await fetch(`${base}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileNames })
    })
    if (!resp.ok) throw new Error(`Upload request failed: ${resp.status}`)
    return (await resp.json()) as { uploads: UploadDescriptor[] }
  }

  const requestMerge = async (fileKeys: string[]) => {
    const base = getApiBase()
    const resp = await fetch(`${base}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKeys })
    })
    if (!resp.ok) throw new Error(`Merge request failed: ${resp.status}`)
    return (await resp.json()) as { message?: string, downloadUrl?: string, fileKey?: string }
  }

  const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

  // single XMLHttpRequest upload with progress + abort support
  const doXhrUpload = (post: PostDetails, file: File, onProgress?: (u: number, t: number) => void, id?: number) =>
    new Promise<void>((resolve, reject) => {
      const fd = new FormData()
      Object.entries(post.fields || {}).forEach(([k, v]) => fd.append(k, v))
      fd.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', post.url, true)
      xhr.timeout = UPLOAD_TIMEOUT_MS
      if (typeof id === 'number') activeXhrs.set(id, xhr)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
      }

      xhr.onload = () => {
        if (typeof id === 'number') activeXhrs.delete(id)
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        const status = xhr.status
        const retryable = status >= 500 || status === 0
        const err = new Error(`Upload failed with status ${status}`) as Error & { retryable?: boolean, status?: number }
        err.retryable = retryable
        err.status = status
        return reject(err)
      }

      xhr.onerror = () => {
        if (typeof id === 'number') activeXhrs.delete(id)
        const err = new Error('Network error during upload') as Error & { retryable?: boolean }
        err.retryable = true
        return reject(err)
      }

      xhr.ontimeout = () => {
        if (typeof id === 'number') activeXhrs.delete(id)
        const err = new Error('Upload timed out') as Error & { retryable?: boolean }
        err.retryable = true
        return reject(err)
      }

      xhr.onabort = () => {
        if (typeof id === 'number') activeXhrs.delete(id)
        const err = new Error('Upload aborted') as Error & { retryable?: boolean }
        err.retryable = false
        return reject(err)
      }

      xhr.send(fd)
    })

  const uploadFileWithPresigned = async (post: PostDetails, file: File, onProgress?: (uploaded: number, total: number) => void, attempts = 2, id?: number): Promise<void> => {
    let lastErr: unknown = null
    for (let i = 0; i <= attempts; i++) {
      try {
        await doXhrUpload(post, file, onProgress, id)
        return
      } catch (err: unknown) {
        lastErr = err
        const maybe = err as { retryable?: boolean }
        if (maybe.retryable === false) throw err
        if (i < attempts) await new Promise(r => setTimeout(r, 2 ** i * 250))
      }
    }
    throw lastErr
  }

  // simplified worker-pool concurrency for multiple uploads
  const uploadFiles = async (files: File[], uploads: UploadDescriptor[], opts?: { concurrency?: number, attempts?: number, onFileProgress?: (index: number, uploaded: number, total: number) => void }) => {
    if (files.length !== uploads.length) throw new Error('files and uploads length mismatch')
    const concurrency = opts?.concurrency ?? 3
    const attempts = opts?.attempts ?? 2

    isUploading.value = true
    error.value = null
    cancelled.value = false
    overallProgress.value = 0

    const uploadedBytes = new Array<number>(files.length).fill(0)
    const totalBytes = new Array<number>(files.length).fill(0)

    let nextIndex = 0
    const workers: Promise<void>[] = []

    const worker = async () => {
      while (true) {
        const i = nextIndex++
        if (i >= files.length) return
        if (cancelled.value) return
        const file = files[i]
        const descriptor = uploads[i]
        if (!file || !descriptor) throw new Error(`Missing file or descriptor at index ${i}`)
        try {
          await uploadFileWithPresigned(descriptor.post_details, file, (loaded, total) => {
            uploadedBytes[i] = loaded
            totalBytes[i] = total
            const sumUploaded = uploadedBytes.reduce((a, b) => a + b, 0)
            const sumTotal = totalBytes.reduce((a, b) => a + b, 0) || 1
            overallProgress.value = Math.round((sumUploaded / sumTotal) * 100)
            if (opts?.onFileProgress) opts.onFileProgress(i, loaded, total)
          }, attempts, i)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          throw new Error(`Failed to upload ${file.name}: ${msg}`)
        }
      }
    }

    try {
      for (let i = 0; i < Math.min(concurrency, files.length); i++) workers.push(worker())
      await Promise.all(workers)
    } finally {
      isUploading.value = false
    }
  }

  const cancelUploads = () => {
    cancelled.value = true
    for (const [_k, xhr] of activeXhrs) {
      try {
        xhr.abort()
      } catch (e) {
        void e
      }
    }
    activeXhrs.clear()
  }

  return {
    isUploading,
    error,
    overallProgress,
    cancelled,
    requestPresignedPosts,
    uploadFileWithPresigned,
    uploadFiles,
    cancelUploads,
    requestMerge
  } as UsePdfMergeReturn
}

export default usePdfMerge
