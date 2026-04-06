const importPlugin = require('eslint-plugin-import');

module.exports = [
  { ignores: ['dist/', 'node_modules/', '.cache/'] },

  // Configuration files (Node.js / CommonJS)
  {
    files: ['*.config.js', 'vite.config.*.js', 'scripts/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-magic-numbers': 'off',
      'no-console': 'off',
    },
  },

  // Project source files (Browser / ESM)
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        AbortController: 'readonly',
        WeakRef: 'readonly',
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
