import { terser } from 'rollup-plugin-terser';
import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const babelConfig = {
  babelHelpers: 'runtime',
  exclude: ['node_modules/**'],
};

export default [
  {
    input: 'src/index.js',
    output: {
      file: 'dist/tracker.umd.js',
      format: 'umd',
      name: 'tracker',
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      babel(babelConfig),
      terser(),
    ],
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/tracker.js',
      format: 'es',
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      babel(babelConfig),
      terser(),
    ],
  },
];
