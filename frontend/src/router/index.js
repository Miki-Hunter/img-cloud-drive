import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Gallery from '../views/Gallery.vue'
import Search from '../views/Search.vue'
import Upload from '../views/Upload.vue'
import ImageDetail from '../views/ImageDetail.vue'
import Login from '../views/Login.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import AdminDashboard from '../views/admin/Dashboard.vue'
import AdminFiles from '../views/admin/Files.vue'
import AdminUsers from '../views/admin/Users.vue'
import AdminLogs from '../views/admin/Logs.vue'
import AdminSettings from '../views/admin/Settings.vue'
import AdminFolders from '../views/admin/Folders.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/gallery', name: 'Gallery', component: Gallery },
  { path: '/gallery/:folderId', name: 'Folder', component: Gallery },
  { path: '/search', name: 'Search', component: Search },
  { path: '/upload', name: 'Upload', component: Upload },
  { path: '/file/:id', name: 'ImageDetail', component: ImageDetail },
  { path: '/login', name: 'Login', component: Login },
  {
    path: '/admin',
    component: AdminLayout,
    redirect: '/admin/dashboard',
    children: [
      { path: 'dashboard', name: 'AdminDashboard', component: AdminDashboard },
      { path: 'files', name: 'AdminFiles', component: AdminFiles },
      { path: 'folders', name: 'AdminFolders', component: AdminFolders },
      { path: 'users', name: 'AdminUsers', component: AdminUsers },
      { path: 'logs', name: 'AdminLogs', component: AdminLogs },
      { path: 'settings', name: 'AdminSettings', component: AdminSettings }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 管理后台鉴权
router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/admin')) {
    const token = localStorage.getItem('token')
    if (!token) {
      next('/login')
      return
    }
  }
  next()
})

export default router
