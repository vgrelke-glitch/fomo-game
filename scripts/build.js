const { spawn } = require('child_process');

const reactScriptsBin = require.resolve('react-scripts/bin/react-scripts.js');

const env = {
  ...process.env,
  GENERATE_SOURCEMAP: 'false',
  CI: 'false',
};

const child = spawn(process.execPath, [reactScriptsBin, 'build'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
