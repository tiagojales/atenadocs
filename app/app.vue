<script setup>
import pkg from '../package.json'

const year = new Date().getFullYear()
const projectName = pkg.name || 'aDocs'
const projectCodename = pkg.codename || 'Aurora'
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
            Developed by 
            <a href="https://www.linkedin.com/in/tiago-jales-118886121/" target="_blank" rel="noopener noreferrer">
              Tiago Jales</a> • © {{ year }}
          </p>
        </template>

        <template #right>
          <p class="text-sm text-muted">
            {{ projectName }} - {{ projectCodename }} v{{ projectVersion }}
          </p>
          <UButton
            href="https://github.com/tiagojales/atenadocs.git"
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
