<template>
  <div class="page-container login-page">
    <div class="login-wrapper fade-in">
      <div class="glass-card login-card">
        <div class="login-header">
          <div class="login-icon">🔑</div>
          <h2>{{ $t('login.title') }}</h2>
          <p style="color:var(--text-tertiary);font-size:0.9rem">{{ $t('login.desc') }}</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          @keyup.enter="handleLogin"
          class="login-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              :placeholder="$t('login.username')"
              size="large"
              :prefix-icon="User"
              class="glass-input"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              :placeholder="$t('login.password')"
              size="large"
              show-password
              :prefix-icon="Lock"
              class="glass-input"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              :loading="loading"
              class="glass-btn login-btn"
              size="large"
              @click="handleLogin"
            >
              {{ loading ? $t('login.loggingIn') : $t('login.loginBtn') }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-footer">
          <router-link to="/" class="back-link">
            <el-icon><ArrowLeft /></el-icon> {{ $t('nav.backHome') }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'
const auth = useAuthStore()

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await api.post('/auth/admin/login', form)
    auth.setAuth(res.token, res.user)
    ElMessage.success('登录成功')

    // 跳转回之前的页面或管理后台
    const redirect = route.query.redirect || '/admin'
    router.push(redirect)
  } catch (e) {
    ElMessage.error(e?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 140px);
}

.login-wrapper {
  width: 100%;
  max-width: 420px;
}

.login-card {
  padding: 40px 32px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.login-header h2 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.login-form {
  max-width: 320px;
  margin: 0 auto;
}

.login-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
  font-size: 1rem;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.back-link {
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--transition-fast);
}

.back-link:hover {
  color: var(--primary-light);
}
</style>
