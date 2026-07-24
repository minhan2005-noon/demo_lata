export default [
  {
    ignores: ["dist/**"]
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        AbortController: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        confirm: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        WebSocket: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "error"
    }
  }
];
