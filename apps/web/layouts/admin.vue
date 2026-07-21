<script setup lang="ts">

const auth = useAuthStore();



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

  <div class="min-h-screen bg-lux-black flex admin-shell">

    <AdminSidebar @logout="logout" />

    <main class="flex-1 min-w-0 p-6 md:p-8 overflow-x-hidden">

      <slot />

    </main>

  </div>

</template>

