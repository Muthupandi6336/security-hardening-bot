module.exports = {
  apps: [
    {
      name: 'shieldai-backend',
      script: './server.js',
      instances: 'max', // Scale across all available CPU cores
      exec_mode: 'cluster', // Enables load balancing
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      max_memory_restart: '1G' // Automatically restart if app uses > 1GB memory
    }
  ]
};
