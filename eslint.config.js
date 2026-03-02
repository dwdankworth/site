import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Commands: "writable",
        StreamingEngine: "writable",
        Terminal: "writable",
      },
    },
    rules: {
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^(Commands|StreamingEngine|Terminal)$", args: "none", caughtErrors: "none" }],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        require: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/", "playwright-report/", "test-results/"],
  },
];
