// postcss.config.cjs
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // Or just 'tailwindcss' if you are sure you're on v3/old config
    autoprefixer: {},
  },
};