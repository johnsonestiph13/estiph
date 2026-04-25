/**
 * PM2 Ecosystem Configuration
 * For production process management
 */

module.exports = {
  apps: [
    {
      name: 'estif-home-api',
      script: 'server.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      instance_var: 'INSTANCE_ID',
      node_args: '--max-old-space-size=512 --expose-gc',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'estif-home-worker',
      script: 'workers/sync-worker.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log'
    },
    {
      name: 'estif-home-cron',
      script: 'cron/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ],
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:estif/estif-home-ultimate.git',
      path: '/var/www/estif-home',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};