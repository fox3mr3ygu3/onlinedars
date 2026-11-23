import nest from '@onlinedars/eslint-config/nest';

export default [
  ...nest,
  {
    files: ['prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },
];
