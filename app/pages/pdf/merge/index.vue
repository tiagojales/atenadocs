<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, defineAsyncComponent, type Component } from 'vue'
import usePdfMerge, { type UsePdfMergeReturn } from '../../../../composables/usePdfMerge'
import { navigateTo } from '#app'
import { useToast } from '#imports'

const value = ref<File[]>([])
// Reference to the file upload component; exposes DOM elements (dropzone/input).
const uploaderRef = ref<{ dropzoneRef?: HTMLElement | null, inputRef?: HTMLElement | null } | null>(null)
const toast = useToast()

// UI props extracted to avoid recreating objects in the template
const uiFileUpload = {
  label: 'text-xl',
  description: 'text-lg'
}

// Lazy-load the draggable/reorder component to reduce initial bundle size
const VueDraggableNext = defineAsyncComponent(async () => {
  const mod = await import('vue-draggable-next')
  const unknownMod = mod as unknown
  const candidate = (unknownMod as { VueDraggableNext?: Component }).VueDraggableNext ?? (unknownMod as { default?: Component }).default ?? (unknownMod as Component)
  return candidate
})

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

// Compact signature used to compare files by name/size/lastModified
const fileSignature = (f: File) => `${f.name}:${f.size}:${(f as unknown as { lastModified?: number }).lastModified ?? 0}`
// Safe comparator for file arrays: equal length and matching signature per index
const filesEqual = (a: File[] = [], b: File[] = []) => a.length === b.length && a.every((fa, i) => {
  const fb = b[i]
  return !!fb && fileSignature(fa) === fileSignature(fb)
})

// Single watcher: validates incoming files and initializes per-file progress array
const initFileProgress = (len = value.value.length) => {
  fileProgress.value = new Array<number>(len).fill(0)
}

watch(value, (newFiles: File[] | undefined) => {
  // Ensure we have an array
  const incoming = newFiles || []

  const { kept, removedByCount, removedBySize, invalid } = validateFiles(incoming)

  if (invalid.length) {
    // Keep only valid files
    if (!filesEqual(value.value, kept)) value.value = kept
    toast.add({ title: 'Erro', description: 'Apenas arquivos PDF são permitidos!' })
    // initialize progress array
    initFileProgress(kept.length)
    return
  }

  const removedLimit = [...removedByCount, ...removedBySize]
  if (removedLimit.length) {
    if (!filesEqual(value.value, kept)) value.value = kept
    let msg = 'Limite atingido.'
    if (removedByCount.length) msg += ` Quantidade de arquivos excedida (máx ${MAX_FILES}).`
    if (removedBySize.length) msg += ` Limite de tamanho excedido (máx ${(MAX_BYTES / 1024 / 1024).toFixed(2)}MB).`
    toast.add({ title: 'Aviso', description: msg })
    // initialize progress array
    initFileProgress(kept.length)
    return
  }

  // If validation passed, keep incoming files and reset progress
  if (!filesEqual(value.value, kept)) value.value = kept
  initFileProgress()
})

// Handlers live in module scope so listeners can be attached/detached cleanly
const preventFileDragDefault = (e: DragEvent) => {
  // Prevent default browser file drag/drop behavior on the window
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault()
}

// Drop handler for the dropzone: validate dropped files
const dzDropHandler = (e: DragEvent) => {
  e.preventDefault()
  const dt = e.dataTransfer
  if (!dt) return
  const files = Array.from(dt.files || [])
  const { invalid } = validateFiles(files)
  if (invalid.length) toast.add({ title: 'Error', description: 'Only PDF files are allowed.' })
}

onMounted(() => {
  const dzEl = uploaderRef.value?.dropzoneRef
  window.addEventListener('dragover', preventFileDragDefault, { passive: false })
  window.addEventListener('drop', preventFileDragDefault, { passive: false })
  if (dzEl) dzEl.addEventListener('drop', dzDropHandler)
})

onUnmounted(() => {
  window.removeEventListener('dragover', preventFileDragDefault as EventListener)
  window.removeEventListener('drop', preventFileDragDefault as EventListener)
  const dzEl = uploaderRef.value?.dropzoneRef
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
const { isUploading: uploadingFlag, requestPresignedPosts, uploadFiles, requestMerge } = usePdfMerge() as UsePdfMergeReturn
const isUploading = uploadingFlag
// merged URL state is handled by the nested `download` child route via query params
const fileProgress = ref<number[]>([])

const pageSize = ref(10)
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiles.value / pageSize.value)))

const pagedFiles = computed<File[]>({
  get() {
    const start = (currentPage.value - 1) * pageSize.value
    return value.value.slice(start, start + pageSize.value)
  },
  set(newPage) {
    const start = (currentPage.value - 1) * pageSize.value
    const before = value.value.slice(0, start)
    const after = value.value.slice(start + newPage.length)
    value.value = [...before, ...newPage, ...after]
  }
})

watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

const handleMerge = async () => {
  if (isUploading.value) return
  if (totalFiles.value < 2) {
    toast.add({ title: 'Aviso', description: 'Selecione pelo menos dois arquivos para juntar.' })
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
    // If backend returned an immediate presigned S3 URL, navigate to nested download route with URL
    if (mergeRes.downloadUrl) {
      await navigateTo({ path: '/pdf/merge/download', query: { url: mergeRes.downloadUrl } })
    } else if (mergeRes.fileKey) {
      // navigate to nested download route with fileKey
      await navigateTo({ path: '/pdf/merge/download', query: { key: mergeRes.fileKey } })
    } else {
      toast.add({ title: 'Info', description: mergeRes.message || 'Merge concluído sem URL de download' })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toast.add({ title: 'Erro', description: msg || 'Erro durante upload/merge' })
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
      :ui="uiFileUpload"
    >
      <template #leading>
        <UIcon
          name="i-lucide-upload-cloud"
          class="w-12 h-12 text-red-600 dark:text-red-400"
          aria-hidden="true"
        />
      </template>

      <template #files>
        <div
          v-if="value.length"
          class="flex justify-between items-center mt-6"
        >
          <div>
            <h3 class="text-lg font-bold">
              Seus Arquivos
            </h3>
            <p class="text-sm text-gray-500">
              Arraste e solte para reordenar. Os arquivos serão juntados do primeiro ao último.
            </p>
          </div>
          <UButton
            variant="ghost"
            aria-label="Limpar arquivos"
            @click="clearFiles"
          >
            Limpar
            <UIcon
              name="i-lucide-circle-x"
              aria-hidden="true"
            />
          </UButton>
        </div>

        <div
          v-if="isUploading"
          class="w-full"
        >
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Enviando arquivos... Progresso: {{ Math.round((fileProgress.reduce((a, b) => a+b, 0) / (fileProgress.length || 1))) }}%
          </p>
        </div>

        <VueDraggableNext
          v-if="value.length"
          v-model="pagedFiles"
          class="dark:divide-gray-400"
          handle=".handle"
        >
          <div
            v-for="(file, pIndex) in pagedFiles"
            :key="file.name + '-' + file.lastModified"
            class="flex handle cursor-move justify-between px-2 m-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300"
          >
            <div class="flex items-center gap-4">
              <UIcon
                name="i-lucide-grip-vertical"
                class="w-6 h-6 "
                aria-hidden="true"
              />
              <div class="flex-1 m-2">
                <p class="text-md dark:text-white">
                  {{ file.name }}
                </p>
                <p class="text-sm dark:text-gray-400">
                  {{ (file.size / 1024 / 1024).toFixed(2) }} MB
                </p>
                <p
                  v-if="fileProgress.length"
                  class="text-sm text-gray-600"
                >
                  Progresso: {{ fileProgress[((currentPage-1)*pageSize)+pIndex] || 0 }}%
                </p>
              </div>
            </div>
            <UButton
              icon="i-lucide-x"
              class="h-7 my-auto"
              variant="ghost"
              aria-label="Remover arquivo"
              @click="removeFile(file)"
            />
          </div>
        </VueDraggableNext>
        <div
          v-if="value.length"
          class="flex items-center justify-between gap-4 mt-4"
        >
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              variant="outline"
              :disabled="currentPage===1"
              @click="currentPage = Math.max(1, currentPage-1)"
            >
              Anterior
            </UButton>
            <span class="text-sm">Página {{ currentPage }} / {{ totalPages }}</span>
            <UButton
              size="sm"
              variant="outline"
              :disabled="currentPage>=totalPages"
              @click="currentPage = Math.min(totalPages, currentPage+1)"
            >
              Próxima
            </UButton>
          </div>
          <div>
            <label class="text-sm">Por página:</label>
            <select
              v-model.number="pageSize"
              class="ml-2 text-sm"
            >
              <option :value="5">
                5
              </option>
              <option :value="10">
                10
              </option>
              <option :value="25">
                25
              </option>
            </select>
          </div>
        </div>
        <div
          v-if="value.length"
          class="flex flex-col gap-4 mt-6 mb-6"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ totalFiles }} {{ filesLabel }}, totalizando: {{ (totalSize / 1024 / 1024).toFixed(2) }}MB
              </p>
            </div>
            <UButton
              size="xl"
              label="Juntar"
              :disabled="totalFiles < 2 || isUploading"
              @click="handleMerge"
            >
              <span v-if="!isUploading">Juntar</span>
              <span v-else>Enviando...</span>
              <UIcon
                name="i-lucide-merge"
                aria-hidden="true"
              />
            </UButton>
          </div>
        </div>
      </template>
    </UFileUpload>
    <!-- nested child route will render here when navigated to /pdf/merge/download -->
    <NuxtPage />
  </UPage>
</template>
