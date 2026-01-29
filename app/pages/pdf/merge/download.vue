<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, navigateTo } from '#app'
import usePdfMerge from '../../../../composables/usePdfMerge'

const route = useRoute()
const { requestPresignedGet } = usePdfMerge()

const downloadUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const start = async () => {
  const url = route.query.url as string | undefined
  const key = route.query.key as string | undefined

  if (url) {
    // router provides the decoded query value; use it as-is to avoid corrupting presigned tokens
    downloadUrl.value = url ?? null
    return
  }

  if (key) {
    loading.value = true
    try {
      const res = await requestPresignedGet(key as string)
      if (res?.downloadUrl) downloadUrl.value = res.downloadUrl
      else error.value = 'URL de download não disponível.'
    } catch (e: any) {
      error.value = e?.message || 'Erro ao solicitar URL de download.'
    } finally {
      loading.value = false
    }
  } else {
    error.value = 'Nenhuma chave ou URL fornecida.'
  }
}

onMounted(() => {
  start()
})

const doDownload = async () => {
  if (!downloadUrl.value) return
  loading.value = true
  error.value = null
  try {
    const resp = await fetch(downloadUrl.value)
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)
    const blob = await resp.blob()

    // Try to obtain a filename from headers or URL
    let filename = 'merged.pdf'
    const cd = resp.headers.get('Content-Disposition')
    if (cd) {
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/.exec(cd)
      if (m && m[1]) filename = decodeURIComponent(m[1] as string)
    } else {
      try {
        const u = new URL(downloadUrl.value)
        const qp = u.searchParams.get('response-content-disposition') || u.searchParams.get('response-content-disposition')
        if (qp) {
          const m2 = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/.exec(qp)
          if (m2 && m2[1]) filename = decodeURIComponent(m2[1] as string)
        } else {
          const pathSeg = u.pathname.split('/').filter(Boolean) as string[]
          if (pathSeg.length) {
            const last = pathSeg[pathSeg.length - 1]
            if (last) filename = last
          }
        }
      } catch (e) {
        // ignore URL parsing errors
      }
    }

    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao baixar arquivo.'
  } finally {
    loading.value = false
  }
}

const refazer = async () => {
  await navigateTo('/pdf/merge')
}
</script>

<template>
  <UPage>
    <div class="max-w-4/5 text-center mx-auto items-center mt-20 px-4">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Seus PDFs foram juntados com sucesso!</h2>
        <p class="text-base text-gray-600 dark:text-gray-300">Clique no botão abaixo para baixar o arquivo.</p>
    </div>

    <div class="max-w-4/5 mx-auto mt-6 p-6">
        <div class="flex gap-4 justify-center ">
            <div class="flex items-center gap-3">
                <UButton class="px-6 py-3 dark:text-white" size="lg" @click="doDownload"><UIcon name="i-lucide-download" class="w-5 h-5 mr-3" />Baixar PDF</UButton>
                <UButton class="px-6 py-3 dark:text-white" variant="outline" @click="refazer"><UIcon name="i-lucide-rotate-ccw" class="w-5 h-5 mr-3" />Refazer</UButton>
            </div>
        </div>
    </div>
  </UPage>
</template>
