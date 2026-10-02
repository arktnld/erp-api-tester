'use client'

import { useEffect, useRef, useState } from 'react'
import { Layers, Building2, Users, Zap, Terminal, History, Info, Lightbulb, AlertTriangle, Link2, LucideIcon } from 'lucide-react'

const sections: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'intro',    label: 'O que é',           icon: Info },
  { id: 'estrutura',label: 'Estrutura',          icon: Layers },
  { id: 'erp',      label: 'Configurar ERP',     icon: Zap },
  { id: 'empresa',  label: 'Empresas',           icon: Building2 },
  { id: 'cliente',  label: 'Clientes de teste',  icon: Users },
  { id: 'testar',   label: 'Testar endpoints',   icon: Terminal },
  { id: 'curl',     label: 'Importar curl',      icon: Terminal },
  { id: 'historico',label: 'Histórico',          icon: History },
]

const SECTION_ICONS: Record<string, LucideIcon> = Object.fromEntries(sections.map(s => [s.id, s.icon]))

function FadeSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.04 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(18px)',
      transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

function Callout({ type, children }: { type: 'tip' | 'warn' | 'info'; children: React.ReactNode }) {
  const cfg = {
    tip:  { bg: 'color-mix(in srgb, var(--status-success) 7%, transparent)',  border: 'color-mix(in srgb, var(--status-success) 25%, transparent)',  icon: Lightbulb,     label: 'Dica',    color: 'var(--status-success)' },
    warn: { bg: 'color-mix(in srgb, var(--status-warning) 7%, transparent)', border: 'color-mix(in srgb, var(--status-warning) 25%, transparent)', icon: AlertTriangle, label: 'Atenção', color: 'var(--status-warning)' },
    info: { bg: 'color-mix(in srgb, var(--accent) 7%, transparent)', border: 'color-mix(in srgb, var(--accent) 25%, transparent)', icon: Info,          label: 'Nota',    color: 'var(--accent)' },
  }[type]
  const Icon = cfg.icon
  return (
    <div style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '14px 16px', margin: '24px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: `color-mix(in srgb, ${cfg.color} 13%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Icon size={14} color={cfg.color} />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: cfg.color, margin: '0 0 4px' }}>{cfg.label}</p>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-muted)', margin: 0 }}>{children}</p>
      </div>
    </div>
  )
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ margin: '20px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}
    >
      <div style={{ backgroundColor: 'var(--surface-2)', padding: '6px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />)}
      </div>
      <pre style={{ backgroundColor: 'var(--surface)', padding: '16px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, overflowX: 'auto', margin: 0, color: 'var(--text)' }}>
        {children}
      </pre>
      <button
        onClick={copy}
        style={{
          position: 'absolute', top: 40, right: 12,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s, color 0.15s',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          color: copied ? 'var(--status-success)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontFamily: 'monospace',
          letterSpacing: '0.02em',
        }}
      >
        {copied ? 'Copiado ✓' : 'Copiar'}
      </button>
    </div>
  )
}

function Inline({ children }: { children: string }) {
  return <code style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)' }}>{children}</code>
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  const Icon = SECTION_ICONS[id]
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyAnchor = () => {
    navigator.clipboard.writeText(window.location.href.split('#')[0] + '#' + id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div id={id} style={{ marginTop: 56, marginBottom: 16, scrollMarginTop: 24 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}
      >
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, transparent), rgba(168,85,247,0.15))', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} color="var(--accent)" />
          </div>
        )}
        <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{children}</h2>
        <button
          onClick={copyAnchor}
          title="Copiar link da seção"
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px 4px', borderRadius: 4,
            color: copied ? 'var(--status-success)' : 'var(--text-subtle)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <Link2 size={13} />
        </button>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, var(--border), transparent)' }} />
    </div>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 28, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 400 }}>{children}</p>
}

function HoverCard({ title, desc }: { title: string; desc: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: '14px 18px', backgroundColor: hovered ? 'var(--surface-2)' : 'var(--surface)', border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, transition: 'all 0.18s', cursor: 'default', transform: hovered ? 'translateY(-1px)' : 'none', boxShadow: hovered ? '0 4px 16px color-mix(in srgb, var(--accent) 10%, transparent)' : 'none' }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 5px' }}>{title}</p>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-muted)', margin: 0 }}>{desc}</p>
    </div>
  )
}

