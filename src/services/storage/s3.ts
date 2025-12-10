import type { S3Config } from '@/stores/storage'

export interface UploadOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  contentType?: string
}

export interface UploadResult {
  success: boolean
  url: string
  path: string
  error?: string
}

/**
 * AWS Signature V4 签名工具
 * 适用于浏览器环境
 */
class AWSV4Signer {
  private accessKeyId: string
  private secretAccessKey: string
  private region: string
  private service: string

  constructor(accessKeyId: string, secretAccessKey: string, region: string, service = 's3') {
    this.accessKeyId = accessKeyId
    this.secretAccessKey = secretAccessKey
    this.region = region
    this.service = service
  }

  /**
   * 将 ArrayBuffer 转换为十六进制字符串
   */
  private toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * SHA256 哈希
   */
  private async sha256(message: string | ArrayBuffer): Promise<ArrayBuffer> {
    const data = typeof message === 'string'
      ? new TextEncoder().encode(message)
      : message
    return crypto.subtle.digest('SHA-256', data)
  }

  /**
   * HMAC-SHA256
   */
  private async hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    let keyBuffer: ArrayBuffer
    if (key instanceof Uint8Array) {
      // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
      keyBuffer = new ArrayBuffer(key.byteLength)
      new Uint8Array(keyBuffer).set(key)
    } else {
      keyBuffer = key
    }
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  }

  /**
   * 获取签名密钥
   */
  private async getSignatureKey(dateStamp: string): Promise<ArrayBuffer> {
    const kDate = await this.hmacSha256(
      new TextEncoder().encode(`AWS4${this.secretAccessKey}`),
      dateStamp
    )
    const kRegion = await this.hmacSha256(kDate, this.region)
    const kService = await this.hmacSha256(kRegion, this.service)
    return this.hmacSha256(kService, 'aws4_request')
  }

  /**
   * URI 编码（符合 AWS 规范）
   */
  private uriEncode(str: string, encodeSlash = true): string {
    let encoded = ''
    for (const char of str) {
      if (
        (char >= 'A' && char <= 'Z') ||
        (char >= 'a' && char <= 'z') ||
        (char >= '0' && char <= '9') ||
        char === '_' || char === '-' || char === '~' || char === '.'
      ) {
        encoded += char
      } else if (char === '/' && !encodeSlash) {
        encoded += char
      } else {
        encoded += '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
      }
    }
    return encoded
  }

  /**
   * 签名请求
   */
  async sign(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload: ArrayBuffer | string = ''
  ): Promise<Record<string, string>> {
    const parsedUrl = new URL(url)
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)

    // 计算 payload 哈希
    const payloadHash = this.toHex(
      await this.sha256(typeof payload === 'string' ? payload : payload)
    )

    // 构建签名头
    const signedHeaders: Record<string, string> = {
      ...headers,
      'host': parsedUrl.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash
    }

    // 获取排序后的头名称
    const headerNames = Object.keys(signedHeaders).sort()
    const signedHeadersStr = headerNames.join(';')

    // 构建规范请求
    const canonicalHeaders = headerNames
      .map(name => `${name.toLowerCase()}:${signedHeaders[name].trim()}`)
      .join('\n')

    const canonicalUri = this.uriEncode(parsedUrl.pathname, false)
    const canonicalQueryString = parsedUrl.search.slice(1)
      .split('&')
      .filter(Boolean)
      .sort()
      .join('&')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders + '\n',
      signedHeadersStr,
      payloadHash
    ].join('\n')

    // 构建签名字符串
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`
    const canonicalRequestHash = this.toHex(await this.sha256(canonicalRequest))
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n')

    // 计算签名
    const signingKey = await this.getSignatureKey(dateStamp)
    const signature = this.toHex(await this.hmacSha256(signingKey, stringToSign))

    // 构建 Authorization 头
    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeadersStr}`,
      `Signature=${signature}`
    ].join(', ')

    return {
      ...signedHeaders,
      'Authorization': authorization
    }
  }
}

/**
 * S3 存储服务
 */
export class S3Service {
  private config: S3Config
  private signer: AWSV4Signer

  constructor(config: S3Config) {
    this.config = config
    this.signer = new AWSV4Signer(
      config.accessKeyId,
      config.secretAccessKey,
      config.region
    )
  }

