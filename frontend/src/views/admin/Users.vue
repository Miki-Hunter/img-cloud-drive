<template>
  <div class="admin-users fade-in">
    <!-- 超级管理员提示 -->
    <div v-if="isSuperAdmin" class="glass-card admin-note" style="padding:12px 20px;margin-bottom:16px">
      <el-icon style="margin-right:8px;color:var(--text-accent)"><InfoFilled /></el-icon>
      <span style="color:var(--text-secondary);font-size:0.9rem">{{ $t('admin.superAdminNote') }}</span>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="keyword" :placeholder="$t('admin.searchUser')" clearable class="glass-input search-input"
          @keyup.enter="search" @clear="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button class="glass-btn" @click="search">{{ $t('admin.filter') }}</el-button>
      </div>
      <div class="toolbar-right" v-if="isSuperAdmin">
        <el-button class="glass-btn" @click="showCreateDialog">
          <el-icon><Plus /></el-icon> {{ $t('admin.newUser') }}
        </el-button>
      </div>
    </div>

    <div class="glass-card table-wrap">
      <el-table :data="users" stripe v-loading="loading" :max-height="600" style="width:100%">
        <el-table-column label="ID" width="60" prop="id" />
        <el-table-column :label="$t('admin.username')" min-width="120" prop="username" show-overflow-tooltip />
        <el-table-column :label="$t('admin.nickname')" min-width="120" prop="nickname" show-overflow-tooltip />
        <el-table-column :label="$t('admin.role')" width="110">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">{{ roleName(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('admin.status')" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-if="isSuperAdmin && row.role !== 'super_admin'"
              :model-value="!!row.status" @change="val => toggleStatus(row, val)" size="small" />
            <el-tag v-else :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? 'ON' : 'OFF' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('admin.fileCount')" width="80" prop="file_count" align="center" />
        <el-table-column :label="$t('admin.lastUpload')" min-width="140">
          <template #default="{ row }">{{ row.last_upload ? formatBeijingTime(row.last_upload) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('admin.registerTime')" min-width="140">
          <template #default="{ row }">{{ formatBeijingTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.tip')" width="90" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button size="small" text><el-icon><MoreFilled /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="isSuperAdmin || row.id === currentUserId" @click="showPasswordDialog(row)">{{ $t('admin.changePassword') }}</el-dropdown-item>
                  <el-dropdown-item v-if="isSuperAdmin && row.role !== 'super_admin' && row.id !== currentUserId"
                    divided @click="deleteUser(row)" style="color:#f56c6c">{{ $t('admin.deleteUser') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-wrap">
      <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="pagination.total"
        layout="total, prev, pager, next" @current-change="loadUsers" background small />
    </div>

    <!-- 新建用户（独立全局弹窗） -->
    <AppDialog v-model="createDialog.visible" :title="$t('admin.newUser')" :width="460" :close-on-click-overlay="false">
      <el-form :model="createForm" label-position="top" @submit.prevent>
        <el-form-item :label="$t('admin.username')">
          <el-input v-model="createForm.username" class="glass-input" />
        </el-form-item>
        <el-form-item :label="$t('admin.password')">
          <el-input v-model="createForm.password" type="password" show-password autocomplete="new-password" class="glass-input"
            @keyup.enter="createUser" />
        </el-form-item>
        <el-form-item :label="$t('admin.nickname')">
          <el-input v-model="createForm.nickname" class="glass-input" />
        </el-form-item>
        <el-form-item :label="$t('admin.role')">
          <div style="display:flex;flex-direction:column;gap:4px">
            <el-tag type="warning" style="width:fit-content">{{ $t('admin.roleAdmin') }}</el-tag>
            <span style="color:var(--text-tertiary);font-size:0.8rem">{{ $t('admin.superAdminNote') }}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" class="glass-btn" native-type="button" @click="createUser">{{ $t('admin.create') }}</el-button>
      </template>
    </AppDialog>

    <!-- 修改密码（独立全局弹窗） -->
    <AppDialog v-model="passwordDialog.visible" :title="$t('admin.changePassword')" :width="460" :close-on-click-overlay="false">
      <el-form :model="passwordForm" label-position="top" @submit.prevent>
        <el-form-item :label="$t('admin.newPassword')">
          <div class="password-row">
            <el-input v-model="passwordForm.password" type="password" show-password autocomplete="new-password" class="glass-input"
              @keyup.enter="changePassword" />
            <el-button class="glass-btn" @click="generatePassword" :title="'生成随机密码'">
              🎲 生成
            </el-button>
          </div>
          <div v-if="passwordForm.password" class="password-tip">
            ⚠️ 密码已<span v-if="passwordDialog.generated">自动复制到剪贴板</span><span v-else>填写</span>，保存后将无法查看原密码
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialog.visible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" class="glass-btn" native-type="button" @click="changePassword">{{ $t('admin.changePassword') }}</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import AppDialog from '../../components/AppDialog.vue'
import api from '../../api'

const { t } = useI18n()
const auth = useAuthStore()

const users = ref([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = 20
const pagination = ref({ total: 0 })

const createDialog = ref({ visible: false })
const createForm = ref({ username: '', password: '', nickname: '' })
const passwordDialog = ref({ visible: false, user: null, generated: false })
const passwordForm = ref({ password: '' })

const user = computed(() => auth.userData)
const isSuperAdmin = computed(() => auth.isSuperAdmin)
const currentUserId = computed(() => auth.userData?.id)

function roleTagType(role) {
  return role === 'super_admin' ? 'danger' : role === 'admin' ? 'warning' : 'info'
}
function roleName(role) {
  const map = { super_admin: t('admin.roleSuperAdmin'), admin: t('admin.roleAdmin'), user: t('admin.roleUser') }
  return map[role] || role
}


async function loadUsers() {
  loading.value = true
  try {
    const res = await api.get('/admin/users', {
      params: { page: currentPage.value, page_size: pageSize, keyword: keyword.value }
    })
    users.value = res.users || []
    pagination.value = res.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function search() { currentPage.value = 1; loadUsers() }

function showCreateDialog() {
  createForm.value = { username: '', password: '', nickname: '' }
  createDialog.value.visible = true
}

async function createUser() {
  if (!createForm.value.username || !createForm.value.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  try {
    await api.post('/admin/users', createForm.value)
    ElMessage.success('创建成功')
    createDialog.value.visible = false
    loadUsers()
  } catch (e) { ElMessage.error(e?.error || '创建失败') }
}

function showPasswordDialog(row) {
  passwordDialog.value.user = row
  passwordDialog.value.generated = false
  passwordForm.value.password = ''
  passwordDialog.value.visible = true
}

// 生成随机密码
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  let pwd = ''
  for (let i = 0; i < 16; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  passwordForm.value.password = pwd
  passwordDialog.value.generated = true
  // 自动复制到剪贴板
  navigator.clipboard.writeText(pwd).then(() => {
    ElMessage.success('已生成并复制密码到剪贴板')
  }).catch(() => {
    // 复制失败没关系，明文展示在输入框中
    ElMessage.success('密码已生成')
  })
}

async function changePassword() {
  if (!passwordForm.value.password) {
    ElMessage.warning('请输入新密码')
    return
  }
  try {
    await api.put(`/admin/users/${passwordDialog.value.user.id}/password`, { password: passwordForm.value.password })
    ElMessage.success(t('admin.passwordChanged'))
    passwordDialog.value.visible = false
  } catch (e) { ElMessage.error(e?.error || '修改失败') }
}

async function toggleStatus(row, val) {
  try {
    await api.put(`/admin/users/${row.id}/status`, { status: val ? 1 : 0 })
    row.status = val ? 1 : 0
    ElMessage.success(val ? t('admin.enableUser') : t('admin.disableUser'))
  } catch (e) { ElMessage.error(e?.error || '操作失败') }
}

function deleteUser(row) {
  ElMessageBox.confirm(`${t('admin.confirmDeleteUser')} "${row.username}"？`, t('common.tip'), {
    confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning'
  }).then(async () => {
    try {
      await api.delete(`/admin/users/${row.id}`)
      ElMessage.success(t('admin.deleted'))
      loadUsers()
    } catch (e) { ElMessage.error(e?.error || '删除失败') }
  }).catch(() => {})
}

onMounted(loadUsers)
</script>

<style scoped>
.admin-note {
  display: flex;
  align-items: center;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left { display: flex; gap: 8px; align-items: center; }
.search-input { width: 260px; }
.table-wrap { overflow: hidden; }
.pagination-wrap { display: flex; justify-content: flex-end; padding: 16px 0; }

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .toolbar-left {
    flex-wrap: wrap;
  }
  .search-input {
    width: 100% !important;
    min-width: 0 !important;
  }
  .toolbar-right {
    width: 100%;
  }
  .toolbar-right .el-button {
    width: 100%;
  }
  .admin-note {
    font-size: 0.85rem !important;
  }
}

.password-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.password-row .el-input {
  flex: 1;
}
.password-tip {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
