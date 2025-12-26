module.exports = {
  extends: ['universe/native'],
  ignorePatterns: ['dist', 'build'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^ignored' }]
  }
};
