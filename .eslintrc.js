module.exports = {
  root: true,
  extends: ['prettier'],
  plugins: ['unused-imports', 'import'],
  rules: {
    // import
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['sibling', 'parent'],
          'index',
          'object',
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        // グループごとに改行を入れるか
        'newlines-between': 'always',
        // アルファベット順・大文字小文字を区別なし
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'unused-imports/no-unused-imports': 'error',
  },
}
