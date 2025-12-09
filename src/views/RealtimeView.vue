<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NSelect, NButton, NSpace,
  NAlert, NTag, NTooltip, NSlider, NSwitch,
  NRadioGroup, NRadio
} from 'naive-ui'
import { ExpandOutline } from '@vicons/ionicons5'
import { useConfigStore } from '@/stores/config'
import { message } from '@/composables/useNaiveMessage'
import FullscreenSubtitle from '@/components/FullscreenSubtitle.vue'

// 字幕项类型（与 FullscreenSubtitle 组件共享）
interface SubtitleItem {
  text: string
  translated?: string
  timestamp: Date
  isFinal: boolean
  isTranslating?: boolean
}

const { t } = useI18n()
const configStore = useConfigStore()

// Mode: conversation (normal voice chat) or transcription (subtitle mode)
const mode = ref<'conversation' | 'transcription'>('conversation')

// Auto scroll toggle
const autoScroll = ref(true)

// Form state
const form = ref({
  model: 'gpt-realtime',
  customModel: '',
  voice: 'alloy',
  instructions: '',
  temperature: 0.8,
  maxTokens: 4096,
  vadEnabled: true,
  vadThreshold: 0.5,
  vadSilenceDuration: 500,
  language: 'auto' // Language for transcription
})

// Connection state
const isConnected = ref(false)
const isConnecting = ref(false)
const isRecording = ref(false)
const isSpeaking = ref(false)
const errorMessage = ref('')
const conversation = ref<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([])

// Transcription state (for subtitle mode)
const transcripts = ref<SubtitleItem[]>([])
const currentTranscript = ref('')
const transcriptContainerRef = ref<HTMLElement | null>(null)
const conversationContainerRef = ref<HTMLElement | null>(null)

// Fullscreen subtitle state
const showFullscreenSubtitle = ref(false)

// WebSocket and Audio
const ws = ref<WebSocket | null>(null)
const audioContext = ref<AudioContext | null>(null)
const mediaStream = ref<MediaStream | null>(null)
const audioWorklet = ref<AudioWorkletNode | null>(null)
const sourceNode = ref<MediaStreamAudioSourceNode | null>(null)

// Audio playback queue
const audioQueue = ref<ArrayBuffer[]>([])
const isPlayingAudio = ref(false)

// Current response text accumulator
const currentResponseText = ref('')

// Provider preset options
const presetOptions = computed(() =>
  configStore.providerPresets.map(p => ({
    label: p.name,
    value: p.id
  }))
)

// Language options for transcription
// Note: Whisper API uses 'zh' for Chinese but doesn't distinguish simplified/traditional
// We use special values (zh-CN, zh-TW) to handle this via prompt hints
const languageOptions = computed(() => [
  { label: t('audio.languages.auto'), value: 'auto' },
  { label: '简体中文 (Simplified)', value: 'zh-CN' },
  { label: '繁體中文 (Traditional)', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Italiano', value: 'it' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' }
])

// Realtime API models
const modelOptions = [
  { label: 'gpt-realtime (Latest)', value: 'gpt-realtime', description: 'realtime.models.gptRealtimeDesc' },
  { label: 'gpt-realtime-mini', value: 'gpt-realtime-mini', description: 'realtime.models.gptRealtimeMiniDesc' },
  { label: 'gpt-4o-realtime-preview', value: 'gpt-4o-realtime-preview', description: 'realtime.models.gpt4oRealtimeDesc' },
  { label: 'gpt-4o-mini-realtime-preview', value: 'gpt-4o-mini-realtime-preview', description: 'realtime.models.gpt4oMiniRealtimeDesc' },
  { label: t('common.custom'), value: 'custom' }
]

const voiceOptions = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Ash', value: 'ash' },
  { label: 'Ballad', value: 'ballad' },
  { label: 'Coral', value: 'coral' },
  { label: 'Echo', value: 'echo' },
  { label: 'Sage', value: 'sage' },
  { label: 'Shimmer', value: 'shimmer' },
  { label: 'Verse', value: 'verse' }
]

const isCustomModel = computed(() => form.value.model === 'custom')
const actualModel = computed(() =>
  isCustomModel.value ? form.value.customModel : form.value.model
)

