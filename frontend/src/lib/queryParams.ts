type ParamValue = string | number | boolean | undefined

export function buildParams(params: object): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params as Record<string, ParamValue>)) {
    if (value !== undefined && value !== '') out[key] = String(value)
  }
  return out
}
