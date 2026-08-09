<script setup lang="ts">
const auth = useAuthStore();

useHead({
  htmlAttrs: { lang: 'es' },
});

await callOnce('admin-auth', async () => {
  auth.hydrateLocal();
  if (!auth.loaded) await auth.fetchMe();
});



async function logout() {

  await auth.logout();

  await navigateTo('/');

}

</script>



<template>
  <NuxtLoadingIndicator color="var(--lux-gold, #C8A96E)" :height="2" />

  <div class="admin-layout admin-shell">
    <AdminSidebar @logout="logout" />

    <main class="admin-main">
      <slot />
    </main>

    <UiConfirmDialog />
  </div>
</template>

<style>
@import '~/assets/css/admin-dashboard.css';
@import '~/assets/css/admin-tables.css';
@import '~/assets/css/admin-records.css';
</style>

