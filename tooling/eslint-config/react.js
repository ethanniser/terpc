/** @type {import('eslint').Linter.Config} */
const config = {
  plugins: ["react", "react-hooks", "react-compiler"],
  extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
  rules: {
    "react-compiler/react-compiler": "error",
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/rules-of-hooks": "error",
  },
  globals: {
    React: "writable",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  env: {
    browser: true,
  },
};

module.exports = config;
