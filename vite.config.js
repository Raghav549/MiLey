import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as lucideIcons from 'lucide-react'

const REACT_HOOKS = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext', 'createContext']

// Automatically inject missing React hook imports if referenced in JSX/JS files
function reactHooksAutoImport() {
  return {
    name: 'react-hooks-auto-import',
    transform(code, id) {
      if (!/\/src\/.*\.(jsx?|tsx?)$/.test(id)) return null
      const missing = REACT_HOOKS.filter(hook => {
        if (!new RegExp(`\\b${hook}\\s*\\(`).test(code)) return false
        const importedRe = new RegExp(`import\\s+[^;]*\\b${hook}\\b[^;]*from\\s+['"]react['"]`)
        const destructuredRe = new RegExp(`(?:const|let|var)\\s+\\{[^}]*\\b${hook}\\b[^}]*\\}\\s*=\\s*React\\b`)
        const definedRe = new RegExp(`(?:function\\s+${hook}\\b|(?:const|let|var)\\s+${hook}\\s*=)`)
        return !importedRe.test(code) && !destructuredRe.test(code) && !definedRe.test(code)
      })
      if (missing.length === 0) return null
      return { code: `import { ${missing.join(', ')} } from 'react';\n` + code, map: null }
    },
  }
}

const LUCIDE_EXPORTS = new Set(Object.keys(lucideIcons))

function lucideSafeImport() {
  return {
    name: 'lucide-safe-import',
    transform(code, id) {
      if (!/\/src\/.*\.(jsx?|tsx?)$/.test(id)) return null
      if (!code.includes('lucide-react')) return null
      let changed = false
      const newCode = code.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
        (match, specifiers) => {
          const valid = []
          const stubs = []
          for (const raw of specifiers.split(',')) {
            const s = raw.trim()
            if (!s) continue
            const parts = s.split(/\s+as\s+/)
            const imported = parts[0].trim()
            const local = (parts[1] || parts[0]).trim()
            if (LUCIDE_EXPORTS.has(imported)) {
              valid.push(s)
            } else {
              stubs.push(local)
              changed = true
            }
          }
          if (stubs.length === 0) return match
          const importLine = valid.length > 0 ? `import { ${valid.join(', ')} } from 'lucide-react';` : ''
          const stubLine = stubs.map(name => `const ${name} = () => null;`).join(' ')
          return [importLine, stubLine].filter(Boolean).join('\n')
        }
      )
      return changed ? { code: newCode, map: null } : null
    },
  }
}

export default defineConfig({
  plugins: [reactHooksAutoImport(), lucideSafeImport(), react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
    ],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
