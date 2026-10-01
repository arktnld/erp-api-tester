'use client'

import { useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { Button } from './button'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'tour-seen-v3'

const steps = [
  {
    popover: {
      title: '👋 Bem-vindo ao ERP Tester',
      description: 'Uma visita rápida para você conhecer as principais funcionalidades da ferramenta.',
    },
  },
  {
    element: '[data-tour="test"]',
    popover: {
      title: 'Testar API',
      description: 'O coração da ferramenta. Selecione um ERP, empresa, endpoint e cliente de teste para disparar requisições e inspecionar respostas em tempo real.',
    },
  },
  {
    element: '[data-tour="playbooks"]',
    popover: {
      title: 'Fluxos',
      description: 'Crie sequências automatizadas de requisições para testar fluxos completos — por exemplo: autenticar → buscar cliente → criar pedido.',
    },
  },
  {
    element: '[data-tour="records"]',
    popover: {
      title: 'Registros',
      description: 'Documente sequências de requisições e compartilhe com o time. Útil para registrar testes importantes e resultados.',
    },
  },
  {
    element: '[data-tour="erps"]',
    popover: {
      title: 'ERPs',
      description: 'Configure seus sistemas ERP: URL base, headers de autenticação e os endpoints disponíveis para teste.',
    },
  },
  {
    element: '[data-tour="companies"]',
    popover: {
      title: 'Empresas',
      description: 'Gerencie as empresas que usam cada ERP. Cada empresa tem seus próprios clientes de teste com credenciais específicas.',
    },
  },
  {
    element: '[data-tour="history"]',
    popover: {
      title: 'Histórico',
      description: 'Todas as requisições executadas ficam salvas aqui com status, tempo de resposta e payload completo. Você pode repetir qualquer requisição com um clique.',
    },
  },
  {
    element: '[data-tour="collections"]',
    popover: {
      title: 'Documentação',
      description: 'Explore todos os endpoints disponíveis com exemplos de payload e resposta para cada ERP cadastrado.',
    },
  },
  {
    element: '[data-tour="settings"]',
    popover: {
      title: 'Configurações',
      description: 'Gerencie os usuários da ferramenta e ajuste as configurações gerais do sistema.',
    },
  },
  {
    element: '[data-tour="footer"]',
    popover: {
      title: 'Atalhos',
      description: 'Acesse sua conta pelo avatar e reabra este tour pelo ícone de ?. Dica: use Ctrl+K para busca rápida por endpoint + empresa.',
    },
  },
]

export function TourButton() {
  const pathname = usePathname()
  const startTour = useCallback(async (markSeen = true) => {
    const { driver } = await import('driver.js')

    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      onDestroyed: () => {
        if (markSeen) localStorage.setItem(TOUR_KEY, 'true')
      },
      steps,
    })

    driverObj.drive()
  }, [])

  // Auto-start on first visit, but not over the first-run journey (it shows on the next page).
  useEffect(() => {
    if (typeof window === 'undefined' || pathname.startsWith('/setup')) return
    try { if (localStorage.getItem(TOUR_KEY)) return } catch { return }
    const timer = setTimeout(() => startTour(true), 1200)
    return () => clearTimeout(timer)
  }, [startTour, pathname])

  return (
    <Button variant="ghost" size="icon" onClick={() => startTour(false)} title="Tour da interface">
      <HelpCircle size={16} />
    </Button>
  )
}
