import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "logs/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
);
