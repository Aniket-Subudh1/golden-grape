// pm2 config on the server (/opt/golden-grape/ecosystem.config.cjs). `current` is a symlink to the active
// release; cluster mode lets `pm2 reload` start the new process before stopping the old one (no downtime).
module.exports = {
  apps: [
    {
      name: 'golden-grape',
      cwd: '/opt/golden-grape/current',
      script: '/opt/golden-grape/current/server.js',
      exec_mode: 'cluster',
      instances: 1,
      node_args: '--env-file=/opt/golden-grape/.env',
      env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
      max_memory_restart: '1G',
      listen_timeout: 30000,
      kill_timeout: 8000,
    },
  ],
};
