import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['mesa-scene-catalyst-indie.trycloudflare.com'],
  async rewrites() {
    return [
      { source: '/', destination: '/login.html' },
      { source: '/dashboard', destination: '/dashboard.html' },
      { source: '/lancamentos', destination: '/lancamentos.html' },
      { source: '/contas-a-pagar', destination: '/contas-a-pagar.html' },
      { source: '/configuracoes', destination: '/configuracoes.html' },
      { source: '/novo-lancamento', destination: '/novo-lancamento.html' },
      { source: '/ia/input', destination: '/ia-input.html' },
      { source: '/ia/confirmacao', destination: '/ia-confirmacao.html' },
      { source: '/fechamento', destination: '/fechamento.html' },
      { source: '/churrasco', destination: '/churrasco.html' },
      { source: '/importar', destination: '/importar.html' },
      { source: '/login', destination: '/login.html' },
      { source: '/contas', destination: '/contas.html' },
      { source: '/categorias', destination: '/categorias.html' },
      { source: '/setup', destination: '/setup-wizard.html' },
    ];
  },
};

export default nextConfig;