export default function DocsPage() {
  const [active, setActive] = useState('intro')
  const indicatorRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -75% 0px' }
    )
    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!navRef.current || !indicatorRef.current) return
    const idx = sections.findIndex(s => s.id === active)
    const items = navRef.current.querySelectorAll('a')
    const target = items[idx] as HTMLElement
    if (target) {
      indicatorRef.current.style.top = `${target.offsetTop}px`
      indicatorRef.current.style.height = `${target.offsetHeight}px`
    }
  }, [active])

  return (
    <div style={{ display: 'flex', padding: '44px 40px 100px', gap: 56, maxWidth: 1080, margin: '0 auto' }}>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Hero */}
          <FadeSection>
            <div style={{ marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>Documentação</p>
              <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, marginBottom: 16, whiteSpace: 'nowrap', background: 'linear-gradient(135deg, var(--text) 40%, var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Como usar o ERP Tester
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-muted)', maxWidth: 520 }}>
                Tudo que você precisa para configurar ERPs, testar endpoints, importar coleções Postman e OpenAPI — sem sair da sua rede.
              </p>
            </div>
          </FadeSection>

          {/* Intro */}
          <FadeSection delay={50}>
            <H2 id="intro">O que é o ERP Tester</H2>
            <P>
              O ERP Tester é uma ferramenta de teste de APIs feita para equipes que trabalham com sistemas ERP. Em vez de Postman com configurações espalhadas por diferentes máquinas, o ERP Tester centraliza tudo em um único lugar: endpoints cadastrados, credenciais por empresa, histórico de chamadas. Qualquer pessoa do time consegue executar uma requisição em segundos.
            </P>
          </FadeSection>

          {/* Estrutura */}
          <FadeSection>
            <H2 id="estrutura">Como está organizado</H2>
            <P>
              O ERP Tester organiza tudo em quatro camadas. Entender essa hierarquia é o primeiro passo antes de começar.
            </P>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '20px 0 24px' }}>
              {[
                { label: 'ERP', desc: 'O sistema de gestão (SAP, TOTVS, Omie, uma API interna…). Define os campos obrigatórios e os endpoints disponíveis para todas as empresas.' },
                { label: 'Empresa', desc: 'Um cliente que usa aquele ERP. Tem seu próprio endereço de API e tipo de autenticação.' },
                { label: 'Cliente de teste', desc: 'Um conjunto de credenciais dentro de uma empresa. Útil para testar com múltiplas contas.' },
                { label: 'Endpoint', desc: 'Uma rota da API com método, path e body. Usa {{campo}} para referenciar dados do cliente.' },
              ].map(row => <HoverCard key={row.label} title={row.label} desc={row.desc} />)}
            </div>
            <P>
              O fluxo natural é: crie o ERP → adicione a empresa → crie os clientes de teste → cadastre os endpoints. Depois disso, testar é imediato.
            </P>
          </FadeSection>

          {/* ERP */}
          <FadeSection>
            <H2 id="erp">Configurando um ERP</H2>
            <P>
              Vá em <strong>ERPs</strong> na sidebar e clique em criar. O ERP é o molde que todas as empresas seguirão — defina aqui os campos e endpoints que serão compartilhados por todos os clientes desse sistema.
            </P>
            <H3>Campos personalizados</H3>
            <P>
              Campos são os dados que cada empresa precisa fornecer para se comunicar com a API: token de autenticação, ID de conta, chave de contrato. Marque como <strong>obrigatório</strong> os campos sem os quais a chamada não funciona.
            </P>
            <H3>Templates de path e body</H3>
            <P>
              Use <Inline>{'{{nome_do_campo}}'}</Inline> em qualquer parte do path ou body para referenciar os valores do cliente de teste. O ERP Tester substitui automaticamente na hora de executar.
            </P>
            <Code>{`# Template de path
/api/v1/clientes/{{empresa_id}}/pedidos

# Template de body
{
  "token": "{{token_api}}",
  "limit": 50,
  "offset": 0
}`}</Code>
            <Callout type="tip">
              Use nomes de campos descritivos e consistentes entre os endpoints do mesmo ERP. Isso facilita muito quando a coleção cresce para centenas de rotas.
            </Callout>
          </FadeSection>

          {/* Empresa */}
          <FadeSection>
            <H2 id="empresa">Adicionando uma Empresa</H2>
            <P>
              Com o ERP criado, vá em <strong>Empresas</strong> e adicione uma nova vinculada a ele. Cada empresa tem sua própria base URL — o endereço raiz da API daquele cliente — e um tipo de autenticação.
            </P>
            <H3>Tipos de autenticação</H3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 8px' }}>
              {[
                { t: 'Nenhuma', d: 'A API não exige autenticação no header. As credenciais podem estar nos campos do cliente como parâmetro na URL.' },
                { t: 'Basic Auth', d: 'Login e senha enviados via Authorization no formato Base64. O ERP Tester gera o header automaticamente.' },
                { t: 'Bearer Token', d: 'Token fixo ou dinâmico no header Authorization. Use {{campo}} para que cada empresa tenha o seu próprio token.' },
              ].map(({ t, d }) => <HoverCard key={t} title={t} desc={d} />)}
            </div>
          </FadeSection>

          {/* Cliente */}
          <FadeSection>
            <H2 id="cliente">Clientes de teste</H2>
            <P>
              Dentro de uma empresa, crie um ou mais clientes de teste. Cada cliente preenche os campos definidos no ERP com valores reais — o token de acesso, o ID da conta, o ambiente (produção ou homologação).
            </P>
            <P>
              Ter múltiplos clientes é útil quando você precisa testar com diferentes contas sem trocar credenciais manualmente. Crie um para produção, outro para staging, outro para o QA — e alterne em um clique.
            </P>
            <Callout type="warn">
              Clientes apontando para produção ficam disponíveis para toda a equipe. Deixe isso claro no nome: <em>Empresa X — PRODUÇÃO</em>.
            </Callout>
          </FadeSection>

          {/* Testar */}
          <FadeSection>
            <H2 id="testar">Testando endpoints</H2>
            <P>
              Vá em <strong>Testar API</strong>, selecione empresa, cliente e endpoint. O ERP Tester monta a requisição completa: substitui os templates, aplica a autenticação e executa. O resultado aparece com status, tempo de resposta, headers e body formatado.
            </P>
            <H3>Modo Form vs Raw</H3>
            <P>
              Por padrão o body vem do template com os campos substituídos. Se precisar de um payload diferente sem alterar o endpoint cadastrado, ative o toggle <strong>Raw</strong> e escreva manualmente. Útil para reproduzir um bug específico ou testar um edge case pontual.
            </P>
            <H3>Comando curl gerado</H3>
            <P>
              O curl equivalente é gerado automaticamente e pode ser copiado com um clique — útil para compartilhar chamadas com o time ou usar fora do ERP Tester.
            </P>
          </FadeSection>

          {/* Curl */}
          <FadeSection>
            <H2 id="curl">Importar via curl</H2>
            <P>
              Recebeu um curl de um colega? Achou um exemplo na documentação do ERP? Na <strong>Home</strong>, clique em <strong>Importar</strong>, cole o curl e clique em Analisar. O ERP Tester extrai automaticamente o método, a URL (separando base URL do path), headers e body. Você só precisa dar um nome e escolher o ERP.
            </P>
            <Callout type="info">
              Headers de Authorization e Content-Type são ignorados — eles já são gerenciados pela configuração de autenticação da empresa.
            </Callout>
          </FadeSection>

          {/* Histórico */}
          <FadeSection>
            <H2 id="historico">Histórico</H2>
            <P>
              Toda requisição executada no Testar API é salva automaticamente. Em <strong>Histórico</strong> você vê o registro completo: método, status, tempo de resposta, empresa, cliente e o body de request e response.
            </P>
            <P>
              Na Home, as 10 últimas requisições aparecem com um botão <strong>Repetir</strong> que redireciona direto para o Testar API com empresa, cliente e endpoint já selecionados.
            </P>
          </FadeSection>

        </div>

        {/* ── TOC ── */}
        <div style={{ width: 172, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', marginBottom: 10 }}>Nesta página</p>
            <div style={{ position: 'relative' }} ref={navRef}>
              {/* sliding indicator */}
              <div
                ref={indicatorRef}
                style={{ position: 'absolute', left: 0, width: 2, borderRadius: 2, backgroundColor: 'var(--accent)', transition: 'top 0.2s ease, height 0.2s ease', top: 0, height: 28 }}
              />
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 10 }}>
                {sections.map(s => {
                  const Icon = s.icon
                  const isActive = active === s.id
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      style={{ fontSize: 12, lineHeight: 1.5, padding: '6px 8px', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, color: isActive ? 'var(--accent)' : 'var(--text-subtle)', fontWeight: isActive ? 600 : 400, transition: 'color 0.15s' }}
                    >
                      <Icon size={11} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                      {s.label}
                    </a>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

      </div>
  )
}
