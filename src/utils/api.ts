/**
 * API 工具函数
 * 提供统一的 API 错误解析和请求处理
 */

/**
 * 解析 API 错误响应
 * @param text 响应文本
 * @param status HTTP 状态码
 * @returns Error 对象
 */
export function parseApiError(text: string, status: number): Error {
  try {
    const json = JSON.parse(text)
    if (json?.error?.message) {
      const code = json.error.code ? ` (${json.error.code})` : ''
      return new Error(`API ${status}: ${json.error.message}${code}`)
    }
  } catch {
    // 非 JSON 响应，使用原始文本
  }
  return new Error(`API ${status}: ${text || 'Unknown error'}`)
}

/**
 * 构建 API URL
 * @param baseUrl 基础 URL
 * @param endpoint API 端点
 * @returns 完整的 URL
 */
export function buildApiUrl(baseUrl: string, endpoint: string): string {
  return baseUrl.replace(/\/$/, '') + endpoint
}

/**
 * 通用的 API 请求处理
 * @param response Fetch Response 对象
 * @returns 解析后的响应数据
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw parseApiError(text, response.status)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

/**
 * 处理 AbortError
 * @param error 错误对象
 * @returns 是否为 AbortError
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
