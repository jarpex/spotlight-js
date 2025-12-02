const { defineConfig } = require('vite');
const csso = require('csso');
const { optimize: svgoOptimize } = require('svgo');
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

// Plugin: minify inline CSS and optimize inline SVG strings inside src/spotlight.js
function minifyInlineCssSvg() {
  return {
    name: 'minify-inline-css-svg',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      // Only operate on the source file
      if (
        !id.endsWith('/src/spotlight.js') &&
        !id.endsWith('\\src\\spotlight.js')
      )
        return null;

      let out = code;

      // Minify the large injected CSS template literal assigned to `const css = `...`;
      out = out.replace(/const\s+css\s*=\s*`([\s\S]*?)`;/, (m, p1) => {
        try {
          const min = csso.minify(p1).css.replace(/`/g, '\\`');
          return `const css = \`${min}\`;`;
        } catch (err) {
          return m;
        }
      });

      // Optimize inline SVG fragments found anywhere in the file
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
  plugins: [minifyInlineCssSvg()],
  build: {
    // Build the library as a single IIFE file (suitable for direct <script> include)
    lib: {
      entry: 'src/spotlight.js',
      name: 'Spotlight',
      formats: ['iife'],
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
