<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
await navigateTo('/admin/configuracion', { replace: true });
</script>
