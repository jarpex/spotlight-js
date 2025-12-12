/* eslint-disable */
const { defineConfig } = require('vite');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- Utils ---

const safeRequire = (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};

// Filter noisy logs from Vite/Rollup to avoid duplicate size reporting
const patchLogs = () => {
  const shouldHide = (str) => {
    if (!str) return false;
    const clean = str.replace(/\x1b\[[0-9;]*m/g, '');
    return (
      /rendering chunks? \(\d+\)\.\.\./i.test(clean) ||
      (clean.includes('spotlight.min.js') && !clean.includes('gzip:'))
    );
  };

  const patchConsole = (method) => {
    if (!console[method]) return;
    const orig = console[method].bind(console);
    console[method] = (...args) => {
      const msg = args.map((a) => String(a)).join(' ');
      if (!shouldHide(msg)) orig(...args);
    };
  };

  const patchStream = (stream) => {
    if (!stream || !stream.write) return;
    const orig = stream.write.bind(stream);
    stream.write = (chunk, encoding, cb) => {
      const msg = chunk && chunk.toString ? chunk.toString() : String(chunk);
      if (shouldHide(msg)) {
        const callback = typeof encoding === 'function' ? encoding : cb;
        if (callback) callback();
        return true;
      }
      return orig(chunk, encoding, cb);
    };
  };

  patchConsole('log');
  patchConsole('info');
  patchStream(process.stdout);
  patchStream(process.stderr);
};

patchLogs();

const getBanner = () => {
  try {
    const src = fs.readFileSync(
      path.resolve(__dirname, 'src/spotlight.js'),
      'utf8'
    );
    const match = src.match(/\/\*![\s\S]*?\*\//);
    return match ? match[0] : '';
  } catch {
    return '';
  }
};

// --- Transformers ---

const transformers = {
  // Rename classes/IDs (spot-*) to short names (a, b, c...)
  shortenIds(code) {
    const idRegex = /(?<![\w-])spot-(?!light)[a-zA-Z0-9-]+/g;
    const ids = Array.from(new Set(code.match(idRegex) || [])).sort(
      (a, b) => b.length - a.length
    );
    const map = new Map();
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    ids.forEach((id, i) => {
      let res = '',
        n = i;
      do {
        res = chars[n % chars.length] + res;
        n = Math.floor(n / chars.length) - 1;
      } while (n >= 0);
      map.set(id, res);
    });

    return code.replace(idRegex, (m) => map.get(m));
  },

  // Minify CSS template literals
  minifyCss(code) {
    return code.replace(/const\s+css\s*=\s*`([\s\S]*?)`;/, (m, p1) => {
      try {
        const min = require('csso')
          .minify(p1)
          .css.replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`');
        return `const css = \`${min}\`;`;
      } catch {
        return m;
      }
    });
  },

  // Optimize inline SVGs
  optimizeSvg(code) {
    return code.replace(/<svg[\s\S]*?<\/svg>/g, (svg) => {
      try {
        const { optimize } = require('svgo');
        const res = optimize(svg, {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: { overrides: { removeViewBox: false } },
            },
          ],
        });
        return (res.error ? svg : res.data)
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`');
      } catch {
        return svg;
      }
    });
  },

  // Minify HTML strings
  async minifyHtml(code) {
    const { minify } = require('html-minifier-terser');
    const regex = /\.innerHTML\s*=\s*`([\s\S]*?)`;/g;
    let match,
      out = code;
    const replacements = [];

    while ((match = regex.exec(code)) !== null) {
      if (match[1].trim().startsWith('<svg')) continue;
      try {
        const min = await minify(match[1], {
          collapseWhitespace: true,
          removeComments: true,
          quoteCharacter: "'",
          minifyCSS: true,
        });
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          txt: match[0].replace(
            match[1],
            min.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
          ),
        });
      } catch (err) {
        console.error('Failed to minify HTML:', err);
      }
    }

    for (let i = replacements.length - 1; i >= 0; i--) {
      out =
        out.slice(0, replacements[i].start) +
        replacements[i].txt +
        out.slice(replacements[i].end);
    }
    return out;
  },
};

// --- Plugin ---

function spotlightOptimizer() {
  const banner = getBanner();

  return {
    name: 'spotlight-optimizer',
    apply: 'build',
    enforce: 'post',
    async transform(code, id) {
      if (!id.endsWith('src/spotlight.js')) return null;
      let out = code;
      out = transformers.shortenIds(out);
      out = transformers.minifyCss(out);
      out = transformers.optimizeSvg(out);
      out = await transformers.minifyHtml(out);
      return { code: out, map: null };
    },
    generateBundle(_, bundle) {
      Object.keys(bundle).forEach((fileName) => {
        if (!fileName.endsWith('spotlight.min.js')) return;
        const chunk = bundle[fileName];
        if (chunk.type !== 'chunk') return;

        if (banner) chunk.code = `${banner}\n${chunk.code}`;

        // Report sizes
        try {
          const buf = Buffer.from(chunk.code);
          const size = (b) => (b ? `${(b / 1024).toFixed(1)} kB` : '0.0 kB');
          const gz = (b) => {
            try {
              return zlib.gzipSync(b).length;
            } catch {
              return 0;
            }
          };
          const br = (b) => {
            try {
              return zlib.brotliCompressSync(b).length;
            } catch {
              return 0;
            }
          };

          console.log(
            `dist/\x1b[36m${fileName}\x1b[0m  ` +
              `\x1b[38;5;15m${size(buf.length)} │ gzip: \x1b[1;30m${size(gz(buf))} \x1b[0m\x1b[38;5;15m│ \x1b[38;5;15mbrotli: \x1b[1;30m${size(br(buf))}\x1b[0m`
          );
        } catch (err) {
          console.error('Error reporting bundle size:', err);
        }
      });
    },
  };
}

// --- Config ---

const plugins = [spotlightOptimizer()];
const replace = safeRequire('@rollup/plugin-replace');
const strip = safeRequire('@rollup/plugin-strip');

if (replace)
  plugins.push(
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      preventAssignment: true,
    })
  );
if (strip)
  plugins.push(
    strip({
      include: 'src/**',
      functions: ['assert.*', 'debug*'],
      sourceMap: false,
    })
  );

module.exports = defineConfig({
  plugins,
  build: {
    reportCompressedSize: false,
    lib: { entry: 'src/spotlight.js', name: 'Spotlight', formats: ['iife'] },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 10,
        unsafe: true,
        unsafe_arrows: true,
        toplevel: false,
        pure_getters: true,
        collapse_vars: true,
        reduce_vars: true,
        sequences: true,
        drop_console: true,
        drop_debugger: true,
        booleans_as_integers: true,
      },
      mangle: {
        properties: { regex: /^_/ },
        toplevel: false,
        keep_classnames: false,
        keep_fnames: false,
      },
    },
    rollupOptions: { output: { entryFileNames: 'spotlight.min.js' } },
  },
});
