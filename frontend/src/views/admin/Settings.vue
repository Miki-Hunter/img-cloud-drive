<template>
  <div class="admin-settings fade-in">
    <!-- Telegram Bot 设置 -->
    <div class="glass-card settings-card">
      <h3 class="settings-section-title">🤖 {{ $t('admin.telegramSettings') }}</h3>
      <p class="settings-desc">{{ $t('admin.tgDescription') }}</p>
      <el-form :model="tgForm" label-position="top" class="settings-form">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item :label="$t('admin.tgBotToken')">
              <el-input v-model="tgForm.tg_bot_token" type="password" show-password
                :placeholder="$t('admin.tgBotToken')" class="glass-input" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('admin.tgChatId')">
              <el-input v-model="tgForm.tg_chat_id" :placeholder="$t('admin.tgChatId')" class="glass-input" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-switch v-model="tgForm.tg_enabled" active-value="1" inactive-value="0" />
          <span style="margin-left:10px">{{ $t('admin.tgEnabled') }}</span>
        </el-form-item>
        <el-form-item>
          <el-button :loading="testingTG" @click="testTelegram" class="glass-btn-outline">
            {{ testingTG ? $t('admin.testing') : $t('admin.testConnection') }}
          </el-button>
          <span v-if="tgTestResult" :style="{ color: tgTestResult.success ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '0.85rem' }">
            {{ tgTestResult.success ? $t('admin.testSuccess') + tgTestResult.bot?.username : tgTestResult.error }}
          </span>
        </el-form-item>
      </el-form>
    </div>

    <!-- 基本设置 -->
    <div class="glass-card settings-card">
      <h3 class="settings-section-title">⚙️ {{ $t('admin.basicSettings') }}</h3>
      <el-form :model="form" label-position="top" class="settings-form">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item :label="$t('admin.siteName')">
              <el-input v-model="form.site_name" class="glass-input" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('admin.siteDescription')">
              <el-input v-model="form.site_description" class="glass-input" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item :label="$t('admin.footerText')">
              <el-input v-model="form.footer_text" class="glass-input" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('admin.maxFileSize')">
              <el-input-number v-model="form.max_file_size" :min="1" :max="500" class="glass-input" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item :label="$t('admin.allowAnonymous')">
              <el-switch v-model="form.allow_anonymous_upload" active-value="1" inactive-value="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('admin.allowRegister')">
              <el-switch v-model="form.allow_register" active-value="1" inactive-value="0" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="GitHub URL">
              <el-input v-model="form.github_url" placeholder="https://github.com/..." class="glass-input" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('admin.siteName') + ' (EN)'">
              <el-input v-model="form.language" placeholder="zh-CN / en" disabled class="glass-input" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button class="glass-btn" :loading="saving" @click="saveSettings">
            {{ saving ? $t('admin.saving') : $t('admin.saveSettings') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import api from '../../api'

const { t } = useI18n()

const saving = ref(false)
const testingTG = ref(false)
const tgTestResult = ref(null)

const form = reactive({
  site_name: '📷 Cloud Drive',
  site_description: 'Free Image Hosting & Sharing Platform',
  footer_text: 'Cloud Drive © 2024',
  max_file_size: 50,
  allow_anonymous_upload: '1',
  allow_register: '0',
  language: 'zh-CN',
  github_url: ''
})

const tgForm = reactive({
  tg_bot_token: '',
  tg_chat_id: '',
  tg_enabled: '0'
})


async function loadSettings() {
  try {
    const settings = await api.get('/admin/settings')
    Object.keys(form).forEach(k => { if (settings[k] !== undefined) form[k] = settings[k] })
    Object.keys(tgForm).forEach(k => { if (settings[k] !== undefined) tgForm[k] = settings[k] })
  } catch (e) { console.error(e) }
}

async function saveSettings() {
  saving.value = true
  try {
    await api.put('/admin/settings', { ...form, ...tgForm })
    ElMessage.success(t('admin.saved'))
  } catch (e) {
    ElMessage.error(e?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

async function testTelegram() {
  if (!tgForm.tg_bot_token || !tgForm.tg_chat_id) {
    ElMessage.warning('Please enter Bot Token and Chat ID')
    return
  }
  testingTG.value = true
  tgTestResult.value = null
  try {
    // 测试前先保存TG设置，防止切换页面后丢失
    await api.put('/admin/settings', { ...form, ...tgForm })
    tgTestResult.value = await api.post('/admin/test-telegram', {
      tg_bot_token: tgForm.tg_bot_token,
      tg_chat_id: tgForm.tg_chat_id
    })
    if (tgTestResult.value.success) {
      ElMessage.success('✅ TG 设置已保存，连接成功！')
    }
  } catch (e) {
    tgTestResult.value = { success: false, error: e?.error || 'Connection failed' }
  } finally {
    testingTG.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.settings-card { padding: 28px; margin-bottom: 20px; }
.settings-section-title { font-size: 1.1rem; margin-bottom: 8px; }
.settings-desc { color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: 20px; }
.settings-form { max-width: 800px; }

@media (max-width: 768px) {
  .settings-card { padding: 16px !important; }
  .settings-form { max-width: 100% !important; }
  .settings-form .el-row { display: block !important; }
  .settings-form .el-col { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
}
</style>
