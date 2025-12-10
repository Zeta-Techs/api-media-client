import { ref } from 'vue'
import JSZip from 'jszip'

// 导出格式
export type ExportFormat = 'csv' | 'json' | 'txt' | 'zip'

// 导出配置
export interface ExportConfig {
  /** CSV 分隔符 */
  delimiter: string
  /** 是否包含表头 */
  includeHeader: boolean
  /** JSON 缩进空格数 */
  jsonIndent: number
  /** 文件名前缀 */
  filenamePrefix: string
  /** 是否包含时间戳 */
  includeTimestamp: boolean
}

// 默认导出配置
const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  delimiter: ',',
  includeHeader: true,
  jsonIndent: 2,
  filenamePrefix: 'batch-export',
  includeTimestamp: true
}

// 导出项
export interface ExportItem {
  /** 唯一标识 */
  id: string
  /** 文件名 (用于 ZIP 导出) */
  filename?: string
  /** 数据 (可以是对象、字符串或 Blob) */
  data: Record<string, any> | string | Blob
  /** MIME 类型 */
  mimeType?: string
}

/**
 * 批量导出 composable
 */
export function useBatchExport(initialConfig: Partial<ExportConfig> = {}) {
  const config = ref<ExportConfig>({ ...DEFAULT_EXPORT_CONFIG, ...initialConfig })
  const isExporting = ref(false)
  const lastError = ref<string | null>(null)

  /**
   * 生成文件名
   */
  function generateFilename(extension: string): string {
    let filename = config.value.filenamePrefix
    if (config.value.includeTimestamp) {
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      filename += `-${timestamp}`
    }
    return `${filename}.${extension}`
  }

  /**
   * 转义 CSV 字段
   */
  function escapeCSVField(value: any): string {
    const str = String(value ?? '')
    if (str.includes(config.value.delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  /**
   * 将对象数组转换为 CSV
   */
  function toCSV(items: Record<string, any>[], headers?: string[]): string {
    if (items.length === 0) return ''

    // 获取表头
    const keys = headers || Object.keys(items[0])
    const lines: string[] = []

    // 添加表头
    if (config.value.includeHeader) {
      lines.push(keys.map(k => escapeCSVField(k)).join(config.value.delimiter))
    }

    // 添加数据行
    for (const item of items) {
      const row = keys.map(key => escapeCSVField(item[key]))
      lines.push(row.join(config.value.delimiter))
    }

    return lines.join('\n')
  }

  /**
   * 将对象数组转换为 JSON
   */
  function toJSON(items: any[]): string {
    return JSON.stringify(items, null, config.value.jsonIndent)
  }

  /**
   * 将字符串数组转换为文本
   */
  function toTXT(items: string[]): string {
    return items.join('\n')
  }

  /**
   * 下载文件
   */
  function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * 导出为 CSV
   */
  function exportAsCSV(items: Record<string, any>[], headers?: string[], filename?: string): void {
    const csv = toCSV(items, headers)
    const finalFilename = filename || generateFilename('csv')
    downloadFile(csv, finalFilename, 'text/csv;charset=utf-8')
  }

  /**
   * 导出为 JSON
   */
  function exportAsJSON(items: any[], filename?: string): void {
    const json = toJSON(items)
    const finalFilename = filename || generateFilename('json')
    downloadFile(json, finalFilename, 'application/json;charset=utf-8')
  }

  /**
   * 导出为 TXT
   */
  function exportAsTXT(items: string[], filename?: string): void {
    const txt = toTXT(items)
    const finalFilename = filename || generateFilename('txt')
    downloadFile(txt, finalFilename, 'text/plain;charset=utf-8')
  }

  /**
   * 导出为 ZIP (支持多个文件)
   */
  async function exportAsZIP(items: ExportItem[], filename?: string): Promise<void> {
    isExporting.value = true
    lastError.value = null

    try {
      const zip = new JSZip()

      for (const item of items) {
        const itemFilename = item.filename || `${item.id}`

        if (item.data instanceof Blob) {
          // Blob 数据直接添加
          zip.file(itemFilename, item.data)
        } else if (typeof item.data === 'string') {
          // 字符串数据
          zip.file(itemFilename, item.data)
        } else {
          // 对象数据转为 JSON
          zip.file(itemFilename, JSON.stringify(item.data, null, config.value.jsonIndent))
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const finalFilename = filename || generateFilename('zip')
      downloadFile(blob, finalFilename, 'application/zip')
    } catch (e: any) {
      lastError.value = e.message || 'Failed to create ZIP file'
      throw e
    } finally {
      isExporting.value = false
    }
  }

  /**
   * 批量导出 Blob 文件为 ZIP
   */
  async function exportBlobsAsZIP(
    blobs: Array<{ blob: Blob; filename: string }>,
    zipFilename?: string
  ): Promise<void> {
    const items: ExportItem[] = blobs.map((b, idx) => ({
      id: `file-${idx}`,
      filename: b.filename,
      data: b.blob
    }))
    await exportAsZIP(items, zipFilename)
  }

  /**
   * 从 URL 下载并打包为 ZIP
   */
  async function exportUrlsAsZIP(
    urls: Array<{ url: string; filename: string }>,
    zipFilename?: string
  ): Promise<void> {
    isExporting.value = true
    lastError.value = null

    try {
      const zip = new JSZip()

      for (const item of urls) {
        const response = await fetch(item.url)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${item.url}: ${response.status}`)
        }
        const blob = await response.blob()
        zip.file(item.filename, blob)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const finalFilename = zipFilename || generateFilename('zip')
      downloadFile(blob, finalFilename, 'application/zip')
    } catch (e: any) {
      lastError.value = e.message || 'Failed to download and create ZIP'
      throw e
    } finally {
      isExporting.value = false
    }
  }

  /**
   * 导出批量任务结果
   */
  function exportTaskResults<T extends Record<string, any>>(
    tasks: Array<{
      id: string
      status: string
      input: any
      result?: T
      error?: string
    }>,
    format: 'csv' | 'json' = 'json',
    filename?: string
  ): void {
    const exportData = tasks.map(task => ({
      id: task.id,
      status: task.status,
      input: typeof task.input === 'string' ? task.input : JSON.stringify(task.input),
      result: task.result ? JSON.stringify(task.result) : '',
      error: task.error || ''
    }))

    if (format === 'csv') {
      exportAsCSV(exportData, ['id', 'status', 'input', 'result', 'error'], filename)
    } else {
      exportAsJSON(tasks, filename)
    }
  }

  /**
   * 更新配置
   */
  function updateConfig(newConfig: Partial<ExportConfig>): void {
    config.value = { ...config.value, ...newConfig }
  }

  return {
    config,
    isExporting,
    lastError,
    generateFilename,
    toCSV,
    toJSON,
    toTXT,
    downloadFile,
    exportAsCSV,
    exportAsJSON,
    exportAsTXT,
    exportAsZIP,
    exportBlobsAsZIP,
    exportUrlsAsZIP,
    exportTaskResults,
    updateConfig
  }
}
