<script setup lang="ts">
import { VueDraggableNext } from 'vue-draggable-next'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import usePdfMerge from '../../../../composables/usePdfMerge'

const value = ref<File[]>([])
const uploaderRef = ref<any>(null)

const MAX_FILES = 25
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

const isPdf = (f?: File) => !!f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'))

type ValidationResult = {
  kept: File[]
  removedByCount: File[]
  removedBySize: File[]
  invalid: File[]
}

const validateFiles = (files: File[] = []): ValidationResult => {
  const valid = files.filter(isPdf)
  const invalid = files.filter(f => !isPdf(f))

  const kept: File[] = []
  const removedByCount: File[] = []
  const removedBySize: File[] = []
  let total = 0

  for (const f of valid) {
    if (kept.length >= MAX_FILES) {
      removedByCount.push(f)
      continue
    }
    if (total + f.size > MAX_BYTES) {
      removedBySize.push(f)
      continue
    }
    kept.push(f)
    total += f.size
  }

  return { kept, removedByCount, removedBySize, invalid }
}

// Validate incoming `value` and enforce PDF/type and limits
watch(value, (newFiles: File[]) => {
  if (!newFiles) return

  const { kept, removedByCount, removedBySize, invalid } = validateFiles(newFiles)

  if (invalid.length) {
    value.value = kept
    // eslint-disable-next-line no-alert
    alert('Apenas arquivos PDF são permitidos!')
    return
  }

  const removedLimit = [...removedByCount, ...removedBySize]
  if (removedLimit.length) {
    value.value = kept
    let msg = 'Limite atingido.'
    if (removedByCount.length) msg += ` Quantidade de arquivos excedida (máx ${MAX_FILES}).`
    if (removedBySize.length) msg += ` Limite de tamanho excedido (máx ${(MAX_BYTES / 1024 / 1024).toFixed(2)}MB).`
    // eslint-disable-next-line no-alert
    alert(msg)
    return
  }
})

// Handlers declared in module scope so they can be attached/detached cleanly.
const windowDragOver = (e: DragEvent) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    e.preventDefault()
  }
}

const windowDrop = (e: DragEvent) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    e.preventDefault()
  }
}

const dzDropHandler = (e: DragEvent) => {
  e.preventDefault()
  const dt = e.dataTransfer
  if (!dt) return
  const files = Array.from(dt.files || [])
  const { invalid } = validateFiles(files)
  if (invalid.length) {
    // eslint-disable-next-line no-alert
    alert('Apenas arquivos PDF são permitidos.')
  }
}

onMounted(() => {
  const dzEl = uploaderRef.value?.dropzoneRef?.value
  window.addEventListener('dragover', windowDragOver, { passive: false })
  window.addEventListener('drop', windowDrop, { passive: false })
  if (dzEl) dzEl.addEventListener('drop', dzDropHandler)
})

onUnmounted(() => {
  window.removeEventListener('dragover', windowDragOver as EventListener)
  window.removeEventListener('drop', windowDrop as EventListener)
  const dzEl = uploaderRef.value?.dropzoneRef?.value
  if (dzEl) dzEl.removeEventListener('drop', dzDropHandler as EventListener)
})

const clearFiles = () => {
  value.value = []
}

const removeFile = (fileToRemove: File) => {
  value.value = value.value.filter(file => file !== fileToRemove)
}

const totalFiles = computed(() => value.value.length)
const totalSize = computed(() => {
  return value.value.reduce((acc, file) => acc + file.size, 0)
})

const filesLabel = computed(() => {
  return totalFiles.value === 1 ? 'arquivo' : 'arquivos'
})

// Integration with backend composable
const { isUploading: uploadingFlag, error: uploadError, requestPresignedPosts, uploadFiles, requestMerge } = usePdfMerge()
const isUploading = uploadingFlag
const mergedUrl = ref<string | null>(null)
const fileProgress = ref<number[]>([])

// initialize progress array whenever files change
watch(value, (files: File[]) => {
  fileProgress.value = files?.map(() => 0) || []
})

