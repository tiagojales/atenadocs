<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, navigateTo } from '#app'
// Page overview:
// Resolve a download target from the route query (only a direct URL is supported),
// and provide a client-side download flow that attempts to preserve the original filename.

// Router
const route = useRoute()

// Reactive state
// - `downloadUrl`: final URL that will be fetched by the client
// - `loading`: operation in progress flag
// - `error`: user-facing error message
const downloadUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Helpers extracted to module scope to keep `doDownload` concise.
const stripQuotes = (s: string) => s.replace(/^\s*"?(.+?)"?\s*$/, '$1')

const parseDisposition = (d?: string | null) => {
  if (!d) return null
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(d)
  if (star && star[1]) return stripQuotes(star[1])
  const plain = /filename=([^;]+)/i.exec(d)
  if (plain && plain[1]) return stripQuotes(plain[1])
  return null
}

const getFilenameFromResponse = (resp: Response, urlStr: string | null): string => {
  const defaultName = 'merged.pdf'
  const cd = resp.headers.get('Content-Disposition')
  const fromCd = parseDisposition(cd)
  if (fromCd) {
    try {
      return decodeURIComponent(fromCd)
    } catch {
      return fromCd
    }
  }

  if (urlStr) {
    try {
      const u = new URL(urlStr)
      const qp = u.searchParams.get('response-content-disposition') || u.searchParams.get('content-disposition') || null
      const fromQp = parseDisposition(qp)
      if (fromQp) {
        try {
          return decodeURIComponent(fromQp)
        } catch {
          return fromQp
        }
      }
      const pathSeg = u.pathname.split('/').filter(Boolean)
      if (pathSeg.length) return pathSeg[pathSeg.length - 1]!
    } catch {
      /* ignore URL parsing errors */
    }
  }
  return defaultName
}

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

const getErrorMessage = (err: unknown, fallback = 'Erro desconhecido') => (err instanceof Error ? err.message : String(err)) || fallback

// Resolve the download target when the page mounts.
// Priority: `url` query param (use as-is to avoid tampering with presigned tokens),
// otherwise request a presigned GET URL from the backend using `key`.
const start = async () => {
  const url = route.query.url as string | undefined
  const key = route.query.key as string | undefined

  if (url) {
    // Use decoded query value directly (presigned tokens are sensitive to encoding)
    downloadUrl.value = url ?? null
    return
  }

  // Backend no longer exposes a /download endpoint to exchange fileKey for a presigned URL.
  // If no `url` query param is present, surface a clear error to the user.
  if (key) {
    error.value = 'Chave fornecida, mas a obtenção de URL via backend não é suportada. Tente novamente e verifique se o backend retornou um `downloadUrl`.'
    return
  }

  error.value = 'Nenhuma URL de download fornecida.'
}

// Start resolving URL on client mount
onMounted(() => {
  // Ensure this initialization runs only on the client (defensive)
  if (import.meta.client) start()
})

// Perform the client-side download:
// 1) fetch the blob from `downloadUrl`
// 2) attempt to determine a sensible filename from `Content-Disposition` or the URL
// 3) create an object URL and trigger a download via an anchor element
const doDownload = async () => {
  // Defensive: download flow depends on browser APIs (fetch, URL, DOM)
  if (!import.meta.client) return
  if (!downloadUrl.value) return
  loading.value = true
  error.value = null
  try {
    const resp = await fetch(downloadUrl.value)
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)
    const blob = await resp.blob()

    const filename = getFilenameFromResponse(resp, downloadUrl.value)
    triggerBrowserDownload(blob, filename)
  } catch (err: unknown) {
    error.value = getErrorMessage(err, 'Erro ao baixar arquivo.')
  } finally {
    loading.value = false
  }
}

// Navigate back to the merge page so the user can retry
const refazer = async () => {
  await navigateTo('/pdf/merge')
}
</script>

<template>
  <UPage>
    <div class="max-w-4/5 text-center mx-auto items-center mt-20 px-4">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
        Seus PDFs foram juntados com sucesso!
      </h2>
      <p class="text-base text-gray-600 dark:text-gray-300">
        Clique no botão abaixo para baixar o arquivo.
      </p>
    </div>

    <div class="max-w-4/5 mx-auto mt-6 p-6">
      <div class="flex gap-4 justify-center ">
        <div
          class="flex items-center gap-3"
          :aria-busy="loading"
        >
          <UButton
            class="px-6 py-3 dark:text-white"
            size="lg"
            :disabled="!downloadUrl || loading"
            @click="doDownload"
          >
            <UIcon
              name="i-lucide-download"
              class="w-5 h-5 mr-3"
            />
            <span v-if="!loading">Baixar PDF</span>
            <span v-else>Baixando...</span>
          </UButton>
          <UButton
            class="px-6 py-3 dark:text-white"
            variant="outline"
            :disabled="loading"
            @click="refazer"
          >
            <UIcon
              name="i-lucide-rotate-ccw"
              class="w-5 h-5 mr-3"
            />Refazer
          </UButton>
        </div>
      </div>
      <div class="max-w-4/5 mx-auto mt-3 text-center">
        <p
          v-if="error"
          class="text-sm text-red-600"
          role="alert"
          aria-live="assertive"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </UPage>
</template>
