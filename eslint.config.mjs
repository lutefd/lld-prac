import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const INLINE_SUPPRESSION_PATTERN =
  /(?:^|[\s/*])(?:eslint-disable(?:-next-line|-line)?|eslint-enable|@ts-ignore|@ts-nocheck|@ts-expect-error|biome-ignore|oxlint-disable)\b/;

const localArchitecturePlugin = {
  rules: {
    "no-inline-suppression": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow inline lint and TypeScript suppression comments.",
        },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            const comments = context.sourceCode.getAllComments();
            for (const comment of comments) {
              if (INLINE_SUPPRESSION_PATTERN.test(comment.value)) {
                context.report({
                  loc: comment.loc,
                  message:
                    "Inline lint/type suppressions are banned. Fix the root cause (narrow types, fix hook dependencies, or refactor cross-layer imports) instead of silencing the checker.",
                });
              }
            }
          },
        };
      },
    },
  },
};

const REACT_LAYERS = [
  "app-entry",
  "app-page",
  "ui-component",
  "ui-context",
  "client-lib",
  "i18n",
  "client-asset",
];

const fromFile = (categories) => ({ file: { categories } });
const toFile = (categories) => ({ to: { file: { categories } } });

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".practice/**",
      "test-results/**",
      "playwright-report/**",
      "deploy/**",
      "server/java/**",
    ],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    plugins: {
      architecture: localArchitecturePlugin,
      boundaries,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: ["./tsconfig.json", "./tsconfig.server.json"],
        },
      },
      "boundaries/include": [
        "src/**/*",
        "shared/**/*",
        "server/**/*",
        "scripts/**/*",
        "tests/**/*",
      ],
      "boundaries/files": [
        {
          category: "tests",
          pattern: ["tests/**/*", "**/*.test.ts", "**/*.spec.ts"],
        },
        {
          category: "app-entry",
          pattern: "src/main.tsx",
        },
        {
          category: "app-page",
          pattern: ["src/App.tsx", "src/Roadmap.tsx"],
        },
        {
          category: "ui-context",
          pattern: "src/preferences.tsx",
        },
        {
          category: "ui-component",
          pattern: [
            "src/Editor.tsx",
            "src/PanelDivider.tsx",
            "src/components/**/*.tsx",
          ],
        },
        {
          category: "i18n",
          pattern: "src/*Translations.ts",
        },
        {
          category: "client-lib",
          pattern: [
            "src/lsp.ts",
            "src/editorThemes.ts",
            "src/navigation.ts",
            "src/lib/**/*.ts",
          ],
        },
        {
          category: "client-asset",
          pattern: "src/**/*.css",
        },
        {
          category: "shared",
          pattern: "shared/**/*.ts",
        },
        {
          category: "server",
          pattern: "server/**/*.ts",
        },
        {
          category: "scripts",
          pattern: ["scripts/**/*.ts", "scripts/**/*.mjs"],
        },
      ],
    },
    rules: {
      "architecture/no-inline-suppression": "error",
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Architecture boundary violation ({{ from.file.categories.[0] }} -> {{ to.file.categories.[0] }}). Move shared contracts to shared/, move UI state/helpers down to client-lib or ui-context, or invert the dependency via props/callbacks.",
          policies: [
            {
              from: fromFile("app-entry"),
              allow: [toFile(["app-page", "ui-context", "client-asset"])],
            },
            {
              from: fromFile("app-page"),
              allow: [
                toFile([
                  "app-page",
                  "ui-component",
                  "ui-context",
                  "client-lib",
                  "i18n",
                  "client-asset",
                  "shared",
                ]),
              ],
            },
            {
              from: fromFile("ui-component"),
              allow: [
                toFile([
                  "ui-component",
                  "ui-context",
                  "client-lib",
                  "i18n",
                  "client-asset",
                  "shared",
                ]),
              ],
            },
            {
              from: fromFile("ui-context"),
              allow: [toFile(["client-lib", "i18n", "client-asset", "shared"])],
            },
            {
              from: fromFile("client-lib"),
              allow: [toFile(["client-lib", "shared"])],
            },
            {
              from: fromFile("i18n"),
              allow: [toFile("i18n")],
            },
            {
              from: fromFile("shared"),
              allow: [toFile("shared")],
            },
            {
              from: fromFile("server"),
              allow: [toFile(["server", "shared"])],
            },
            {
              from: fromFile("scripts"),
              allow: [toFile(["scripts", "server", "shared"])],
            },
            {
              from: fromFile("tests"),
              allow: [
                toFile([
                  "tests",
                  "server",
                  "shared",
                  "app-page",
                  "ui-component",
                  "ui-context",
                  "client-lib",
                  "i18n",
                ]),
              ],
            },
            {
              from: fromFile(REACT_LAYERS),
              disallow: [toFile("server")],
              message:
                "React client code ({{ from.file.categories.[0] }}) cannot import Node/Express server code. Fetch data through /api/* endpoints or move shared types/contracts into shared/.",
            },
            {
              from: fromFile("server"),
              disallow: [toFile(REACT_LAYERS)],
              message:
                "Server code cannot depend on React client modules ({{ to.file.categories.[0] }}). Extract shared domain types or helpers into shared/ so both server/ and src/ can import them.",
            },
            {
              from: fromFile("shared"),
              disallow: [toFile(["server", ...REACT_LAYERS])],
              message:
                "Shared domain modules must stay runtime-agnostic. Keep React/DOM logic in src/ and Node/Express logic in server/, and pass data or interfaces into shared/ instead of importing {{ to.file.categories.[0] }}.",
            },
            {
              from: fromFile("ui-component"),
              disallow: [toFile(["app-page", "app-entry"])],
              message:
                "Reusable React components cannot depend on page containers ({{ to.file.categories.[0] }}). Pass state and event handlers down through props or move shared state into ui-context (src/preferences.tsx).",
            },
            {
              from: fromFile("ui-context"),
              disallow: [toFile(["app-page", "ui-component", "app-entry"])],
              message:
                "React context providers must sit below pages and UI components to prevent circular dependencies. Move shared state/types into context or client-lib and keep component composition above context.",
            },
            {
              from: fromFile("client-lib"),
              disallow: [
                toFile(["app-entry", "app-page", "ui-component", "ui-context"]),
              ],
              message:
                "Client service/utility modules must stay decoupled from React UI ({{ to.file.categories.[0] }}). Pass callbacks, config, or state values as function/constructor parameters instead.",
            },
            {
              from: fromFile("i18n"),
              disallow: [
                toFile([
                  "app-entry",
                  "app-page",
                  "ui-component",
                  "ui-context",
                  "client-lib",
                  "client-asset",
                  "shared",
                  "server",
                ]),
              ],
              message:
                "Translation tables must remain pure data modules. Remove imports from {{ to.file.categories.[0] }} and pass dynamic values as interpolation parameters at the call site.",
            },
            {
              from: fromFile([
                "app-entry",
                "app-page",
                "ui-component",
                "ui-context",
                "client-lib",
                "i18n",
                "shared",
                "server",
                "scripts",
              ]),
              disallow: [toFile("tests")],
              message:
                "Production code ({{ from.file.categories.[0] }}) cannot import test files. Extract reusable helpers or fixtures into a non-test module if production code needs them.",
            },
            {
              from: fromFile("tests"),
              allow: [
                toFile([
                  "tests",
                  "server",
                  "shared",
                  "app-page",
                  "ui-component",
                  "ui-context",
                  "client-lib",
                  "i18n",
                ]),
              ],
            },
          ],
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: ["usePreferences", "browserLocale"],
        },
      ],
    },
  },
  {
    files: [
      "server/**/*.ts",
      "shared/**/*.ts",
      "scripts/**/*.{ts,mjs}",
      "tests/**/*.ts",
      "*.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);
