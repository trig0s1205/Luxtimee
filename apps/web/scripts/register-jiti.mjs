import { createRequire, register } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'));
const jitiPkg = nuxtRequire.resolve('jiti/package.json');
const jitiRegister = join(dirname(jitiPkg), 'lib/jiti-register.mjs');
register(pathToFileURL(jitiRegister).href, import.meta.url);
