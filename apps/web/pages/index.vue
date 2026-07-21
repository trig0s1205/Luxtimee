<script setup lang="ts">
const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { t, tm } = useLocale();

const marqueeItems = computed(() => tm('home').marquee);

const { data: bestSellers } = await useAsyncData('home-best-sellers', () => catalog.getBestSellers());

useSeoMeta({
  title: 'Luxtime — Luxury Timepieces',
  description: 'Catálogo premium de relojes de lujo. Luxtime Luxury Timepieces.',
  ogTitle: 'Luxtime — Luxury Timepieces',
  ogDescription: 'Catálogo premium de relojes de lujo. Compra asesorada por WhatsApp.',
});

onMounted(() => {
  nextTick(() => observe());
  const line = document.querySelector('.nosotros-line-top');
  if (line) {
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) line.classList.add('animated');
    }, { threshold: 0.5 });
    io.observe(line);
  }
});
</script>

<template>
  <div>
    <section id="hero" class="section hero">
      <div class="hero-content">
        <p class="hero-eyebrow">{{ t('home.heroEyebrow') }}</p>
        <h1 class="hero-title">
          <span class="hero-title-text">LU<span class="gold">X</span>TIME</span>
        </h1>
        <p class="hero-subtitle">Elegance · Presence · Style</p>
        <div class="hero-divider" />
        <p class="hero-tags">{{ t('home.heroTags') }}</p>
        <div class="hero-cta">
          <NuxtLink to="/catalogo" class="btn-primary">{{ t('home.viewCollection') }}</NuxtLink>
          <NuxtLink to="/#nosotros" class="btn-ghost">{{ t('home.contact') }}</NuxtLink>
        </div>
      </div>
    </section>

    <section class="marquee-section">
      <div class="marquee-track">
        <span v-for="(item, i) in [...marqueeItems, ...marqueeItems]" :key="i" class="marquee-item flex items-center gap-4">
          {{ item }}
          <span class="w-1 h-1 rounded-full bg-lux-gold inline-block" />
        </span>
      </div>
    </section>

    <section id="coleccion" class="section products-section">
      <div class="products-header reveal">
        <div>
          <p class="section-label">{{ t('home.collectionLabel') }}</p>
          <h2 class="section-title">{{ t('home.ourWatchesLead') }} <em>{{ t('home.ourWatchesEm') }}</em></h2>
        </div>
        <NuxtLink to="/catalogo" class="btn-ghost">{{ t('home.viewAll') }}</NuxtLink>
      </div>
      <div v-if="bestSellers?.length" class="products-grid">
        <CatalogProductCard
          v-for="(w, i) in bestSellers"
          :key="w.id"
          :watch="w"
          :delay="i * 0.15"
        />
      </div>
    </section>

    <section id="nosotros" class="nosotros-section">
      <div class="nosotros-line-top" />
      <div class="nosotros-intro reveal">
        <div>
          <p class="section-label">{{ t('home.aboutLabel') }}</p>
          <h2 class="section-title">{{ t('home.aboutTitle') }}<br><em>{{ t('home.aboutTitleEm') }}</em></h2>
        </div>
        <p class="section-body">
          {{ t('home.aboutBody') }}
          <br><br>{{ t('home.aboutLocation') }}
        </p>
      </div>
    </section>

    <section class="statement-section reveal">
      <p class="statement-text">{{ t('home.statement') }}<br><em>{{ t('home.statementEm') }}</em></p>
      <p class="statement-sub">{{ t('home.statementSub') }}</p>
    </section>
  </div>
</template>
