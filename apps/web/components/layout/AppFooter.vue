<template>
  <footer class="border-t border-lux-gold/10 px-6 md:px-16 py-16 bg-lux-black">
    <div class="grid md:grid-cols-4 gap-10">
      <div class="md:col-span-2">
        <p class="font-display text-4xl text-lux-gold tracking-widest mb-2">LUXTIME</p>
        <p class="text-[11px] uppercase tracking-lux text-lux-white-dim mb-4">Relojes de lujo</p>
        <p class="text-sm text-lux-white-dim max-w-sm leading-relaxed">
          Experiencia premium inspirada en la alta relojería. Bucaramanga, Colombia.
        </p>
      </div>
      <div>
        <h4 class="text-[10px] uppercase tracking-[0.3em] text-lux-gold mb-4">Navegación</h4>
        <ul class="space-y-3 text-sm text-lux-white-dim">
          <li><NuxtLink to="/catalogo">Catálogo</NuxtLink></li>
          <li><NuxtLink to="/design">Showcase de diseño</NuxtLink></li>
          <li><NuxtLink to="/cuenta">Mi cuenta</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h4 class="text-[10px] uppercase tracking-[0.3em] text-lux-gold mb-4">Contacto</h4>
        <p class="text-sm text-lux-white-dim">WhatsApp · Soporte premium</p>
      </div>
    </div>
  </footer>
</template>
