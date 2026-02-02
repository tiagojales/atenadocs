<script setup>
const ui = {
  title: 'text-4xl md:text-5xl',
  description: 'text-base md:text-2xl'
}
</script>

<template>
  <UPage>
    <UPageHero
      title="Ferramentas de PDF"
      description="Tudo o que você precisa para trabalhar com arquivos PDF."
      :ui="ui"
    />
    <UPageSection
      id="tools"
      class="-mt-16"
    >
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          to="/pdf/merge"
          class="group"
        >
          <UCard class="h-60 items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 flex flex-col">
            <div class="flex flex-col items-center text-center">
              <div class="mb-6">
                <UIcon
                  name="i-ant-design-merge-cells-outlined"
                  class="w-14 h-14 text-primary mx-4 rounded-lg"
                  aria-hidden="true"
                />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Juntar PDF
              </h3>
              <p class="text-base text-gray-500 dark:text-gray-400">
                Combine múltiplos arquivos PDF em um único documento de forma fácil e rápida. Arraste, solte e junte.
              </p>
            </div>
          </UCard>
        </NuxtLink>

        <div
          role="group"
          aria-disabled="true"
          class="group"
        >
          <UCard
            class="h-60 items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 flex flex-col cursor-not-allowed opacity-60"
            aria-disabled="true"
          >
            <div class="flex flex-col items-center text-center">
              <div class="mb-6">
                <UIcon
                  name="i-ant-design-split-cells-outlined"
                  class="w-14 h-14 text-primary mx-4 rounded-lg"
                  aria-hidden="true"
                />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Dividir PDF
              </h3>
              <p class="text-base text-gray-500 dark:text-gray-400">
                Divida arquivos PDF grandes em documentos menores com facilidade. Selecione páginas específicas para extrair.
              </p>
            </div>
          </UCard>
        </div>
      </div>
    </UPageSection>
  </UPage>
</template>
