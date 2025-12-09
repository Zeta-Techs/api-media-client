/**
 * useFileUpload composable
 * 提供文件上传管理功能，包括验证、预览、大小限制等
 */
import { ref, computed } from 'vue'

export interface FileValidationOptions {
  /** 允许的文件类型 (MIME types) */
  accept?: string[]
  /** 最大文件大小（字节）默认 25MB */
  maxSize?: number
  /** 最大文件数量（用于多文件上传） */
  maxFiles?: number
  /** 是否允许多文件 */
  multiple?: boolean
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  errorKey?: string
  errorParams?: Record<string, string | number>
}

export interface UploadedFile {
  file: File
  preview?: string
  id: string
}

// 常用文件大小限制
export const FILE_SIZE_LIMITS = {
  AUDIO: 25 * 1024 * 1024, // 25MB - OpenAI Whisper limit
  IMAGE: 20 * 1024 * 1024, // 20MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  DEFAULT: 50 * 1024 * 1024 // 50MB
} as const

// 常用 MIME 类型
export const MIME_TYPES = {
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a', 'audio/webm', 'audio/mp4'],
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
} as const

/**
 * 格式化文件大小为人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 验证单个文件
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    accept = [],
    maxSize = FILE_SIZE_LIMITS.DEFAULT
  } = options

  // 检查文件大小
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds limit (${formatFileSize(maxSize)})`,
      errorKey: 'errors.fileTooLarge',
      errorParams: {
        size: formatFileSize(file.size),
        limit: formatFileSize(maxSize)
      }
    }
  }

  // 检查文件类型
  if (accept.length > 0) {
    const isValidType = accept.some(type => {
      if (type.endsWith('/*')) {
        // 通配符类型，如 image/*
        const baseType = type.slice(0, -2)
        return file.type.startsWith(baseType)
      }
      return file.type === type || file.name.toLowerCase().endsWith(type.replace(/^\./, ''))
    })

    if (!isValidType) {
      return {
        valid: false,
        error: `File type "${file.type || 'unknown'}" is not allowed`,
        errorKey: 'errors.invalidFileType',
        errorParams: {
          type: file.type || 'unknown'
        }
      }
    }
  }

  return { valid: true }
}

/**
 * 验证多个文件
 */
export function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): FileValidationResult {
  const { maxFiles = 10 } = options

  // 检查文件数量
  if (files.length > maxFiles) {
    return {
      valid: false,
      error: `Too many files. Maximum allowed: ${maxFiles}`,
      errorKey: 'errors.tooManyFiles',
      errorParams: {
        count: files.length,
        limit: maxFiles
      }
    }
  }

  // 验证每个文件
  for (const file of files) {
    const result = validateFile(file, options)
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}

/**
 * 获取文件的 MIME 类型（更准确的检测）
 */
export async function detectMimeType(file: File): Promise<string> {
  // 首先尝试读取文件头部的魔数
  const buffer = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 常见文件魔数
  const signatures: Record<string, string> = {
    '89504E47': 'image/png',
    'FFD8FF': 'image/jpeg',
    '47494638': 'image/gif',
    '52494646': 'audio/wav', // RIFF
    '494433': 'audio/mpeg', // ID3
    'FFFB': 'audio/mpeg',
    'FFF3': 'audio/mpeg',
    '4F676753': 'audio/ogg',
    '664C6143': 'audio/flac',
    '00000018': 'video/mp4', // ftyp
    '00000020': 'video/mp4',
    '1A45DFA3': 'video/webm'
  }

  const hex = Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')

  for (const [sig, mime] of Object.entries(signatures)) {
    if (hex.startsWith(sig)) {
      return mime
    }
  }

  // 如果无法检测，返回 file.type
  return file.type
}

export interface UseFileUploadOptions extends FileValidationOptions {
  /** 是否自动创建预览（仅图片） */
  autoPreview?: boolean
  /** 上传成功回调 */
  onSuccess?: (files: UploadedFile[]) => void
  /** 上传失败回调 */
  onError?: (error: FileValidationResult) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    accept = [],
    maxSize = FILE_SIZE_LIMITS.DEFAULT,
    maxFiles = 10,
    multiple = false,
    autoPreview = true,
    onSuccess,
    onError
  } = options

  const files = ref<UploadedFile[]>([])
  const error = ref<FileValidationResult | null>(null)
  const isDragging = ref(false)

  const totalSize = computed(() =>
    files.value.reduce((sum, f) => sum + f.file.size, 0)
  )

  const hasFiles = computed(() => files.value.length > 0)

  /**
   * 生成唯一 ID
   */
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 创建图片预览
   */
  function createPreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve('')
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * 添加文件
   */
  async function addFiles(newFiles: File[]): Promise<boolean> {
    error.value = null

    // 验证文件
    const allFiles = multiple
      ? [...files.value.map(f => f.file), ...newFiles]
      : newFiles

    const validation = validateFiles(allFiles, { accept, maxSize, maxFiles })

    if (!validation.valid) {
      error.value = validation
      onError?.(validation)
      return false
    }

    // 如果不是多文件模式，清除现有文件
    if (!multiple) {
      clearFiles()
    }

    // 添加新文件
    const uploadedFiles: UploadedFile[] = []

    for (const file of newFiles) {
      const preview = autoPreview ? await createPreview(file) : undefined
      const uploadedFile: UploadedFile = {
        file,
        preview,
        id: generateId()
      }
      uploadedFiles.push(uploadedFile)
      files.value.push(uploadedFile)
    }

    onSuccess?.(uploadedFiles)
    return true
  }

  /**
   * 移除文件
   */
  function removeFile(id: string) {
    const index = files.value.findIndex(f => f.id === id)
    if (index !== -1) {
      // 释放预览 URL
      const file = files.value[index]
      if (file.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(file.preview)
      }
      files.value.splice(index, 1)
    }
  }

  /**
   * 清除所有文件
   */
  function clearFiles() {
    // 释放所有预览 URL
    for (const file of files.value) {
      if (file.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(file.preview)
      }
    }
    files.value = []
    error.value = null
  }

  /**
   * 处理文件输入变化
   */
  async function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files?.length) {
      await addFiles(Array.from(input.files))
      // 清除 input 值以允许重新选择相同文件
      input.value = ''
    }
  }

  /**
   * 处理拖放
   */
  function handleDragEnter(event: DragEvent) {
    event.preventDefault()
    isDragging.value = true
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault()
    isDragging.value = false
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    isDragging.value = false

    const droppedFiles = event.dataTransfer?.files
    if (droppedFiles?.length) {
      await addFiles(Array.from(droppedFiles))
    }
  }

  /**
   * 清除错误
   */
  function clearError() {
    error.value = null
  }

  /**
   * 获取第一个文件（单文件模式常用）
   */
  const firstFile = computed(() => files.value[0]?.file ?? null)

  return {
    // 状态
    files,
    error,
    isDragging,
    totalSize,
    hasFiles,
    firstFile,

    // 方法
    addFiles,
    removeFile,
    clearFiles,
    clearError,
    handleFileInput,

    // 拖放处理
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // 工具函数
    validateFile: (file: File) => validateFile(file, { accept, maxSize }),
    validateFiles: (files: File[]) => validateFiles(files, { accept, maxSize, maxFiles }),
    formatFileSize
  }
}

export type UseFileUploadReturn = ReturnType<typeof useFileUpload>
