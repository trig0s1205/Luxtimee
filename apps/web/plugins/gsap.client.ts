export default defineNuxtPlugin(async () => {
  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  if (import.meta.client) gsap.registerPlugin(ScrollTrigger);
  return {
    provide: {
      gsap,
      ScrollTrigger,
    },
  };
});
