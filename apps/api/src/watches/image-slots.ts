export type WatchImageSlotSource = {
  images?: string[] | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
};

export function imageSlotsFromWatch(watch: WatchImageSlotSource) {
  const slots: Array<{ slot: string; imageUrl: string }> = [];
  const seen = new Set<string>();
  const push = (slot: string, url?: string | null) => {
    const imageUrl = url?.trim();
    if (!imageUrl || seen.has(imageUrl)) return;
    seen.add(imageUrl);
    slots.push({ slot, imageUrl });
  };
  push('front', watch.frontImageUrl || watch.primaryImageUrl || watch.images?.[0]);
  push('back', watch.backImageUrl || watch.secondaryImageUrl || watch.images?.[1]);
  watch.images?.forEach((url, index) => push(`gallery-${index}`, url));
  return slots;
}
