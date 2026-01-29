<template>
  <UPageHero
    title="Tudo o que você precisa para trabalhar em um só lugar"
    description="Crie, edite, converta e gerencie arquivos com facilidade."
    :ui="{
      wrapper: 'h-0',
      title: 'text-3xl md:text-5xl font-bold',
      description: 'text-base md:text-2xl',
    }"
  />

  <UPageSection 
    id="tools">
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ">
      <NuxtLink to="/pdf" class="group">
        <UCard class="h-60 items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 flex flex-col">
          <div class="flex mb-6">
            <UIcon 
              name="material-icon-theme:pdf" 
              class="w-14 h-14 text-primary mx-4 rounded-lg"
            />
            <h3 class="text-xl my-auto">
              Ferramentas PDF
            </h3>
          </div> 
          <p class="text-center">
            Combine múltiplos arquivos PDF em um único documento de forma fácil e rápida. Arraste, solte e junte.
          </p>
        </UCard>
      </NuxtLink>

      <!-- CARD EM BREVE -->
      <UCard
        class="h-full opacity-60 cursor-not-allowed"
      >
        <div class="flex items-center gap-4">
          <UIcon
            name="i-lucide-clock"
            class="w-10 h-10 text-gray-600"
          />
          <div>
            <h3 class="text-lg font-semibold">
              Em breve
            </h3>
            <p class="text-sm text-gray-500">
              Novas ferramentas estão a caminho.
            </p>
          </div>
        </div>
      </UCard>

    </div>
  </UPageSection>
</template>