// GraphQL over HTTP is a JSON body {query, variables}; the editors show the two parts separately, like Bruno.

export type GraphqlParts = { query: string; variables: string }

/** The query and variables of a GraphQL body, or null when the body is not one. */
export function parseGraphqlBody(body: string): GraphqlParts | null {
  try {
    const doc = JSON.parse(body)
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || typeof doc.query !== 'string') return null
    const vars = doc.variables
    return { query: doc.query, variables: vars == null || (typeof vars === 'object' && !Object.keys(vars).length) ? '' : JSON.stringify(vars, null, 2) }
  } catch {
    return null
  }
}

/** The JSON body for a query and its variables; an error when the variables are not a JSON object. */
export function buildGraphqlBody(query: string, variables: string): { body: string } | { error: string } {
  let vars: unknown = undefined
  if (variables.trim()) {
    try { vars = JSON.parse(variables) } catch { return { error: 'Variables não é um JSON válido.' } }
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return { error: 'Variables precisa ser um objeto JSON, por exemplo {"id": 1}.' }
  }
  return { body: JSON.stringify(vars ? { query, variables: vars } : { query }, null, 2) }
}