const handleMerge = async () => {
  if (isUploading.value) return
  if (totalFiles.value < 2) {
    // eslint-disable-next-line no-alert
    alert('Selecione pelo menos dois arquivos para juntar.')
    return
  }

  try {
    const fileNames = value.value.map(f => f.name)
    const pres = await requestPresignedPosts(fileNames)
    const uploads = pres.uploads

    // upload with progress callbacks
    await uploadFiles(value.value, uploads, {
      concurrency: 3,
      onFileProgress: (index, uploaded, total) => {
        fileProgress.value[index] = Math.round((uploaded / total) * 100)
      }
    })

    const fileKeys = uploads.map(u => u.key)
    const mergeRes = await requestMerge(fileKeys)
    if (mergeRes.downloadUrl) {
      mergedUrl.value = mergeRes.downloadUrl
      // open in new tab
      window.open(mergeRes.downloadUrl, '_blank')
    } else {
      // eslint-disable-next-line no-alert
      alert(mergeRes.message || 'Merge concluído sem URL de download')
    }
  } catch (err: any) {
    // eslint-disable-next-line no-alert
    alert(err?.message || 'Erro durante upload/merge')
  }
}
</script>

<template>
  <UPage>
    <UPageSection
        title="Juntar arquivos PDF"
        description="Mesclar e juntar PDFs e colocá-los em qualquer ordem que desejar. É tudo muito fácil e rápido!"
        class="-mb-10"
    />
    
    <UFileUpload
      ref="uploaderRef"
      v-model="value"
      label="Arraste e solte seus PDFs aqui"
      description="ou clique para selecionar em seu dispositivo"
      position="outside"
      accept="application/pdf, .pdf"
      layout="list"
      multiple
      class="w-4/5 min-h-60 mx-auto transition-colors cursor-pointer"
      :ui="{ label: 'text-xl', description: 'text-lg' }"
    >
      <template #leading>
        <UIcon name="i-lucide-upload-cloud" class="w-12 h-12 text-red-600 dark:text-red-400" />
      </template>

      <template #files>
        <div v-if="value.length" class="flex justify-between items-center mt-6">
          <div>
            <h3 class="text-lg font-bold">Seus Arquivos</h3>
            <p class="text-sm text-gray-500">Arraste e solte para reordenar. Os arquivos serão juntados do primeiro ao último.</p>
          </div>
          <UButton variant="ghost" @click="clearFiles">
              Limpar
              <UIcon name="i-lucide-circle-x" />
          </UButton>
        </div>
        <VueDraggableNext v-if="value.length" v-model="value" class="dark:divide-gray-400" handle=".handle">
            <div v-for="file in value" :key="file.name" class="flex handle cursor-move justify-between px-2 m-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300">
                <div class="flex items-center gap-4">
                  <UIcon name="i-lucide-grip-vertical" class="w-6 h-6 " />
                  <div class="flex-1 m-2">
                      <p class="text-md dark:text-white">
                          {{ file.name }}
                      </p>
                      <p class="text-sm dark:text-gray-400">
                          {{ (file.size / 1024 / 1024).toFixed(2) }} MB
                      </p>
                  </div>
                </div>
                <UButton icon="i-lucide-x" class="h-7 my-auto" variant="ghost" @click="removeFile(file)" />
            </div>
        </VueDraggableNext>
        <div v-if="value.length" class="flex flex-col gap-4 mt-6 mb-6">
          <div v-if="isUploading" class="w-full">
            <p class="text-sm text-gray-700 dark:text-gray-300">Enviando arquivos... Progresso: {{ Math.round((fileProgress.reduce((a,b)=>a+b,0) / (fileProgress.length || 1))) }}%</p>
          </div>
          <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-gray-900 dark:text-white">
              {{ totalFiles }} {{ filesLabel }}, totalizando: {{ (totalSize / 1024 / 1024).toFixed(2) }}MB
            </p>
          </div>
          <UButton size="xl" label="Juntar" :disabled="totalFiles < 2 || isUploading" @click="handleMerge">
              <span v-if="!isUploading">Juntar</span>
              <span v-else>Enviando...</span>
              <UIcon name="i-lucide-merge" />
          </UButton>
          </div>
        </div>
      </template>
    </UFileUpload>
  </UPage>
</template>
