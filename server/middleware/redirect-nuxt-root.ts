import { defineEventHandler, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  try {
    const reqUrl = (event.node.req.url || '').toString()
    if (reqUrl === '/_nuxt/' || reqUrl === '/_nuxt') {
      // Redirect to the builds folder where assets are served in dev
      return sendRedirect(event, '/_nuxt/builds/')
    }
  } catch {
    // ignore
  }
})
