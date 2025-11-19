// Support both Tailwind CSS v3 and v4
// v4 requires @tailwindcss/postcss, v3 uses tailwindcss directly
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

let tailwindPlugin = { tailwindcss: {} }

try {
  // Check if @tailwindcss/postcss is available (Tailwind v4)
  require.resolve('@tailwindcss/postcss')
  tailwindPlugin = { '@tailwindcss/postcss': {} }
} catch {
  // Fall back to tailwindcss (Tailwind v3)
  tailwindPlugin = { tailwindcss: {} }
}

export default {
  plugins: {
    ...tailwindPlugin,
    autoprefixer: {},
  },
}


