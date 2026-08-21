<script setup lang="ts">
import type { UploadJob, MediaFileStatus } from '~/stores/media-upload';

const queue = useMediaUploadStore();

function statusIcon(s: MediaFileStatus) {
  if (s === 'done') return '✓';
  if (s === 'error') return '✕';
  return '';
}

function statusClass(s: MediaFileStatus) {
  return {
    'mq-file-icon--queue': s === 'queue',
    'mq-file-icon--uploading': s === 'uploading',
    'mq-file-icon--done': s === 'done',
    'mq-file-icon--error': s === 'error',
  };
}

function jobStatusLabel(job: UploadJob) {
  if (job.status === 'queue') return 'En cola';
  if (job.status === 'uploading') return 'Cargando';
  if (job.status === 'done') return 'Listo';
  return 'Error';
}

function jobStatusClass(job: UploadJob) {
  return {
    'mq-chip--queue': job.status === 'queue',
    'mq-chip--uploading': job.status === 'uploading',
    'mq-chip--done': job.status === 'done',
    'mq-chip--error': job.status === 'error',
  };
}

const fileRows: Array<{ key: 'image1' | 'image2' | 'video'; label: string }> = [
  { key: 'image1', label: 'Foto principal' },
  { key: 'image2', label: 'Foto secundaria' },
  { key: 'video', label: 'Video' },
];
</script>

<template>
  <div class="mq-wrap">
    <UiSectionHeader label="Operaciones" title="Procesos multimedia" />

    <div v-if="!queue.hasJobs" class="mq-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
      <p>Sin procesos activos. Cuando registres un reloj con archivos, aparecerá aquí.</p>
    </div>

    <div v-else class="mq-list">
      <button
        v-if="queue.hasDone"
        type="button"
        class="mq-clear-btn"
        @click="queue.clearDone()"
      >
        Limpiar completados
      </button>

      <div
        v-for="job in [...queue.jobs].reverse()"
        :key="job.id"
        class="mq-card"
        :class="{
          'mq-card--done': job.status === 'done',
          'mq-card--error': job.status === 'error',
          'mq-card--uploading': job.status === 'uploading',
        }"
      >
        <div class="mq-card-head">
          <div class="mq-card-info">
            <span class="mq-card-name">{{ job.brandName }} {{ job.model }}</span>
            <span class="mq-chip" :class="jobStatusClass(job)">
              <span v-if="job.status === 'uploading'" class="mq-spinner" aria-hidden="true" />
              {{ jobStatusLabel(job) }}
            </span>
          </div>
          <div class="mq-card-actions">
            <button
              v-if="job.status === 'error'"
              type="button"
              class="mq-retry-btn"
              @click="queue.retry(job.id)"
            >
              Reintentar
            </button>
            <button
              v-if="job.status === 'done' || job.status === 'error'"
              type="button"
              class="mq-dismiss-btn"
              aria-label="Descartar"
              @click="queue.dismiss(job.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="mq-files">
          <div
            v-for="row in fileRows"
            :key="row.key"
            class="mq-file-row"
          >
            <span class="mq-file-label">{{ row.label }}</span>
            <span class="mq-file-icon" :class="statusClass(job.fileStatuses[row.key])">
              <span
                v-if="job.fileStatuses[row.key] === 'uploading'"
                class="mq-spinner mq-spinner--sm"
                aria-hidden="true"
              />
              <span v-else>{{ statusIcon(job.fileStatuses[row.key]) }}</span>
            </span>
          </div>
        </div>

        <p v-if="job.errorMessage" class="mq-error-msg">{{ job.errorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style>
.mq-wrap {
  max-width: 700px;
}

.mq-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 64px 24px;
  text-align: center;
  color: var(--lux-white-dim);
}

.mq-empty svg {
  width: 48px;
  height: 48px;
  opacity: 0.3;
  color: var(--lux-gold);
}

.mq-empty p {
  font-family: var(--lux-font-body);
  font-size: 13px;
  line-height: 1.6;
  max-width: 320px;
}

.mq-clear-btn {
  display: block;
  margin-bottom: 16px;
  padding: 8px 16px;
  border: 1px solid rgba(200, 169, 110, 0.2);
  background: transparent;
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.mq-clear-btn:hover {
  border-color: var(--lux-gold);
  color: var(--lux-gold);
}

.mq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mq-card {
  border: 1px solid rgba(200, 169, 110, 0.1);
  background: var(--lux-black-2);
  padding: 18px 20px;
  transition: border-color 0.3s;
}

.mq-card--uploading {
  border-color: rgba(100, 149, 237, 0.35);
}

.mq-card--done {
  border-color: rgba(76, 223, 139, 0.25);
}

.mq-card--error {
  border-color: rgba(232, 93, 93, 0.35);
}

.mq-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.mq-card-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.mq-card-name {
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white);
  font-weight: 500;
}

.mq-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mq-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-family: var(--lux-font-body);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-radius: 2px;
  white-space: nowrap;
}

.mq-chip--queue {
  background: rgba(200, 169, 110, 0.12);
  color: #c8a96e;
  border: 1px solid rgba(200, 169, 110, 0.25);
}

.mq-chip--uploading {
  background: rgba(100, 149, 237, 0.12);
  color: #6495ed;
  border: 1px solid rgba(100, 149, 237, 0.3);
}

.mq-chip--done {
  background: rgba(76, 223, 139, 0.12);
  color: #4cdf8b;
  border: 1px solid rgba(76, 223, 139, 0.25);
}

.mq-chip--error {
  background: rgba(232, 93, 93, 0.12);
  color: #e85d5d;
  border: 1px solid rgba(232, 93, 93, 0.25);
}

.mq-retry-btn {
  padding: 6px 12px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  background: transparent;
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-gold);
  cursor: pointer;
  transition: background 0.2s;
}

.mq-retry-btn:hover {
  background: rgba(200, 169, 110, 0.1);
}

.mq-dismiss-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  font-size: 16px;
  line-height: 1;
  color: var(--lux-white-dim);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.mq-dismiss-btn:hover {
  color: var(--lux-white);
  border-color: rgba(255, 255, 255, 0.2);
}

.mq-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mq-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.mq-file-label {
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white-dim);
  letter-spacing: 0.05em;
}

.mq-file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.mq-file-icon--queue {
  background: rgba(200, 169, 110, 0.12);
  border: 1px solid rgba(200, 169, 110, 0.2);
  color: rgba(200, 169, 110, 0.6);
}

.mq-file-icon--uploading {
  background: rgba(100, 149, 237, 0.12);
  border: 1px solid rgba(100, 149, 237, 0.25);
}

.mq-file-icon--done {
  background: rgba(76, 223, 139, 0.15);
  border: 1px solid rgba(76, 223, 139, 0.3);
  color: #4cdf8b;
}

.mq-file-icon--error {
  background: rgba(232, 93, 93, 0.12);
  border: 1px solid rgba(232, 93, 93, 0.3);
  color: #e85d5d;
}

.mq-error-msg {
  margin-top: 10px;
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: #e85d5d;
  line-height: 1.5;
  word-break: break-word;
}

.mq-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(100, 149, 237, 0.2);
  border-top-color: #6495ed;
  border-radius: 50%;
  animation: mq-spin 0.7s linear infinite;
  flex-shrink: 0;
}

.mq-spinner--sm {
  width: 12px;
  height: 12px;
  border-width: 1.5px;
}

@keyframes mq-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .mq-card {
    padding: 14px 14px;
  }
}
</style>
