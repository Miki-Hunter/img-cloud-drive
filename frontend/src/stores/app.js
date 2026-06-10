import { defineStore } from 'pinia'
import api from '../api'

export const useAppStore = defineStore('app', {
  state: () => ({
    settings: {},
    folders: [],
    loading: false
  }),
  actions: {
    async fetchSettings() {
      try {
        this.settings = await api.get('/settings')
      } catch (e) {
        console.error('Failed to load settings', e)
      }
    },
    async fetchFolders() {
      try {
        this.folders = await api.get('/all-folders')
      } catch (e) {
        console.error('Failed to load folders', e)
      }
    }
  }
})
