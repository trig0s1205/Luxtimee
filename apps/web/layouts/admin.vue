<script setup lang="ts">
const auth = useAuthStore();
onMounted(() => auth.fetchMe());
</script>

<template>
  <div class="min-h-screen bg-lux-black flex">
    <AdminSidebar />
    <div class="flex-1 min-w-0">
      <header class="border-b border-lux-gold/10 px-6 md:px-8 py-6 flex justify-between items-center">
        <h1 class="font-display text-2xl md:text-3xl">Panel Luxtime</h1>
        <p class="text-xs uppercase tracking-widest text-lux-white-dim">{{ auth.user?.name }} · {{ auth.user?.role }}</p>
      </header>
      <main class="p-6 md:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
