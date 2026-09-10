const browser = Object.fromEntries(
  [
    'Option',
    'document',
    'window',
    'localStorage',
    'navigator',
    'location',
    'performance',
    'requestAnimationFrame',
    'ResizeObserver',
    'devicePixelRatio',
    'FileReader',
    'Image',
    'AbortController',
    'AbortSignal',
    'TextEncoder',
    'TransformStream',
    'Response',
    'Blob',
    'URL',
    'fetch',
    'crypto',
    'setTimeout',
    'clearTimeout',
    'console',
  ].map((key) => [key, 'readonly']),
);
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browser,
        process: 'readonly',
        Buffer: 'readonly',
        structuredClone: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-duplicate-case': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
];