// Build WebSocket URL
function getWebSocketUrl(): string {
  const baseUrl = configStore.baseUrl.replace(/\/$/, '')
  // Convert HTTP(S) URL to WebSocket URL
  let wsUrl = baseUrl.replace(/^http/, 'ws')
  // OpenAI Realtime API endpoint
  wsUrl += '/v1/realtime'
  wsUrl += `?model=${encodeURIComponent(actualModel.value)}`
  return wsUrl
}

// Connect to Realtime API
async function connect() {
  if (!configStore.apiKey) {
    message.error(t('errors.missingApiKey'))
    return
  }

  if (isConnected.value || isConnecting.value) return

  errorMessage.value = ''
  isConnecting.value = true

  try {
    // Initialize AudioContext
    audioContext.value = new AudioContext({ sampleRate: 24000 })

    // Get microphone access
    mediaStream.value = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    // Connect WebSocket with proper headers via URL params for browser compatibility
    const wsUrl = getWebSocketUrl()

    // Create WebSocket with subprotocols for authentication
    ws.value = new WebSocket(wsUrl, [
      'realtime',
      `openai-insecure-api-key.${configStore.apiKey}`,
      'openai-beta.realtime-v1'
    ])

    ws.value.onopen = () => {
      console.log('WebSocket connected')
      isConnected.value = true
      isConnecting.value = false

      // Send session configuration
      sendSessionUpdate()

      // Start audio capture
      startAudioCapture()

      message.success(t('realtime.connected'))
    }

    ws.value.onmessage = (event) => {
      handleServerEvent(JSON.parse(event.data))
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
      errorMessage.value = t('realtime.errors.connectionFailed')
      isConnecting.value = false
    }

    ws.value.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      isConnected.value = false
      isConnecting.value = false
      stopAudioCapture()

      if (event.code !== 1000) {
        let errorDetail = event.reason || `Code: ${event.code}`
        if (event.code === 1006) {
          errorDetail = t('realtime.errors.abnormalClose')
        }
        errorMessage.value = `${t('realtime.errors.connectionClosed')}: ${errorDetail}`
      }
    }
  } catch (e: any) {
    console.error('Connection error:', e)
    errorMessage.value = e.message
    isConnecting.value = false
    cleanup()
  }
}

// Send session configuration
function sendSessionUpdate() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return

  const sessionConfig: any = {
    type: 'session.update',
    session: {
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      turn_detection: form.value.vadEnabled ? {
        type: 'server_vad',
        threshold: form.value.vadThreshold,
        prefix_padding_ms: 300,
        silence_duration_ms: form.value.vadSilenceDuration
      } : null
    }
  }

  // Handle Chinese language variants
  // Whisper API only supports 'zh', not 'zh-CN' or 'zh-TW'
  // We use prompt hints to guide simplified/traditional output
  let actualLanguage = form.value.language
  let chinesePromptHint = ''

  if (form.value.language === 'zh-CN') {
    actualLanguage = 'zh'
    chinesePromptHint = '请使用简体中文输出。'
  } else if (form.value.language === 'zh-TW') {
    actualLanguage = 'zh'
    chinesePromptHint = '請使用繁體中文輸出。'
  }

  // Add language if specified
  if (actualLanguage !== 'auto') {
    sessionConfig.session.input_audio_transcription.language = actualLanguage
  }

  // Add prompt for Chinese variant guidance
  if (chinesePromptHint) {
    sessionConfig.session.input_audio_transcription.prompt = chinesePromptHint
  }

  // In transcription mode, we only want text output (no AI response)
  if (mode.value === 'transcription') {
    sessionConfig.session.modalities = ['text']
  } else {
    // Conversation mode - full voice chat
    sessionConfig.session.modalities = ['text', 'audio']
    sessionConfig.session.voice = form.value.voice
    sessionConfig.session.temperature = form.value.temperature
    sessionConfig.session.max_response_output_tokens = form.value.maxTokens

    // Combine Chinese prompt hint with user instructions for AI responses
    let finalInstructions = form.value.instructions || ''
    if (chinesePromptHint) {
      // Add Chinese variant instruction for AI responses
      const aiChineseInstruction = form.value.language === 'zh-CN'
        ? '请始终使用简体中文回复用户。'
        : '請始終使用繁體中文回覆用戶。'
      finalInstructions = aiChineseInstruction + (finalInstructions ? ' ' + finalInstructions : '')
    }

    if (finalInstructions) {
      sessionConfig.session.instructions = finalInstructions
    }
  }

  ws.value.send(JSON.stringify(sessionConfig))
}

