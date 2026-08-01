<script setup lang="ts">
import type { HomepageFounderConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageFounderConfig }>();

const { resolve } = useMediaUrl();

const carouselReady = computed(
  () => (props.config.carouselImages ?? []).filter(Boolean).length === 5,
);

const signatureSrc = computed(() => resolve(props.config.signatureImageUrl));
</script>

<template>
  <section id="nosotros" class="lux-founder">
    <div class="lux-founder__ambient" aria-hidden="true" />
    <div class="lux-founder__ambient lux-founder__ambient--right" aria-hidden="true" />

    <div class="lux-founder__inner">
      <div class="lux-founder__text reveal">
        <div class="lux-founder__badge">
          <span class="lux-founder__badge-line" />
          {{ props.config.badge }}
          <span class="lux-founder__badge-line" />
        </div>

        <h2 class="lux-founder__title">
          {{ props.config.title }}<br>
          <em>{{ props.config.titleEm }}</em>
        </h2>

        <blockquote v-if="props.config.quote" class="lux-founder__quote">
          <span class="lux-founder__quote-mark" aria-hidden="true">"</span>
          {{ props.config.quote.replace(/^[""]|[""]$/g, '') }}
        </blockquote>

        <div class="lux-founder__story">
          <p
            v-for="(para, i) in props.config.storyParagraphs"
            :key="i"
            class="lux-founder__para"
          >
            {{ para }}
          </p>
        </div>

        <div class="lux-founder__signature">
          <div class="lux-founder__signature-seal" aria-hidden="true">
            <img
              v-if="signatureSrc"
              :src="signatureSrc"
              alt=""
              class="lux-founder__signature-img"
            />
            <span v-else>LX</span>
          </div>
          <div>
            <p class="lux-founder__signature-name">{{ props.config.signatureName }}</p>
            <p class="lux-founder__signature-role">{{ props.config.signatureRole }}</p>
          </div>
        </div>
      </div>

      <div class="lux-founder__media reveal">
        <HomeFounderCoverflowCarousel
          v-if="carouselReady"
          :images="props.config.carouselImages"
        />
        <div v-else class="lux-founder__no-images">
          <div class="lux-founder__no-images-emblem">
            <span>LX</span>
            <p>Luxtime</p>
            <small>Carga 5 fotos en Configuración → Index</small>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lux-founder {
  position: relative;
  padding: clamp(5rem, 10vw, 9rem) clamp(1.5rem, 6vw, 5rem);
  overflow: hidden;
  background: var(--black);
}

.lux-founder__ambient {
  position: absolute;
  top: 15%;
  left: -10%;
  width: 55vw;
  height: 55vw;
  max-width: 700px;
  max-height: 700px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(200, 169, 110, 0.065) 0%, transparent 65%);
  filter: blur(40px);
}

.lux-founder__ambient--right {
  top: auto;
  bottom: -10%;
  left: auto;
  right: -10%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, rgba(200, 169, 110, 0.04) 0%, transparent 65%);
}

.lux-founder__inner {
  position: relative;
  z-index: 1;
  max-width: 1300px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: clamp(2.5rem, 6vw, 5rem);
  align-items: center;
}

.lux-founder__badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 1.75rem;
}

.lux-founder__badge-line {
  flex: 0 0 28px;
  height: 1px;
  background: var(--gold);
  opacity: 0.5;
}

.lux-founder__title {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 5.5vw, 5rem);
  font-weight: 300;
  line-height: 1.05;
  color: var(--white);
  margin: 0 0 2rem;
}

.lux-founder__title em {
  font-style: italic;
  color: var(--gold-light);
}

.lux-founder__quote {
  position: relative;
  margin: 0 0 2.25rem;
  padding: 1.5rem 1.75rem;
  border-left: 2px solid rgba(200, 169, 110, 0.4);
  background: linear-gradient(135deg, rgba(200, 169, 110, 0.06) 0%, transparent 100%);
  border-radius: 0 4px 4px 0;
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 2vw, 1.45rem);
  font-style: italic;
  font-weight: 300;
  color: var(--gold-light);
  line-height: 1.5;
}

.lux-founder__quote-mark {
  position: absolute;
  top: -0.5rem;
  left: 1rem;
  font-size: 3rem;
  line-height: 1;
  color: rgba(200, 169, 110, 0.25);
  font-family: var(--font-display);
  pointer-events: none;
}

.lux-founder__story {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  margin-bottom: 2.5rem;
}

.lux-founder__para {
  font-family: var(--font-body);
  font-size: clamp(0.875rem, 1.3vw, 1rem);
  line-height: 1.85;
  color: var(--white-dim);
  letter-spacing: 0.02em;
}

.lux-founder__signature {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(200, 169, 110, 0.15);
}

.lux-founder__signature-seal {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid rgba(200, 169, 110, 0.4);
  background: linear-gradient(135deg, rgba(200, 169, 110, 0.12), rgba(200, 169, 110, 0.04));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--gold);
  transition: transform 0.6s ease;
  overflow: hidden;
}

.lux-founder__signature-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.lux-founder__signature:hover .lux-founder__signature-seal {
  transform: rotate(15deg);
}

.lux-founder__signature-name {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-style: italic;
  color: var(--white);
  margin-bottom: 0.2rem;
}

.lux-founder__signature-role {
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--gold);
  opacity: 0.75;
}

.lux-founder__media {
  min-width: 0;
}

.lux-founder__no-images {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
}

.lux-founder__no-images-emblem {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  border: 1px solid rgba(200, 169, 110, 0.15);
  border-radius: 4px;
  background: rgba(200, 169, 110, 0.04);
}

.lux-founder__no-images-emblem span {
  font-family: var(--font-display);
  font-size: 3rem;
  color: rgba(200, 169, 110, 0.5);
  letter-spacing: 0.12em;
}

.lux-founder__no-images-emblem p {
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--gold);
}

.lux-founder__no-images-emblem small {
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--white-dim);
  opacity: 0.7;
}

@media (max-width: 1024px) {
  .lux-founder__inner {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
}

@media (max-width: 640px) {
  .lux-founder {
    padding: 3.5rem 1.25rem;
  }

  .lux-founder__title {
    font-size: clamp(2rem, 8vw, 2.75rem);
  }

  .lux-founder__quote {
    padding: 1.25rem 1.25rem;
    font-size: clamp(1rem, 4.5vw, 1.25rem);
  }
}

@media (max-width: 480px) {
  .lux-founder {
    padding: 2.75rem 1rem;
  }

  .lux-founder__inner {
    gap: 2rem;
  }
}
</style>
