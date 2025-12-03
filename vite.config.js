const { defineConfig } = require('vite');
const csso = require('csso');
const { optimize: svgoOptimize } = require('svgo');
const { minify: htmlMinify } = require('html-minifier-terser');
const fs = require('fs');
const path = require('path');

// Extract leading license/banner comment from source file so Rollup
// writes it at the top of the generated `spotlight.min.js` bundle.
function readBanner() {
  try {
    const srcPath = path.resolve(__dirname, 'src', 'spotlight.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('/*!');
    if (start !== -1) {
      const end = src.indexOf('*/', start + 3);
      if (end !== -1) return src.slice(start, end + 2);
    }
  } catch (err) {}
  return '';
}
const banner = readBanner();

// Plugin: minify inline CSS, optimize inline SVG, and minify HTML strings
function spotlightOptimizer() {
  return {
    name: 'spotlight-optimizer',
    apply: 'build',
    enforce: 'post',
    async transform(code, id) {
      // Only operate on the source file
      if (
        !id.endsWith('/src/spotlight.js') &&
        !id.endsWith('\\src\\spotlight.js')
      )
        return null;

      let out = code;

      // 0. Rename classes and IDs (spot-*) to short names (a, b, c...)
      // Exclude 'spotlight-' to avoid breaking data attributes and localStorage keys
      const idRegex = /(?<![\w-])spot-(?!light)[a-zA-Z0-9-]+/g;
      const ids = new Set(out.match(idRegex) || []);
      const map = new Map();
      let idx = 0;
      
      // Generator for short names: a, b, ... z, A ... Z, aa, ab ...
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      function generateId(n) {
        let res = '';
        do {
          res = chars[n % chars.length] + res;
          n = Math.floor(n / chars.length) - 1;
        } while (n >= 0);
        return res;
      }

      // Assign short names
      // Sort by length desc just in case, though greedy regex handles it
      Array.from(ids).sort((a, b) => b.length - a.length).forEach(id => {
        map.set(id, generateId(idx++));
      });

      // Replace all occurrences
      out = out.replace(idRegex, (m) => map.get(m));

      // 1. Minify the large injected CSS template literal assigned to `const css = `...`;
      out = out.replace(/const\s+css\s*=\s*`([\s\S]*?)`;/, (m, p1) => {
        try {
          const min = csso.minify(p1).css.replace(/`/g, '\\`');
          return `const css = \`${min}\`;`;
        } catch (err) {
          return m;
        }
      });

      // 2. Optimize inline SVG fragments found anywhere in the file
      out = out.replace(new RegExp('<svg[\\s\\S]*?<\\/svg>', 'g'), (svg) => {
        try {
          const res = svgoOptimize(svg, {
            multipass: true,
            plugins: [
              {
                name: 'preset-default',
                params: {
                  overrides: {
                    removeViewBox: false,
                  },
                },
              },
            ],
          });
          if (res && res.error) return svg;
          // Escape backticks to keep template literals safe
          return res.data.replace(/`/g, '\\`');
        } catch (err) {
          return svg;
        }
      });

      // 3. Minify HTML strings assigned to innerHTML
      const htmlRegex = /\.innerHTML\s*=\s*`([\s\S]*?)`;/g;
      let match;
      const replacements = [];
      
      while ((match = htmlRegex.exec(out)) !== null) {
        const fullMatch = match[0];
        const content = match[1];
        
        // Skip if it looks like it was already handled by SVG optimizer (starts with <svg)
        if (content.trim().startsWith('<svg')) continue;

        try {
            const min = await htmlMinify(content, {
                collapseWhitespace: true,
                removeComments: true,
                quoteCharacter: "'",
                minifyCSS: true,
            });
            // Escape backticks
            const safeMin = min.replace(/`/g, '\\`');
            replacements.push({
                start: match.index,
                end: match.index + fullMatch.length,
                replacement: fullMatch.replace(content, safeMin)
            });
        } catch (e) {}
      }

      // Apply replacements from end to start
      for (let i = replacements.length - 1; i >= 0; i--) {
          const r = replacements[i];
          out = out.slice(0, r.start) + r.replacement + out.slice(r.end);
      }

      return { code: out, map: null };
    },
    // Ensure banner is prepended to final bundle (after minification)
    generateBundle(_, bundle) {
      if (!banner) return;
      for (const fileName of Object.keys(bundle)) {
        if (!fileName.endsWith('spotlight.min.js')) continue;
        const chunk = bundle[fileName];
        if (chunk && chunk.type === 'chunk') {
          // Prepend banner comment and a single newline
          chunk.code = `${banner}\n` + chunk.code;
        }
      }
    },
  };
}

module.exports = defineConfig({
  plugins: [spotlightOptimizer()],
  build: {
    // Build the library as a single IIFE file (suitable for direct <script> include)
    lib: {
      entry: 'src/spotlight.js',
      name: 'Spotlight',
      formats: ['iife'],
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        unsafe: true,
        unsafe_arrows: true,
        booleans_as_integers: true,
        drop_console: true,
      },
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
    },
    // Ensure the output filename is exactly `spotlight.min.js`
    rollupOptions: {
      output: {
        entryFileNames: 'spotlight.min.js',
        // Preserve top-of-file license/banner
        banner,
      },
    },
  },
});
