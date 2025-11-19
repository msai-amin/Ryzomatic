// Support both Tailwind CSS v3 and v4
// v4 requires @tailwindcss/postcss, v3 uses tailwindcss directly
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

let tailwindPlugin = { tailwindcss: {} }

try {
  // Check Tailwind version - v4 starts with 4.x
  const tailwindPkg = require('tailwindcss/package.json')
  const tailwindVersion = tailwindPkg.version
  const majorVersion = parseInt(tailwindVersion.split('.')[0])
  
  if (majorVersion >= 4) {
    // Tailwind v4+ requires @tailwindcss/postcss
    try {
      require.resolve('@tailwindcss/postcss')
      tailwindPlugin = { '@tailwindcss/postcss': {} }
    } catch {
      console.warn('Tailwind v4 detected but @tailwindcss/postcss not found. Falling back to tailwindcss plugin.')
      tailwindPlugin = { tailwindcss: {} }
    }
  } else {
    // Tailwind v3 uses tailwindcss directly
    tailwindPlugin = { tailwindcss: {} }
  }
} catch {
  // Fall back to tailwindcss (Tailwind v3) if version check fails
  tailwindPlugin = { tailwindcss: {} }
}

export default {
  plugins: {
    ...tailwindPlugin,
    autoprefixer: {},
  },
}


