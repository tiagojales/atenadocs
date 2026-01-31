// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      pdfMergeApiBase: (process.env?.PDF_MERGE_API_BASE_URL) || '',
      appName: 'AtenasDocs',
      appVersion: '0.0.1',
      appCodename: 'Aurora'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
