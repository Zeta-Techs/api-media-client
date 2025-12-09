import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/image'
  },
  {
    path: '/video',
    name: 'video',
    component: () => import('./views/VideoView.vue'),
    meta: { title: 'nav.video', icon: 'videocam' }
  },
  {
    path: '/image',
    name: 'image',
    component: () => import('./views/ImageView.vue'),
    meta: { title: 'nav.image', icon: 'image' }
  },
  {
    path: '/audio',
    name: 'audio',
    component: () => import('./views/AudioView.vue'),
    meta: { title: 'nav.audio', icon: 'mic' }
  },
  {
    path: '/tts',
    name: 'tts',
    component: () => import('./views/TTSView.vue'),
    meta: { title: 'nav.tts', icon: 'volume-high' }
  },
  {
    path: '/realtime',
    name: 'realtime',
    component: () => import('./views/RealtimeView.vue'),
    meta: { title: 'nav.realtime', icon: 'radio' }
  },
  {
    path: '/moderation',
    name: 'moderation',
    component: () => import('./views/ModerationView.vue'),
    meta: { title: 'nav.moderation', icon: 'shield' }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('./views/HistoryView.vue'),
    meta: { title: 'nav.history', icon: 'time' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
    meta: { title: 'nav.settings', icon: 'settings' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
