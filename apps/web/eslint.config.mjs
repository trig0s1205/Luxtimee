import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
// ESLint 8 lee este flat config vía ESLINT_USE_FLAT_CONFIG.

export default createConfigForNuxt({
  features: {
    stylistic: false,
    tooling: false,
  },
}).append({
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/require-default-prop': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/html-self-closing': 'off',
    'vue/no-multiple-template-root': 'off',
    'vue/singleline-html-element-content-newline': 'off',
  },
});
