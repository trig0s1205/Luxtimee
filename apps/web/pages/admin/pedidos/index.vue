<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

await navigateTo('/admin/pedidos/detal', { replace: true });
</script>
