import nest from '@onlinedars/eslint-config/nest';

export default [
  ...nest,
  {
    files: ['prisma/seed.ts', 'prisma/seed-demo.ts'],
    rules: { 'no-console': 'off' },
  },
];
