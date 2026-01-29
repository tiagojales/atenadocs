<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <Suspense>
    <UApp>
      <UHeader>
        <template #left>
          <NuxtLink to="/">
            <AppLogo class="w-auto h-6 shrink-0" />
          </NuxtLink>
        </template>

        <template #right>
          <UColorModeButton />
        </template>
      </UHeader>

      <UMain>
        <NuxtPage />
      </UMain>

      <USeparator />

      <UFooter>
        <template #left>
          <p class="text-sm text-muted">
            Developed by Tiago Jales • © {{ year }}
          </p>
        </template>

        <template #right>
          <UButton
            href="https://github.com/nuxt-ui-templates/starter-vue"
            target="_blank"
            rel="noopener noreferrer"
            icon="simple-icons:github"
            aria-label="GitHub"
            color="neutral"
            variant="ghost"
          />
        </template>
      </UFooter>
    </UApp>
  </Suspense>
</template>