  /**
   * 构建对象 URL
   */
  private buildUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/$/, '')

    if (this.config.forcePathStyle) {
      // Path-style: https://endpoint/bucket/key
      return `${endpoint}/${this.config.bucket}/${key}`
    } else {
      // Virtual-hosted-style: https://bucket.endpoint/key
      const url = new URL(endpoint)
      url.hostname = `${this.config.bucket}.${url.hostname}`
      return `${url.origin}/${key}`
    }
  }

  /**
   * 获取公开访问 URL
   */
  getPublicUrl(key: string): string {
    if (this.config.publicUrl) {
      const publicUrl = this.config.publicUrl.replace(/\/$/, '')
      return `${publicUrl}/${key}`
    }
    return this.buildUrl(key)
  }

  /**
   * 构建完整的对象 key
   */
  private buildKey(filename: string): string {
    const prefix = this.config.pathPrefix?.replace(/^\/|\/$/g, '') || ''
    return prefix ? `${prefix}/${filename}` : filename
  }

  /**
   * 上传文件
   */
  async upload(
    blob: Blob,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const { onProgress, signal, contentType } = options

    const key = this.buildKey(filename)
    const url = this.buildUrl(key)

    try {
      // 读取 blob 为 ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer()

      // 签名请求
      const headers = await this.signer.sign(
        'PUT',
        url,
        {
          'Content-Type': contentType || blob.type || 'application/octet-stream',
          'Content-Length': blob.size.toString()
        },
        arrayBuffer
      )

      // 使用 XMLHttpRequest 以支持进度
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              onProgress(progress)
            }
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              success: true,
              url: this.getPublicUrl(key),
              path: key
            })
          } else {
            resolve({
              success: false,
              url: this.getPublicUrl(key),
              path: key,
              error: `Upload failed: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`
            })
          }
        }

        xhr.onerror = () => {
          resolve({
            success: false,
            url: this.getPublicUrl(key),
            path: key,
            error: 'Network error during upload'
          })
        }

        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort()
            reject(new DOMException('Upload aborted', 'AbortError'))
          })
        }

        xhr.open('PUT', url, true)

        // 设置签名后的头
        for (const [name, value] of Object.entries(headers)) {
          // 跳过 host 头（浏览器会自动设置）
          if (name.toLowerCase() !== 'host') {
            xhr.setRequestHeader(name, value)
          }
        }

        xhr.send(blob)
      })
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw e
      }
      return {
        success: false,
        url: this.getPublicUrl(key),
        path: key,
        error: e.message || 'Upload failed'
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // 使用 HEAD 请求检查 bucket 是否可访问
      const url = this.config.forcePathStyle
        ? `${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}`
        : (() => {
            const parsed = new URL(this.config.endpoint)
            parsed.hostname = `${this.config.bucket}.${parsed.hostname}`
            return parsed.origin
          })()

      const headers = await this.signer.sign('HEAD', url + '/', {})

      const response = await fetch(url + '/', {
        method: 'HEAD',
        headers: Object.fromEntries(
          Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'host')
        )
      })

      if (response.ok || response.status === 200) {
        return { success: true, message: 'Connection successful' }
      }

      // 某些 S3 兼容服务对 HEAD bucket 返回 403 但仍然可以上传
      if (response.status === 403) {
        return { success: true, message: 'Connection likely successful (403 on HEAD)' }
      }

      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`
      }
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Connection failed'
      }
    }
  }

  /**
   * 删除对象
   */
  async delete(filename: string): Promise<boolean> {
    try {
      const key = this.buildKey(filename)
      const url = this.buildUrl(key)
      const headers = await this.signer.sign('DELETE', url, {})

      const response = await fetch(url, {
        method: 'DELETE',
        headers: Object.fromEntries(
          Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'host')
        )
      })

      return response.ok || response.status === 204
    } catch {
      return false
    }
  }

  /**
   * 检查对象是否存在
   */
  async exists(filename: string): Promise<boolean> {
    try {
      const key = this.buildKey(filename)
      const url = this.buildUrl(key)
      const headers = await this.signer.sign('HEAD', url, {})

      const response = await fetch(url, {
        method: 'HEAD',
        headers: Object.fromEntries(
          Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'host')
        )
      })

      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * 创建 S3 服务实例
 */
export function createS3Service(config: S3Config): S3Service {
  return new S3Service(config)
}
