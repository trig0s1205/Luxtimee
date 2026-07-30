<script setup lang="ts">
const auth = useAuthStore();

useHead({
  htmlAttrs: { lang: 'es' },
});

onMounted(() => {

  auth.hydrateLocal();

  if (!auth.loaded) auth.fetchMe();

});



async function logout() {

  await auth.logout();

  await navigateTo('/');

}

</script>



<template>

  <div class="admin-layout admin-shell">

    <AdminSidebar @logout="logout" />

    <main class="admin-main">

      <slot />

    </main>

    <UiConfirmDialog />

  </div>

</template>

