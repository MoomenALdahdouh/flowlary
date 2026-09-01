/** PM2 process manager config for bare-metal / VM deployment (no Docker). */
module.exports = {
  apps: [
    {
      name: 'flowlary-api',
      cwd: './backend',
      script: 'node',
      args: '--import tsx src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      kill_timeout: 15000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 8787,
      },
    },
  ],
}