// Scroll to bottom
function scrollToBottom(container: HTMLElement | null) {
  if (container && autoScroll.value) {
    nextTick(() => {
      container.scrollTop = container.scrollHeight
    })
  }
}

// Handle server events
function handleServerEvent(event: any) {
  switch (event.type) {
    case 'session.created':
    case 'session.updated':
      console.log('Session configured:', event)
      break

    case 'conversation.item.created':
      if (event.item?.role === 'user' && event.item?.content?.[0]?.transcript) {
        const transcript = event.item.content[0].transcript

        // Always add to transcripts for subtitle display
        transcripts.value.push({
          text: transcript,
          timestamp: new Date(),
          isFinal: true
        })
        currentTranscript.value = ''
        scrollToBottom(transcriptContainerRef.value)

        if (mode.value === 'conversation') {
          conversation.value.push({
            role: 'user',
            content: transcript,
            timestamp: new Date()
          })
          scrollToBottom(conversationContainerRef.value)
        }
      }
      break

    case 'conversation.item.input_audio_transcription.completed':
      if (event.transcript) {
        // 检查是否有临时字幕需要更新为最终字幕
        const lastTranscript = transcripts.value[transcripts.value.length - 1]
        if (lastTranscript && !lastTranscript.isFinal) {
          // 更新临时字幕为最终字幕
          lastTranscript.text = event.transcript
          lastTranscript.isFinal = true
          lastTranscript.timestamp = new Date()
        } else {
          // 没有临时字幕，创建新的最终字幕
          transcripts.value.push({
            text: event.transcript,
            timestamp: new Date(),
            isFinal: true
          })
        }
        currentTranscript.value = ''
        scrollToBottom(transcriptContainerRef.value)
      }
      break

    case 'conversation.item.input_audio_transcription.delta':
      if (event.delta) {
        currentTranscript.value += event.delta
        scrollToBottom(transcriptContainerRef.value)

        // 实时更新非最终字幕（用于流式显示）
        // 更新或创建一个临时的非 final 字幕项
        const lastTranscript = transcripts.value[transcripts.value.length - 1]
        if (lastTranscript && !lastTranscript.isFinal) {
          // 更新现有的临时字幕
          lastTranscript.text = currentTranscript.value
        } else if (currentTranscript.value) {
          // 创建新的临时字幕
          transcripts.value.push({
            text: currentTranscript.value,
            timestamp: new Date(),
            isFinal: false
          })
        }
      }
      break

    case 'response.created':
      if (mode.value === 'conversation') {
        currentResponseText.value = ''
        isSpeaking.value = true
      }
      break

    case 'response.text.delta':
      if (mode.value === 'conversation') {
        currentResponseText.value += event.delta || ''
        scrollToBottom(conversationContainerRef.value)
      }
      break

    case 'response.audio_transcript.delta':
      if (mode.value === 'conversation') {
        currentResponseText.value += event.delta || ''
        scrollToBottom(conversationContainerRef.value)
      }
      break

    case 'response.audio.delta':
      if (event.delta && mode.value === 'conversation') {
        const audioData = base64ToArrayBuffer(event.delta)
        audioQueue.value.push(audioData)
        playNextAudio()
      }
      break

    case 'response.done':
      if (mode.value === 'conversation') {
        if (currentResponseText.value) {
          conversation.value.push({
            role: 'assistant',
            content: currentResponseText.value,
            timestamp: new Date()
          })
          // Also add AI response to transcripts
          transcripts.value.push({
            text: `[AI] ${currentResponseText.value}`,
            timestamp: new Date(),
            isFinal: true
          })
          currentResponseText.value = ''
          scrollToBottom(conversationContainerRef.value)
          scrollToBottom(transcriptContainerRef.value)
        }
        isSpeaking.value = false
      }
      break

    case 'input_audio_buffer.speech_started':
      isRecording.value = true
      break

    case 'input_audio_buffer.speech_stopped':
      isRecording.value = false
      break

    case 'input_audio_buffer.committed':
      break

    case 'error':
      console.error('Server error:', event.error)
      errorMessage.value = event.error?.message || 'Unknown error'
      break

    default:
      console.log('Unhandled event:', event.type, event)
  }
}

// Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

// ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Play audio from queue
async function playNextAudio() {
  if (isPlayingAudio.value || audioQueue.value.length === 0 || !audioContext.value) return
  if (mode.value === 'transcription') return

  isPlayingAudio.value = true

  while (audioQueue.value.length > 0) {
    const audioData = audioQueue.value.shift()!

    try {
      const pcm16 = new Int16Array(audioData)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768
      }

      const audioBuffer = audioContext.value.createBuffer(1, float32.length, 24000)
      audioBuffer.getChannelData(0).set(float32)

      const source = audioContext.value.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.value.destination)

      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
        source.start()
      })
    } catch (e) {
      console.error('Audio playback error:', e)
    }
  }

  isPlayingAudio.value = false
}

// Start audio capture
async function startAudioCapture() {
  if (!audioContext.value || !mediaStream.value || !ws.value) return

  try {
    await audioContext.value.audioWorklet.addModule(
      URL.createObjectURL(new Blob([`
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = [];
          }

          process(inputs) {
            const input = inputs[0];
            if (input && input[0]) {
              const samples = input[0];
              const int16 = new Int16Array(samples.length);
              for (let i = 0; i < samples.length; i++) {
                int16[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
              }
              this.port.postMessage(int16.buffer, [int16.buffer]);
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `], { type: 'application/javascript' }))
    )

    sourceNode.value = audioContext.value.createMediaStreamSource(mediaStream.value)
    audioWorklet.value = new AudioWorkletNode(audioContext.value, 'audio-processor')

    audioWorklet.value.port.onmessage = (event) => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        const base64Audio = arrayBufferToBase64(event.data)
        ws.value.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        }))
      }
    }

    sourceNode.value.connect(audioWorklet.value)

    console.log('Audio capture started')
  } catch (e) {
    console.error('Failed to start audio capture:', e)
    errorMessage.value = t('realtime.errors.audioCaptureFailed')
  }
}

// Stop audio capture
function stopAudioCapture() {
  if (audioWorklet.value) {
    audioWorklet.value.disconnect()
    audioWorklet.value = null
  }
  if (sourceNode.value) {
    sourceNode.value.disconnect()
    sourceNode.value = null
  }
}

// Disconnect
function disconnect() {
  cleanup()
  message.info(t('realtime.disconnected'))
}

// Cleanup
function cleanup() {
  stopAudioCapture()

  if (ws.value) {
    ws.value.close(1000)
    ws.value = null
  }

  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(track => track.stop())
    mediaStream.value = null
  }

  if (audioContext.value) {
    audioContext.value.close()
    audioContext.value = null
  }

  audioQueue.value = []
  isConnected.value = false
  isConnecting.value = false
  isRecording.value = false
  isSpeaking.value = false
  isPlayingAudio.value = false
}

// Manual trigger (for when VAD is disabled)
function triggerResponse() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return

  ws.value.send(JSON.stringify({
    type: 'input_audio_buffer.commit'
  }))

  if (mode.value === 'conversation') {
    ws.value.send(JSON.stringify({
      type: 'response.create'
    }))
  }
}

// Clear conversation/transcripts
function clearConversation() {
  conversation.value = []
  transcripts.value = []
  currentTranscript.value = ''
  errorMessage.value = ''
}

// Export transcripts as text
function exportTranscripts() {
  const content = transcripts.value
    .map(t => `[${t.timestamp.toLocaleTimeString()}] ${t.text}`)
    .join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transcript-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success(t('realtime.exportSuccess'))
}

