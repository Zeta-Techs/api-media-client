import { createDiscreteApi } from 'naive-ui'

// Create discrete API for message/notification that works outside of NMessageProvider
const { message, notification, dialog, loadingBar } = createDiscreteApi(
  ['message', 'notification', 'dialog', 'loadingBar']
)

export function useNaiveMessage() {
  return message
}

export function useNaiveNotification() {
  return notification
}

export function useNaiveDialog() {
  return dialog
}

export function useNaiveLoadingBar() {
  return loadingBar
}

// Re-export for convenience
export { message, notification, dialog, loadingBar }
