export function useCountdown(targetIso: string) {
  const days = ref('00');
  const hours = ref('00');
  const minutes = ref('00');
  const seconds = ref('00');
  const finished = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function tick() {
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) {
      days.value = hours.value = minutes.value = seconds.value = '00';
      finished.value = true;
      if (timer) clearInterval(timer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    days.value = String(d).padStart(2, '0');
    hours.value = String(h).padStart(2, '0');
    minutes.value = String(m).padStart(2, '0');
    seconds.value = String(s).padStart(2, '0');
  }

  onMounted(() => {
    tick();
    timer = setInterval(tick, 1000);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { days, hours, minutes, seconds, finished };
}
