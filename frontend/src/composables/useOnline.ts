import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';

/**
 * Reactive online / offline state of the browser.
 *
 * Uses the navigator.onLine flag plus the 'online' / 'offline' window
 * events. The flag is a HINT — the browser may still report "online" when
 * the connection is dead (e.g. captive portal, DNS down). Treat it as a UI
 * signal, not a transport guarantee: a banner is fine, but every request
 * should still surface its own error.
 */
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

function handleOnline() {
  online.value = true;
}
function handleOffline() {
  online.value = false;
}

// Install listeners exactly once for the lifetime of the module; the same
// singleton is returned to every caller, so the browser sees one pair of
// passive listeners regardless of how many components use the composable.
if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export function useOnline() {
  // Components that mount/unmount inside a single SPA session can register
  // and unregister without affecting the shared listener pair.
  onMounted(() => {
    online.value = navigator.onLine;
  });
  onBeforeUnmount(() => {
    /* no per-component teardown needed */
  });

  return {
    /** true while the browser believes the network is reachable. */
    online: readonly(online),
  };
}