// Export as SRT subtitle format
function exportAsSRT() {
  let srtContent = ''
  transcripts.value.forEach((t, index) => {
    const startTime = formatSRTTime(t.timestamp)
    // Estimate end time as 3 seconds after start
    const endDate = new Date(t.timestamp.getTime() + 3000)
    const endTime = formatSRTTime(endDate)

    srtContent += `${index + 1}\n`
    srtContent += `${startTime} --> ${endTime}\n`
    srtContent += `${t.text}\n\n`
  })

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transcript-${Date.now()}.srt`
  a.click()
  URL.revokeObjectURL(url)
  message.success(t('realtime.exportSuccess'))
}

function formatSRTTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s},${ms}`
}

// Format time
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Open fullscreen subtitle
function openFullscreenSubtitle() {
  showFullscreenSubtitle.value = true
}

// Update subtitles from fullscreen component (for translation results)
function handleSubtitlesUpdate(newSubtitles: SubtitleItem[]) {
  transcripts.value = newSubtitles
}

// Watch for form changes when connected
watch(() => [form.value.voice, form.value.temperature, form.value.vadEnabled, form.value.vadThreshold, form.value.vadSilenceDuration, form.value.language], () => {
  if (isConnected.value) {
    sendSessionUpdate()
  }
}, { deep: true })

