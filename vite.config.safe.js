/* eslint-disable */
const { defineConfig } = require('vite');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const csso = require('csso');
const { optimize: svgoOptimize } = require('svgo');

// --- Utils ---

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
  // Minify CSS template literals
  minifyCss(code) {
    return code.replace(/const\s+css\s*=\s*`([\s\S]*?)`;/, (m, p1) => {
      try {
        const min = csso
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
        const res = svgoOptimize(svg, {
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
};

// --- Plugin ---

function spotlightOptimizer() {
  const banner = getBanner();

  return {
    name: 'spotlight-optimizer',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      if (!id.endsWith('src/spotlight.js')) return null;
      let out = code;
      out = transformers.minifyCss(out);
      out = transformers.optimizeSvg(out);
      return { code: out, map: null };
    },
    generateBundle(_, bundle) {
      Object.keys(bundle).forEach((fileName) => {
        if (!fileName.endsWith('spotlight.min.js')) return;
        const chunk = bundle[fileName];
        if (chunk.type !== 'chunk') return;

        if (banner) chunk.code = `${banner}\n${chunk.code}`;

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
          console.error('Error reporting bundle sizes:', err);
        }
      });
    },
  };
}

// --- Config ---

module.exports = defineConfig({
  plugins: [spotlightOptimizer()],
  build: {
    reportCompressedSize: false,
    lib: { entry: 'src/spotlight.js', name: 'Spotlight', formats: ['iife'] },
    rollupOptions: { output: { entryFileNames: 'spotlight.min.js' } },
  },
});
