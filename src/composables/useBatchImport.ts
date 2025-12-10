import { ref } from 'vue'

// 导入的行数据
export interface ImportedRow {
  /** 行号 (从 1 开始) */
  lineNumber: number
  /** 原始文本 */
  raw: string
  /** 解析后的字段 */
  fields: string[]
  /** 解析后的对象 (如果有表头) */
  data?: Record<string, string>
}

// 导入配置
export interface ImportConfig {
  /** CSV 分隔符 */
  delimiter: string
  /** 是否有表头 */
  hasHeader: boolean
  /** 是否跳过空行 */
  skipEmpty: boolean
  /** 文本编码 */
  encoding: string
  /** 最大行数限制 (0 表示不限制) */
  maxRows: number
}

// 默认导入配置
const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  delimiter: ',',
  hasHeader: true,
  skipEmpty: true,
  encoding: 'utf-8',
  maxRows: 1000
}

// 解析结果
export interface ParseResult {
  /** 是否成功 */
  success: boolean
  /** 表头 (如果有) */
  headers?: string[]
  /** 数据行 */
  rows: ImportedRow[]
  /** 错误信息 */
  error?: string
  /** 总行数 */
  totalLines: number
  /** 跳过的行数 */
  skippedLines: number
}

/**
 * 批量导入 composable
 */
export function useBatchImport(initialConfig: Partial<ImportConfig> = {}) {
  const config = ref<ImportConfig>({ ...DEFAULT_IMPORT_CONFIG, ...initialConfig })
  const isLoading = ref(false)
  const lastError = ref<string | undefined>(undefined)

  /**
   * 解析 CSV 行 (处理引号内的逗号)
   */
  function parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // 转义的引号
          current += '"'
          i++ // 跳过下一个引号
        } else if (char === '"') {
          // 结束引号
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          // 开始引号
          inQuotes = true
        } else if (char === delimiter) {
          // 字段分隔符
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }

    // 添加最后一个字段
    result.push(current.trim())

    return result
  }

  /**
   * 解析文本内容
   */
  function parseText(text: string): ParseResult {
    const lines = text.split(/\r?\n/)
    const rows: ImportedRow[] = []
    let headers: string[] | undefined
    let skippedLines = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 跳过空行
      if (config.value.skipEmpty && !line.trim()) {
        skippedLines++
        continue
      }

      // 检查最大行数限制
      if (config.value.maxRows > 0 && rows.length >= config.value.maxRows) {
        break
      }

      // 解析字段
      const fields = parseCSVLine(line, config.value.delimiter)

      // 第一行作为表头
      if (config.value.hasHeader && !headers) {
        headers = fields
        continue
      }

      // 创建数据对象
      let data: Record<string, string> | undefined
      if (headers) {
        data = {}
        headers.forEach((header, idx) => {
          data![header] = fields[idx] || ''
        })
      }

      rows.push({
        lineNumber: i + 1,
        raw: line,
        fields,
        data
      })
    }

    return {
      success: true,
      headers,
      rows,
      totalLines: lines.length,
      skippedLines
    }
  }

  /**
   * 从文件导入
   */
  async function importFromFile(file: File): Promise<ParseResult> {
    isLoading.value = true
    lastError.value = undefined

    try {
      const text = await file.text()
      const result = parseText(text)
      return result
    } catch (e: any) {
      lastError.value = e.message || 'Failed to read file'
      return {
        success: false,
        rows: [],
        error: lastError.value,
        totalLines: 0,
        skippedLines: 0
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 从文本导入
   */
  function importFromText(text: string): ParseResult {
    lastError.value = undefined
    try {
      return parseText(text)
    } catch (e: any) {
      lastError.value = e.message || 'Failed to parse text'
      return {
        success: false,
        rows: [],
        error: lastError.value,
        totalLines: 0,
        skippedLines: 0
      }
    }
  }

  /**
   * 从简单列表导入 (每行一条)
   */
  function importFromList(text: string): string[] {
    const lines = text.split(/\r?\n/)
    return lines
      .map(line => line.trim())
      .filter(line => !config.value.skipEmpty || line.length > 0)
      .slice(0, config.value.maxRows > 0 ? config.value.maxRows : undefined)
  }

  /**
   * 验证导入数据
   */
  function validateRows(
    rows: ImportedRow[],
    requiredFields: string[]
  ): { valid: ImportedRow[]; invalid: { row: ImportedRow; reason: string }[] } {
    const valid: ImportedRow[] = []
    const invalid: { row: ImportedRow; reason: string }[] = []

    for (const row of rows) {
      const missingFields: string[] = []

      for (const field of requiredFields) {
        const value = row.data?.[field] || row.fields[requiredFields.indexOf(field)]
        if (!value || !value.trim()) {
          missingFields.push(field)
        }
      }

      if (missingFields.length > 0) {
        invalid.push({
          row,
          reason: `Missing required fields: ${missingFields.join(', ')}`
        })
      } else {
        valid.push(row)
      }
    }

    return { valid, invalid }
  }

  /**
   * 更新配置
   */
  function updateConfig(newConfig: Partial<ImportConfig>): void {
    config.value = { ...config.value, ...newConfig }
  }

  /**
   * 生成示例模板
   */
  function generateTemplate(headers: string[], exampleData?: string[][]): string {
    const lines: string[] = []

    // 添加表头
    if (config.value.hasHeader) {
      lines.push(headers.join(config.value.delimiter))
    }

    // 添加示例数据
    if (exampleData) {
      for (const row of exampleData) {
        lines.push(row.map(cell => {
          // 如果包含分隔符或引号，用引号包裹
          if (cell.includes(config.value.delimiter) || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(config.value.delimiter))
      }
    }

    return lines.join('\n')
  }

  return {
    config,
    isLoading,
    lastError,
    importFromFile,
    importFromText,
    importFromList,
    validateRows,
    updateConfig,
    generateTemplate
  }
}
