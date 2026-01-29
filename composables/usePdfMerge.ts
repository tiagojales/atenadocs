import { ref } from 'vue'

// `useRuntimeConfig` is auto-injected by Nuxt at runtime. Declare it for TypeScript
declare function useRuntimeConfig(): any

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
    return res as { message?: string; downloadUrl?: string }
  }

  // Upload a single file using presigned POST details. Reports progress via onProgress
  const uploadFileWithPresigned = (post: PostDetails, file: File, onProgress?: (uploaded: number, total: number) => void, attempts = 2): Promise<void> => {
    const doUpload = () => new Promise<void>((resolve, reject) => {
      const fd = new FormData()
      Object.entries(post.fields || {}).forEach(([k, v]) => fd.append(k, v))
      // S3 expects the file field (commonly 'file') as the last field
      fd.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', post.url, true)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
      }

      xhr.onload = () => {
        // S3 presigned POST typically returns 204 No Content on success
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(fd)
    })

    return new Promise<void>(async (resolve, reject) => {
      let lastErr: any = null
      for (let i = 0; i <= attempts; i++) {
        try {
          await doUpload()
          return resolve()
        } catch (err) {
          lastErr = err
          // exponential backoff before retrying
          if (i < attempts) await new Promise(r => setTimeout(r, 2 ** i * 250))
        }
      }
      reject(lastErr)
    })
  }

  // Upload multiple files respecting concurrency and reporting per-file progress.
  // `uploads` must be aligned by index with `files` and contain presigned details.
  const uploadFiles = async (files: File[], uploads: UploadDescriptor[], opts?: { concurrency?: number, onFileProgress?: (index: number, uploaded: number, total: number) => void }) => {
    if (files.length !== uploads.length) throw new Error('files and uploads length mismatch')
    const concurrency = opts?.concurrency ?? 3
    isUploading.value = true
    error.value = null

    const results: Promise<void>[] = []
    let idx = 0

    const runNext = async (): Promise<void> => {
      const i = idx++
      if (i >= files.length) return
      const file = files[i]
      if (!file) throw new Error(`Missing file for index ${i}`)
      const descriptor = uploads[i]
      if (!descriptor) throw new Error(`Missing upload descriptor for index ${i}`)
      const up = descriptor.post_details
      try {
        await uploadFileWithPresigned(up, file, (loaded, total) => {
          if (opts?.onFileProgress) opts.onFileProgress(i, loaded, total)
        })
      } catch (err: any) {
        throw new Error(`Failed to upload ${file.name}: ${err?.message || err}`)
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

  return {
    isUploading,
    error,
    requestPresignedPosts,
    uploadFileWithPresigned,
    uploadFiles,
    requestMerge
  }
}

export default usePdfMerge
