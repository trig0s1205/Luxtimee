export function useLiveWaitHours() {
  const now = ref(Date.now());

  onMounted(() => {
    const timer = setInterval(() => {
      now.value = Date.now();
    }, 60_000);
    onUnmounted(() => clearInterval(timer));
  });

  function waitHoursSince(iso: string) {
    return Math.max(0, Math.floor((now.value - new Date(iso).getTime()) / 3_600_000));
  }

  return { waitHoursSince };
}
