export default defineNuxtPlugin({
  name: 'theme-init',
  enforce: 'pre',
  setup(nuxtApp) {
    const { initTheme, syncThemeForRoute } = useTheme();
    initTheme();

    const router = nuxtApp.$router as ReturnType<typeof useRouter>;
    syncThemeForRoute(router.currentRoute.value.path);

    router.afterEach((to) => {
      syncThemeForRoute(to.path);
    });
  },
});
