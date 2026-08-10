<script setup lang="ts">
definePageMeta({ middleware: ['admin'], keepalive: true });

await navigateTo('/admin/pedidos/detal', { replace: true });
</script>



