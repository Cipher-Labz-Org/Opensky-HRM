import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import expoConfig from "eslint-config-expo/flat";

export default tseslint.config(eslint.configs.recommended, ...expoConfig, {
  ignores: ["node_modules/", ".expo/", "dist/"],
});
