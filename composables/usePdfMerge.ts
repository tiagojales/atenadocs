import { ref } from 'vue'

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

export function usePdfMerge() {
  const isUploading = ref(false)
  const error = ref<string | null>(null)
  const overallProgress = ref(0)
  const cancelled = ref(false)
  // track active XHRs so we can abort
  const activeXhrs: Map<number, XMLHttpRequest> = new Map()

  const requestPresignedPosts = async (fileNames: string[]) => {
    const config = useRuntimeConfig()
    const base = config.public.pdfMergeApiBase
    if (!base) throw new Error('API base URL not configured (pdfMergeApiBase)')

    const resp = await fetch(`${base.replace(/\/$/, '')}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileNames })
    })
    if (!resp.ok) throw new Error(`Upload request failed: ${resp.status}`)
    const res = await resp.json()
    return res as { uploads: UploadDescriptor[] }
  }

  const requestMerge = async (fileKeys: string[]) => {
    const config = useRuntimeConfig()
    const base = config.public.pdfMergeApiBase
    if (!base) throw new Error('API base URL not configured (pdfMergeApiBase)')

    const resp = await fetch(`${base.replace(/\/$/, '')}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKeys })
    })
    if (!resp.ok) throw new Error(`Merge request failed: ${resp.status}`)
    const res = await resp.json()
    return res as { message?: string, downloadUrl?: string, fileKey?: string }
  }

  // Request a presigned GET URL for a merged file identified by `fileKey`.
  const requestPresignedGet = async (fileKey: string) => {
    const config = useRuntimeConfig()
    const base = config.public.pdfMergeApiBase
    if (!base) throw new Error('API base URL not configured (pdfMergeApiBase)')

    const resp = await fetch(`${base.replace(/\/$/, '')}/download?fileKey=${encodeURIComponent(fileKey)}`)
    if (!resp.ok) throw new Error(`Presigned GET request failed: ${resp.status}`)
    const res = await resp.json()
    return res as { downloadUrl?: string }
  }

  // Upload a single file using presigned POST details. Reports progress via onProgress
  const uploadFileWithPresigned = (post: PostDetails, file: File, onProgress?: (uploaded: number, total: number) => void, attempts = 2, id?: number): Promise<void> => {
    const doUpload = () => new Promise<void>((resolve, reject) => {
      const fd = new FormData()
      Object.entries(post.fields || {}).forEach(([k, v]) => fd.append(k, v))
      // S3 expects the file field (commonly 'file') as the last field
      fd.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', post.url, true)
      if (typeof id === 'number') activeXhrs.set(id, xhr)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
      }

      xhr.onload = () => {
        // S3 presigned POST typically returns 204 No Content on success
        if (xhr.status >= 200 && xhr.status < 300) {
          if (typeof id === 'number') activeXhrs.delete(id)
          resolve()
        } else {
          if (typeof id === 'number') activeXhrs.delete(id)
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(fd)
    })

    return new Promise<void>((resolve, reject) => {
      ;(async () => {
        let lastErr: unknown = null
        for (let i = 0; i <= attempts; i++) {
          try {
            await doUpload()
            return resolve()
          } catch (err: unknown) {
            lastErr = err
            // exponential backoff before retrying
            if (i < attempts) await new Promise(r => setTimeout(r, 2 ** i * 250))
          }
        }
        reject(lastErr)
      })().catch(reject)
    })
  }

  // Upload multiple files respecting concurrency and reporting per-file progress.
  // `uploads` must be aligned by index with `files` and contain presigned details.
  const uploadFiles = async (files: File[], uploads: UploadDescriptor[], opts?: { concurrency?: number, attempts?: number, onFileProgress?: (index: number, uploaded: number, total: number) => void }) => {
    if (files.length !== uploads.length) throw new Error('files and uploads length mismatch')
    const concurrency = opts?.concurrency ?? 3
    const attempts = opts?.attempts ?? 2
    isUploading.value = true
    error.value = null
    cancelled.value = false
    overallProgress.value = 0

    // track per-file uploaded/total bytes to compute aggregated progress
    const uploadedBytes = new Array<number>(files.length).fill(0)
    const totalBytes = new Array<number>(files.length).fill(0)

    const results: Promise<void>[] = []
    let idx = 0

    const runNext = async (): Promise<void> => {
      const i = idx++
      if (i >= files.length) return
      if (cancelled.value) return
      const file = files[i]
      if (!file) throw new Error(`Missing file for index ${i}`)
      const descriptor = uploads[i]
      if (!descriptor) throw new Error(`Missing upload descriptor for index ${i}`)
      const up = descriptor.post_details
      try {
        await uploadFileWithPresigned(up, file, (loaded, total) => {
          // update per-file and overall progress
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
      return runNext()
    }

    try {
      for (let i = 0; i < Math.min(concurrency, files.length); i++) {
        results.push(runNext())
      }
      await Promise.all(results)
    } finally {
      isUploading.value = false
    }
  }

  const cancelUploads = () => {
    cancelled.value = true
    for (const [_k, xhr] of activeXhrs) {
      try {
        xhr.abort()
      } catch {
        // ignore
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
    requestMerge,
    requestPresignedGet
  }
}

export default usePdfMerge
