<script setup lang="ts">
definePageMeta({ middleware: ['admin'] });
await navigateTo('/admin/pending-info', { replace: true });
</script>
