import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * RegisterSW — registers the Service Worker and handles update prompts.
 *
 * Uses virtual:pwa-register (provided by vite-plugin-pwa) to register
 * the auto-generated Service Worker. On update, prompts the user to reload
 * — but only when playback is not active (to avoid interrupting a movie).
 *
 * The component renders nothing visually.
 */
export function RegisterSW() {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // New version available — prompt user to reload
        // Don't interrupt playback if user is watching
        if (confirm('New version available. Reload to update?')) {
          updateSW(true)
        }
      },
      onOfflineReady() {
        console.log('App ready for offline use')
      },
    })
  }, [])

  return null
}
