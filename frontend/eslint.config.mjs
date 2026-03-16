import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**'],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
      'react/no-unescaped-entities': 'off',
      'jsx-a11y/role-has-required-aria-props': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
];
