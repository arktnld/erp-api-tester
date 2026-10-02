import { describe, it, expect } from 'vitest'
import { editorLanguageOf, guessContentType, modeOf, withContentType } from './body-mode'

describe('body modes', () => {
  it('guesses the Content-Type of a body sent without one', () => {
    expect(guessContentType(' {"a":1}')).toBe('application/json')
    expect(guessContentType('[1]')).toBe('application/json')
    expect(guessContentType('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"/>')).toMatch(/^text\/xml/)
    expect(guessContentType('<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"/>')).toMatch(/^application\/soap\+xml/)
    expect(guessContentType('grant_type=password&username={user}')).toBe('application/x-www-form-urlencoded')
    expect(guessContentType('hello world')).toMatch(/^text\/plain/)
  })

  it('maps a Content-Type to its mode and editor language', () => {
    expect(modeOf('')).toBe('json')
    expect(modeOf('application/vnd.api+json')).toBe('json')
    expect(modeOf('application/soap+xml; charset=utf-8')).toBe('soap12')
    expect(modeOf('TEXT/XML')).toBe('xml')
    expect(modeOf('application/x-www-form-urlencoded')).toBe('form')
    expect(modeOf('application/octet-stream')).toBe('other')
    expect(editorLanguageOf('text/xml')).toBe('xml')
    expect(editorLanguageOf('text/plain')).toBe('text')
  })

  it('replaces the Content-Type whatever the case of the old key, keeping the rest', () => {
    const h = { 'content-type': 'application/json', SOAPAction: 'urn:Add' }
    expect(withContentType(h, 'text/xml')).toEqual({ 'Content-Type': 'text/xml', SOAPAction: 'urn:Add' })
    expect(h['content-type']).toBe('application/json')
  })
})
