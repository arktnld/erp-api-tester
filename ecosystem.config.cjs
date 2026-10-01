// PM2: 4 instâncias em cluster dividindo a porta 9000.
// Uma requisição pesada a um ERP não trava a interface dos outros, e `pm2 reload`
// troca as instâncias uma a uma, sem derrubar o site no deploy.
module.exports = {
  apps: [
    {
      name: 'erp-api',
      cwd: `${__dirname}/apps/web`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 9000',
      exec_mode: 'cluster',
      instances: 4,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
    },
  ],
}
