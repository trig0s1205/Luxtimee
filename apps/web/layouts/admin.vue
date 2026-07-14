<template>
  <div class="min-h-screen bg-lux-black flex">
    <aside class="hidden lg:block w-64 border-r border-lux-gold/10 p-8">
      <p class="font-display text-2xl text-lux-gold mb-8">Admin</p>
      <nav class="space-y-4 text-sm text-lux-white-dim">
        <p>Inventario</p>
        <p>Pre-pedidos</p>
        <p>Pedidos</p>
      </nav>
    </aside>
    <div class="flex-1">
      <header class="border-b border-lux-gold/10 px-8 py-6">
        <h1 class="font-display text-3xl">Panel Luxtime</h1>
      </header>
      <main class="p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
