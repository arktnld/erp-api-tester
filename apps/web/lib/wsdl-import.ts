// WSDL 1.1 → endpoint drafts (one per operation), like Bruno's wsdl-to-bruno.
// Runs in the browser: DOMParser reads the XML, so no parser dependency.
// ponytail: one level of nested complexType and no imported schemas (xsd:import); add when a real WSDL needs them.

import type { EndpointDraft } from './openapi-import'

const NS = {
  soap11: 'http://schemas.xmlsoap.org/wsdl/soap/',
  soap12: 'http://schemas.xmlsoap.org/wsdl/soap12/',
}
const MAX_DEPTH = 3

type Parsed = { endpoints: EndpointDraft[]; warnings: string[]; serviceUrl: string | null }

const local = (qname: string | null) => (qname ?? '').split(':').pop() ?? ''
const kids = (el: Element | null | undefined, name: string) => (el ? [...el.children].filter((c) => c.localName === name) : [])
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0]
const all = (root: Document | Element, name: string) => [...root.getElementsByTagNameNS('*', name)]
/** Placeholders only accept \w (see substitute). */
const placeholder = (name: string) => `{${name.replace(/\W/g, '_')}}`

/** Child elements of an XSD element or type, as XML with a {placeholder} per leaf. */
function fields(schemas: Element[], node: Element | undefined, indent: string, depth: number): string {
  if (!node || depth > MAX_DEPTH) return ''
  const typeName = local(node.getAttribute('type'))
  const complex = kid(node, 'complexType') ?? (node.localName === 'complexType' ? node : schemas.flatMap((s) => kids(s, 'complexType')).find((t) => t.getAttribute('name') === typeName))
  if (!complex) return ''
  const group = kid(complex, 'sequence') ?? kid(complex, 'all') ?? kid(complex, 'choice')
  return kids(group, 'element').map((e) => {
    const name = e.getAttribute('name') ?? local(e.getAttribute('ref'))
    const inner = fields(schemas, e, indent + '  ', depth + 1)
    return inner ? `${indent}<${name}>\n${inner}\n${indent}</${name}>` : `${indent}<${name}>${placeholder(name)}</${name}>`
  }).join('\n')
}

function envelope(soap12: boolean, body: string): string {
  const [prefix, ns] = soap12 ? ['soap12', 'http://www.w3.org/2003/05/soap-envelope'] : ['soap', 'http://schemas.xmlsoap.org/soap/envelope/']
  return `<${prefix}:Envelope xmlns:${prefix}="${ns}">\n  <${prefix}:Body>\n${body}\n  </${prefix}:Body>\n</${prefix}:Envelope>`
}

export function parseWsdl(xml: string, parser: DOMParser = new DOMParser()): Parsed {
  const doc = parser.parseFromString(xml, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é XML válido.')
  const defs = doc.documentElement
  if (defs.localName !== 'definitions') {
    throw new Error(defs.localName === 'description' ? 'WSDL 2.0 ainda não é suportado; use a versão 1.1.' : 'Isto não parece um WSDL (falta <definitions>).')
  }
  const warnings: string[] = []
  const schemas = all(doc, 'schema')
  const elements = schemas.flatMap((s) => kids(s, 'element').map((e) => ({ e, ns: s.getAttribute('targetNamespace') ?? '', qualified: s.getAttribute('elementFormDefault') === 'qualified' })))
  const tns = defs.getAttribute('targetNamespace') ?? ''

  // Prefer the SOAP 1.1 binding (widest support); fall back to 1.2.
  const bindings = kids(defs, 'binding')
  const soapBinding = (b: Element, ns: string) => [...b.children].some((c) => c.localName === 'binding' && c.namespaceURI === ns)
  const binding = bindings.find((b) => soapBinding(b, NS.soap11)) ?? bindings.find((b) => soapBinding(b, NS.soap12))
  if (!binding) throw new Error('Nenhum binding SOAP encontrado no WSDL.')
  const soap12 = !soapBinding(binding, NS.soap11)
  const soapNs = soap12 ? NS.soap12 : NS.soap11
  const bindingStyle = [...binding.children].find((c) => c.localName === 'binding' && c.namespaceURI === soapNs)?.getAttribute('style') ?? 'document'

  const portType = kids(defs, 'portType').find((p) => p.getAttribute('name') === local(binding.getAttribute('type')))
  const port = all(defs, 'port').find((p) => local(p.getAttribute('binding')) === binding.getAttribute('name'))
  const serviceUrl = [...(port?.children ?? [])].find((c) => c.localName === 'address')?.getAttribute('location') ?? null
  let path = '/'
  if (serviceUrl) {
    try { const u = new URL(serviceUrl); path = u.pathname + u.search } catch { warnings.push(`Endereço do serviço inválido: ${serviceUrl}`) }
  } else warnings.push('O WSDL não traz o endereço do serviço; ajuste o caminho dos endpoints.')
  const group = kid(defs, 'service')?.getAttribute('name') ?? portType?.getAttribute('name') ?? 'SOAP'

  const endpoints = kids(binding, 'operation').map((op): EndpointDraft => {
    const name = op.getAttribute('name') ?? 'operacao'
    const soapOp = [...op.children].find((c) => c.localName === 'operation' && c.namespaceURI === soapNs)
    const action = soapOp?.getAttribute('soapAction') ?? ''
    const style = soapOp?.getAttribute('style') ?? bindingStyle
    const abstract = kids(portType, 'operation').find((o) => o.getAttribute('name') === name)
    const message = kids(defs, 'message').find((m) => m.getAttribute('name') === local(kid(abstract, 'input')?.getAttribute('message') ?? null))
    const parts = kids(message, 'part')

    let body: string
    if (style === 'rpc') {
      const args = parts.map((p) => `      <${p.getAttribute('name')}>${placeholder(p.getAttribute('name') ?? 'arg')}</${p.getAttribute('name')}>`).join('\n')
      body = `    <tns:${name} xmlns:tns="${tns}">\n${args}\n    </tns:${name}>`
    } else {
      body = parts.map((p) => {
        const ref = local(p.getAttribute('element'))
        const found = elements.find((x) => x.e.getAttribute('name') === ref)
        if (!found) { warnings.push(`${name}: elemento ${ref || '(sem nome)'} não encontrado no schema.`); return `    <${ref || name} />` }
        const inner = fields(schemas, found.e, '      ', 0)
        // qualified: children share the namespace through the default xmlns; unqualified: only the wrapper is prefixed
        const open = found.qualified ? `<${ref} xmlns="${found.ns}">` : `<tns:${ref} xmlns:tns="${found.ns}">`
        const close = found.qualified ? `</${ref}>` : `</tns:${ref}>`
        return inner ? `    ${open}\n${inner}\n    ${close}` : `    ${open}${close}`
      }).join('\n')
    }

    const contentType = soap12 ? `application/soap+xml; charset=utf-8${action ? `; action="${action}"` : ''}` : 'text/xml; charset=utf-8'
    const headers = soap12 ? { 'Content-Type': contentType } : { 'Content-Type': contentType, SOAPAction: `"${action}"` }
    const docText = kid(abstract, 'documentation')?.textContent?.trim() ?? ''
    return {
      name, method: 'POST', pathTemplate: path, bodyTemplate: envelope(soap12, body), headers: JSON.stringify(headers, null, 2),
      group, requiresClient: false, isModification: false, notes: docText || (action ? `SOAPAction: ${action}` : ''),
    }
  })
  if (!endpoints.length) warnings.push('Nenhuma operação encontrada no binding SOAP.')
  return { endpoints, warnings, serviceUrl }
}
