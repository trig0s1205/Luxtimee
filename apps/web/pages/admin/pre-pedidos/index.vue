<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
await navigateTo('/admin/pre-pedidos/activos', { replace: true });
</script>
