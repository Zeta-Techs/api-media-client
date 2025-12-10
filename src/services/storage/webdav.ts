import type { WebDAVConfig } from '@/stores/storage'

export interface UploadOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export interface UploadResult {
  success: boolean
  url: string
  path: string
  error?: string
}

/**
 * WebDAV 存储服务
 */
export class WebDAVService {
  private config: WebDAVConfig

  constructor(config: WebDAVConfig) {
    this.config = config
  }

  /**
   * 生成 Basic Auth 头
   */
  private getAuthHeader(): string {
    const credentials = btoa(`${this.config.username}:${this.config.password}`)
    return `Basic ${credentials}`
  }

  /**
   * 规范化路径
   */
  private normalizePath(path: string): string {
    // 确保路径以 / 开头，不以 / 结尾
    let normalized = path.startsWith('/') ? path : `/${path}`
    normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
    return normalized
  }

  /**
   * 构建完整 URL
   */
  private buildUrl(filename: string): string {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const basePath = this.normalizePath(this.config.basePath)
    const fullPath = `${basePath}/${filename}`.replace(/\/+/g, '/')
    return `${endpoint}${fullPath}`
  }

  /**
   * 确保目录存在（递归创建）
   */
  async ensureDirectory(path: string): Promise<void> {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const basePath = this.normalizePath(this.config.basePath)

    // 获取路径中的目录部分
    const dirPath = path.split('/').slice(0, -1).join('/')
    if (!dirPath) return

    const fullDirPath = `${basePath}/${dirPath}`.replace(/\/+/g, '/')
    const parts = fullDirPath.split('/').filter(Boolean)

    let currentPath = ''
    for (const part of parts) {
      currentPath += `/${part}`
      const url = `${endpoint}${currentPath}/`

      try {
        // 尝试创建目录（MKCOL）
        const response = await fetch(url, {
          method: 'MKCOL',
          headers: {
            'Authorization': this.getAuthHeader()
          }
        })

        // 201 = 创建成功，405 = 已存在（方法不允许），这些都是可接受的
        if (!response.ok && response.status !== 405 && response.status !== 301) {
          // 某些 WebDAV 服务器对已存在的目录返回其他状态码
          const text = await response.text()
          if (!text.includes('already exists') && response.status !== 409) {
            console.warn(`Failed to create directory ${currentPath}: ${response.status}`)
          }
        }
      } catch (e) {
        // 忽略目录创建错误，继续尝试
        console.warn(`Directory creation warning for ${currentPath}:`, e)
      }
    }
  }

  /**
   * 上传文件
   */
  async upload(
    blob: Blob,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const { onProgress, signal } = options

    try {
      // 确保目录存在
      await this.ensureDirectory(filename)

      const url = this.buildUrl(filename)

      // 使用 XMLHttpRequest 以支持上传进度
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // 进度监听
        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              onProgress(progress)
            }
          }
        }

        // 完成处理
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              success: true,
              url,
              path: filename
            })
          } else {
            resolve({
              success: false,
              url,
              path: filename,
              error: `Upload failed: ${xhr.status} ${xhr.statusText}`
            })
          }
        }

        // 错误处理
        xhr.onerror = () => {
          resolve({
            success: false,
            url,
            path: filename,
            error: 'Network error during upload'
          })
        }

        // 中止处理
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort()
            reject(new DOMException('Upload aborted', 'AbortError'))
          })
        }

        // 发送请求
        xhr.open('PUT', url, true)
        xhr.setRequestHeader('Authorization', this.getAuthHeader())
        xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
        xhr.send(blob)
      })
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw e
      }
      return {
        success: false,
        url: this.buildUrl(filename),
        path: filename,
        error: e.message || 'Upload failed'
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = this.config.endpoint.replace(/\/$/, '')
      const basePath = this.normalizePath(this.config.basePath)
      const url = `${endpoint}${basePath}/`

      // 使用 PROPFIND 检测目录是否可访问
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Depth': '0'
        }
      })

      if (response.ok || response.status === 207) {
        return { success: true, message: 'Connection successful' }
      }

      // 如果目录不存在，尝试创建
      if (response.status === 404) {
        await this.ensureDirectory('test-connection')
        return { success: true, message: 'Connection successful (directory created)' }
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
   * 删除文件
   */
  async delete(filename: string): Promise<boolean> {
    try {
      const url = this.buildUrl(filename)
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      })
      return response.ok || response.status === 204
    } catch {
      return false
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(filename: string): Promise<boolean> {
    try {
      const url = this.buildUrl(filename)
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * 创建 WebDAV 服务实例
 */
export function createWebDAVService(config: WebDAVConfig): WebDAVService {
  return new WebDAVService(config)
}
