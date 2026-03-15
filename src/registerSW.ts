export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register(
          import.meta.env.BASE_URL + 'sw.js',
          { scope: import.meta.env.BASE_URL }
        );
        console.log('SW registered:', reg.scope);
      } catch (err) {
        console.warn('SW registration failed:', err);
      }
    });
  }
}
