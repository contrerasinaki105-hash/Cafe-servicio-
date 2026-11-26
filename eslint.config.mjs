import next from 'eslint-config-next';

const config = [...next, { ignores: ['.next/**', 'node_modules/**', 'tests/db/**'] }];
export default config;