// Watch mode changes
watch(mode, () => {
  if (isConnected.value) {
    sendSessionUpdate()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title gradient-text">{{ t('realtime.title') }}</h1>
      <p class="page-subtitle">{{ t('realtime.subtitle') }}</p>
    </div>

    <div class="realtime-layout">
      <!-- Left Panel: Controls + Conversation -->
      <div class="left-panel">
        <NCard class="glass-card controls-card">
          <NForm label-placement="left" label-width="100" size="small">
            <!-- Mode Selection -->
            <NFormItem :label="t('realtime.mode')">
              <NRadioGroup v-model:value="mode" :disabled="isConnected">
                <NSpace>
                  <NRadio value="conversation">{{ t('realtime.modeConversation') }}</NRadio>
                  <NRadio value="transcription">{{ t('realtime.modeTranscription') }}</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <!-- Provider Preset -->
            <NFormItem :label="t('settings.providerPresets')">
              <NSpace align="center" style="width: 100%">
                <NSelect
                  :value="configStore.activePresetId"
                  :options="presetOptions"
                  @update:value="configStore.setActivePreset"
                  style="flex: 1; min-width: 180px"
                  :disabled="isConnected"
                />
                <NTooltip>
                  <template #trigger>
                    <NTag :type="configStore.apiKey ? 'success' : 'warning'" size="small">
                      {{ configStore.apiKey ? '✓' : '✗' }}
                    </NTag>
                  </template>
                  {{ configStore.apiKey ? configStore.baseUrl : t('errors.missingApiKey') }}
                </NTooltip>
              </NSpace>
            </NFormItem>

            <!-- Model -->
            <NFormItem :label="t('common.model')">
              <NSelect v-model:value="form.model" :options="modelOptions" :disabled="isConnected" />
            </NFormItem>
            <NFormItem v-if="isCustomModel" label=" ">
              <NInput v-model:value="form.customModel" :placeholder="t('common.custom')" :disabled="isConnected" />
            </NFormItem>

            <!-- Language -->
            <NFormItem :label="t('realtime.language')">
              <NSelect v-model:value="form.language" :options="languageOptions" />
            </NFormItem>

            <!-- Voice (only in conversation mode) -->
            <NFormItem v-if="mode === 'conversation'" :label="t('realtime.voice')">
              <NSelect v-model:value="form.voice" :options="voiceOptions" />
            </NFormItem>

            <!-- VAD Settings -->
            <NFormItem :label="t('realtime.vadEnabled')">
              <NSwitch v-model:value="form.vadEnabled" />
            </NFormItem>

            <template v-if="form.vadEnabled">
              <NFormItem :label="t('realtime.vadThreshold')">
                <div class="slider-row">
                  <NSlider v-model:value="form.vadThreshold" :min="0" :max="1" :step="0.05" style="flex: 1" />
                  <span class="slider-value">{{ form.vadThreshold.toFixed(2) }}</span>
                </div>
              </NFormItem>
            </template>

            <!-- Instructions (only in conversation mode) -->
            <NFormItem v-if="mode === 'conversation'" :label="t('realtime.instructions')">
              <NInput
                v-model:value="form.instructions"
                type="textarea"
                :rows="2"
                :placeholder="t('realtime.instructionsPlaceholder')"
                :disabled="isConnected"
              />
            </NFormItem>

            <!-- Connection Controls -->
            <NFormItem label=" ">
              <NSpace>
                <NButton
                  v-if="!isConnected"
                  type="primary"
                  :loading="isConnecting"
                  @click="connect"
                >
                  {{ t('realtime.connect') }}
                </NButton>
                <NButton
                  v-else
                  type="error"
                  @click="disconnect"
                >
                  {{ t('realtime.disconnect') }}
                </NButton>

                <NButton
                  v-if="isConnected && !form.vadEnabled"
                  type="primary"
                  @click="triggerResponse"
                  :disabled="isSpeaking"
                >
                  {{ mode === 'transcription' ? t('realtime.commit') : t('realtime.send') }}
                </NButton>
              </NSpace>
            </NFormItem>
          </NForm>

          <!-- Status indicator -->
          <div class="status-bar">
            <div class="status-item">
              <span class="status-dot" :class="{ connected: isConnected, connecting: isConnecting }"></span>
              <span>{{ isConnected ? t('realtime.connected') : isConnecting ? t('realtime.connecting') : t('realtime.disconnected') }}</span>
            </div>
            <div v-if="isRecording" class="status-item">
              <span class="status-dot recording"></span>
              <span>{{ t('realtime.listening') }}</span>
            </div>
            <div v-if="isSpeaking && mode === 'conversation'" class="status-item">
              <span class="status-dot speaking"></span>
              <span>{{ t('realtime.speaking') }}</span>
            </div>
          </div>
        </NCard>

        <!-- Conversation Display (only in conversation mode) -->
        <NCard v-if="mode === 'conversation'" class="glass-card conversation-card">
          <template #header>
            <span style="font-size: 14px; font-weight: 600;">{{ t('realtime.conversation') }}</span>
          </template>

          <NAlert v-if="errorMessage" type="error" style="margin-bottom: 12px" closable @close="errorMessage = ''">
            {{ errorMessage }}
          </NAlert>

          <div ref="conversationContainerRef" class="conversation-container">
            <div v-if="conversation.length === 0 && !currentResponseText" class="placeholder">
              <div class="placeholder-icon">💬</div>
              <div class="placeholder-text">{{ t('realtime.waitingForInput') }}</div>
            </div>

            <div v-else class="messages-list">
              <div
                v-for="(msg, idx) in conversation"
                :key="idx"
                class="message"
                :class="msg.role"
              >
                <div class="message-header">
                  <span class="message-role">{{ msg.role === 'user' ? t('realtime.you') : t('realtime.assistant') }}</span>
                  <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                </div>
                <div class="message-content">{{ msg.content }}</div>
              </div>

              <div v-if="currentResponseText" class="message assistant streaming">
                <div class="message-header">
                  <span class="message-role">{{ t('realtime.assistant') }}</span>
                  <span class="typing-indicator">...</span>
                </div>
                <div class="message-content">{{ currentResponseText }}</div>
              </div>
            </div>
          </div>
        </NCard>

        <!-- Transcription placeholder (in transcription mode) -->
        <NCard v-else class="glass-card info-card">
          <NAlert type="info">
            {{ t('realtime.transcriptionHint') }}
          </NAlert>
        </NCard>
      </div>

      <!-- Right Panel: Live Subtitles -->
      <NCard class="glass-card subtitle-card">
        <template #header>
          <div class="subtitle-header">
            <span style="font-size: 14px; font-weight: 600;">{{ t('realtime.transcript') }}</span>
            <NSpace size="small">
              <NTooltip>
                <template #trigger>
                  <NButton size="tiny" :type="autoScroll ? 'primary' : 'default'" @click="autoScroll = !autoScroll">
                    {{ autoScroll ? '⬇' : '⏸' }}
                  </NButton>
                </template>
                {{ t('realtime.autoScroll') }}
              </NTooltip>
              <NTooltip>
                <template #trigger>
                  <NButton size="tiny" type="primary" @click="openFullscreenSubtitle">
                    <template #icon>
                      <ExpandOutline />
                    </template>
                  </NButton>
                </template>
                {{ t('realtime.fullscreen.title') }}
              </NTooltip>
              <NButton size="tiny" @click="clearConversation" :disabled="transcripts.length === 0">
                {{ t('realtime.clearHistory') }}
              </NButton>
              <NButton size="tiny" @click="exportTranscripts" :disabled="transcripts.length === 0">
                TXT
              </NButton>
              <NButton size="tiny" @click="exportAsSRT" :disabled="transcripts.length === 0">
                SRT
              </NButton>
            </NSpace>
          </div>
        </template>

        <div ref="transcriptContainerRef" class="transcript-container">
          <div v-if="transcripts.length === 0 && !currentTranscript" class="placeholder">
            <div class="placeholder-icon">📝</div>
            <div class="placeholder-text">{{ t('realtime.waitingForTranscription') }}</div>
            <div class="placeholder-hint">{{ t('realtime.hint') }}</div>
          </div>

          <div v-else class="transcript-list">
            <div
              v-for="(item, idx) in transcripts"
              :key="idx"
              class="transcript-item"
              :class="{ ai: item.text.startsWith('[AI]') }"
            >
              <span class="transcript-time">{{ formatTime(item.timestamp) }}</span>
              <span class="transcript-text">{{ item.text }}</span>
            </div>

            <div v-if="currentTranscript" class="transcript-item partial">
              <span class="transcript-time">{{ formatTime(new Date()) }}</span>
              <span class="transcript-text">{{ currentTranscript }}<span class="typing-cursor">|</span></span>
            </div>
          </div>
        </div>
      </NCard>
    </div>

    <!-- Fullscreen Subtitle Component -->
    <FullscreenSubtitle
      v-model:show="showFullscreenSubtitle"
      :subtitles="transcripts"
      :current-text="currentTranscript"
      :is-connected="isConnected"
      :is-recording="isRecording"
      @update:subtitles="handleSubtitlesUpdate"
    />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: 14px;
  opacity: 0.7;
  margin: 0;
}

.realtime-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: stretch;
  height: calc(100vh - 200px);
  min-height: 500px;
}

@media (max-width: 1024px) {
  .realtime-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.controls-card {
  flex-shrink: 0;
}

.conversation-card,
.info-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.conversation-card :deep(.n-card__content),
.info-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.subtitle-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.subtitle-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 !important;
}

.subtitle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.slider-value {
  min-width: 40px;
  text-align: right;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.status-bar {
  display: flex;
  gap: 16px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 12px;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.status-dot.connected {
  background: #10b981;
}

.status-dot.connecting {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

.status-dot.recording {
  background: #ef4444;
  animation: pulse 1s infinite;
}

.status-dot.speaking {
  background: #3b82f6;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.conversation-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.transcript-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.placeholder {
  height: 100%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.placeholder-icon {
  font-size: 36px;
  opacity: 0.3;
}

.placeholder-text {
  font-size: 14px;
  opacity: 0.6;
}

.placeholder-hint {
  font-size: 12px;
  opacity: 0.4;
  text-align: center;
  max-width: 250px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  padding: 10px 14px;
  border-radius: 10px;
  max-width: 90%;
}

.message.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #7c3aed, #6366f1);
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
}

.message.streaming {
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 11px;
  opacity: 0.7;
}

.message-role {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.message-time {
  font-size: 10px;
}

.typing-indicator {
  animation: typing 1s infinite;
}

@keyframes typing {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.message-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Transcript styles */
.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transcript-item {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.5;
}

.transcript-item.ai {
  background: rgba(124, 58, 237, 0.1);
  border-left: 3px solid #7c3aed;
}

.transcript-item.partial {
  background: rgba(124, 58, 237, 0.1);
  border: 1px dashed rgba(124, 58, 237, 0.3);
}

.transcript-time {
  font-size: 10px;
  opacity: 0.5;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  padding-top: 3px;
}

.transcript-text {
  flex: 1;
}

.typing-cursor {
  animation: blink 1s infinite;
  color: #7c3aed;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
