import globals from "globals";
import pluginJs from "@eslint/js";
import jest from 'eslint-plugin-jest';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}, ...jest.configs['flat/recommended'], rules: {
      ...jest.configs['flat/recommended'].rules,
          'no-var': 'warn',
      'jest/prefer-expect-assertions': 'off',
      'jest/no-disabled-tests': 'off',
      'jest/expect-expect': 'off',
      'jest/no-done-callback': 'off'
    }},
  {languageOptions: { globals: globals.node }},
  pluginJs.configs.recommended,
];