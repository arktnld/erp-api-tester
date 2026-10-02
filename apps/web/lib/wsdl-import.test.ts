// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseWsdl } from './wsdl-import'

const calculator = readFileSync(join(__dirname, '__fixtures__/calculator.wsdl'), 'utf8')

describe('parseWsdl', () => {
  it('turns each SOAP 1.1 operation into a ready request (document/literal)', () => {
    const { endpoints, serviceUrl, warnings } = parseWsdl(calculator)
    expect(warnings).toEqual([])
    expect(serviceUrl).toBe('http://www.dneonline.com/calculator.asmx')
    expect(endpoints.map((e) => e.name)).toEqual(['Add', 'Subtract', 'Multiply', 'Divide'])
    const add = endpoints[0]
    expect(add).toMatchObject({ method: 'POST', pathTemplate: '/calculator.asmx', group: 'Calculator', requiresClient: false })
    expect(JSON.parse(add.headers)).toEqual({ 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/Add"' })
    expect(add.bodyTemplate).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">')
    expect(add.bodyTemplate).toContain('<Add xmlns="http://tempuri.org/">')
    expect(add.bodyTemplate).toContain('<intA>{intA}</intA>')
    expect(add.bodyTemplate).toContain('<intB>{intB}</intB>')
  })

  it('builds rpc-style bodies from the message parts and uses SOAP 1.2 when it is the only binding', () => {
    const rpc = `<?xml version="1.0"?>
      <definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:tns="urn:hello" targetNamespace="urn:hello">
        <message name="SayHelloRequest"><part name="firstName" type="xsd:string"/></message>
        <portType name="HelloPort"><operation name="SayHello"><input message="tns:SayHelloRequest"/></operation></portType>
        <binding name="HelloBinding" type="tns:HelloPort">
          <soap12:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
          <operation name="SayHello"><soap12:operation soapAction="urn:sayHello"/></operation>
        </binding>
        <service name="HelloService"><port name="HelloPort" binding="tns:HelloBinding"><soap12:address location="https://api.example.com/ws/hello?x=1"/></port></service>
      </definitions>`
    const [op] = parseWsdl(rpc).endpoints
    expect(op.pathTemplate).toBe('/ws/hello?x=1')
    expect(JSON.parse(op.headers)).toEqual({ 'Content-Type': 'application/soap+xml; charset=utf-8; action="urn:sayHello"' })
    expect(op.bodyTemplate).toContain('<soap12:Envelope')
    expect(op.bodyTemplate).toContain('<tns:SayHello xmlns:tns="urn:hello">')
    expect(op.bodyTemplate).toContain('<firstName>{firstName}</firstName>')
  })

  it('explains what is wrong with a file that is not a WSDL 1.1', () => {
    expect(() => parseWsdl('<html><body/></html>')).toThrow('não parece um WSDL')
    expect(() => parseWsdl('<description xmlns="http://www.w3.org/ns/wsdl"/>')).toThrow('WSDL 2.0')
    expect(() => parseWsdl('<<nope')).toThrow('XML válido')
  })
})
