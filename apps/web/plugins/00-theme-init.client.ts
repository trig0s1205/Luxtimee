export default defineNuxtPlugin({
  name: 'theme-init',
  enforce: 'pre',
  setup() {
    const { initTheme } = useTheme();
    initTheme();
  },
});
