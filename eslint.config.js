const importPlugin = require('eslint-plugin-import');

module.exports = [
  { ignores: ['dist/', 'node_modules/', '.cache/'] },

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        ResizeObserver: 'readonly',
        Image: 'readonly',
        CustomEvent: 'readonly',
        Node: 'readonly',
        Element: 'readonly',
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js'],
        },
      },
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',

      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'consistent-return': 'error',
      'no-empty-function': ['error', { allow: ['arrowFunctions'] }],

      'no-unused-vars': [
        'error',
        { args: 'none', vars: 'all', ignoreRestSiblings: true },
      ],
      'no-magic-numbers': [
        'warn',
        { ignore: [0, 1, -1], ignoreArrayIndexes: true, enforceConst: true },
      ],
      complexity: ['warn', { max: 12 }],
      'max-params': ['warn', 4],

      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
];
