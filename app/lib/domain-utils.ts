const MAX_DNS_LABEL_LENGTH = 63
const MAX_DOMAIN_LENGTH = 253
const MAX_SUBDOMAIN_PREFIX_LEVELS = 5
const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export interface SubdomainPrefixValidationSuccess {
  success: true
  value: string
  fullDomain: string
}

export interface SubdomainPrefixValidationFailure {
  success: false
  error: string
}

export type SubdomainPrefixValidationResult =
  | SubdomainPrefixValidationSuccess
  | SubdomainPrefixValidationFailure

export function normalizeDomainName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "")
}

export function normalizeSubdomainPrefix(value: string): string {
  return value.trim().toLowerCase()
}

export function validateSubdomainPrefix(
  value: unknown,
  rootDomain?: string
): SubdomainPrefixValidationResult {
  if (typeof value !== "string") {
    return { success: false, error: "子域名前缀不能为空" }
  }

  const normalized = normalizeSubdomainPrefix(value)
  if (!normalized) {
    return { success: false, error: "子域名前缀不能为空" }
  }

  const normalizedRootDomain = rootDomain ? normalizeDomainName(rootDomain) : ""
  if (
    normalizedRootDomain &&
    (normalized === normalizedRootDomain || normalized.endsWith(`.${normalizedRootDomain}`))
  ) {
    return {
      success: false,
      error: "请只输入相对根域名的子域名前缀，不要包含完整域名",
    }
  }

  if (normalized.startsWith(".") || normalized.endsWith(".")) {
    return { success: false, error: "子域名前缀不能以点开头或结尾" }
  }

  if (normalized.includes("..")) {
    return { success: false, error: "子域名前缀不能包含连续的点" }
  }

  const labels = normalized.split(".")
  if (labels.length > MAX_SUBDOMAIN_PREFIX_LEVELS) {
    return {
      success: false,
      error: `子域名前缀最多支持 ${MAX_SUBDOMAIN_PREFIX_LEVELS} 级`,
    }
  }

  for (const label of labels) {
    if (label.length > MAX_DNS_LABEL_LENGTH) {
      return { success: false, error: "子域名前缀每段长度不能超过 63 个字符" }
    }

    if (!DNS_LABEL_PATTERN.test(label)) {
      return {
        success: false,
        error: "子域名前缀每段只允许字母、数字和连字符，且不能以连字符开头或结尾",
      }
    }
  }

  const fullDomain = normalizedRootDomain
    ? `${normalized}.${normalizedRootDomain}`
    : normalized

  if (fullDomain.length > MAX_DOMAIN_LENGTH) {
    return { success: false, error: "完整域名长度不能超过 253 个字符" }
  }

  return {
    success: true,
    value: normalized,
    fullDomain,
  }
}

export function buildFullDomain(subdomain: string, rootDomain: string): string {
  const validation = validateSubdomainPrefix(subdomain, rootDomain)
  if (!validation.success) {
    throw new Error(validation.error)
  }
  return validation.fullDomain
}
