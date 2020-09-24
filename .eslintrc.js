module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  parser: 'babel-eslint',
  extends: [
    'airbnb-base',
  ],
  rules: {
    'class-methods-use-this': 0,
    'no-console': [
      1,
      {
        allow: ['warn', 'error'],
      },
    ],
    'no-param-reassign': [2, { props: false }],
  },
};
