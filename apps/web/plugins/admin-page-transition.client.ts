export default defineNuxtPlugin(() => {
  const router = useRouter();

  router.beforeEach((to, from) => {
    if (to.path.startsWith('/admin') && from.path.startsWith('/admin')) {
      to.meta.pageTransition = false;
      to.meta.layoutTransition = false;
    }
  });
});
