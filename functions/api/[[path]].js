// Cloudflare Pages Functions - API 路由
// 所有 /api/* 请求由此处理，绑定 D1 数据库

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

// UTF-8 安全的 base64（解决中文 nickname 问题）
function b64e(s) { return btoa(unescape(encodeURIComponent(s))) }
function b64d(s) { return decodeURIComponent(escape(atob(s))) }
function b64bytes(u8) { return btoa(String.fromCharCode(...u8)) }

// JWT
async function createJWT(payload, secret) {
  const h = b64e(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const b = b64e(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+604800 }))
  const s = await hmac(h+'.'+b, secret)
  return h+'.'+b+'.'+s
}
async function verifyJWT(token, secret) {
  try {
    const p = token.split('.'); if(p.length!==3) return null
    if((await hmac(p[0]+'.'+p[1], secret))!==p[2]) return null
    const d = JSON.parse(b64d(p[1]))
    if(d.exp && d.exp<Math.floor(Date.now()/1000)) return null
    return d
  } catch{return null}
}
async function hmac(data, key) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
  return b64bytes(new Uint8Array(s)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')
}
async function hashPw(p) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p))
  return 'sha256$'+b64bytes(new Uint8Array(h))
}
async function verifyPw(p, h) {
  if(!h.startsWith('sha256$')) return false
  const i = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p))
  return 'sha256$'+b64bytes(new Uint8Array(i)) === h
}
function makeLinks(f, origin = '') {
  if(!f) return {}
  const base = origin + '/api/files/' + f.id
  return {
    url: base+'/download', raw_url: base+'/raw', thumbnail_url: base+'/thumbnail',
    markdown: `![${f.original_name||''}](${base}/download)`,
    html: `<img src="${base}/download" alt="${f.original_name||''}" />`,
    bbcode: `[img]${base}/download[/img]`
  }
}

export async function onRequest(ctx) {
  const { request, env } = ctx
  const url = new URL(request.url), path = url.pathname, method = request.method
  const origin = url.origin

  // 安全：生产环境不暴露调试信息
  if(path==='/api/debug' || path==='/api/test-login') {
    return json({error:'调试接口已关闭'},404)
  }

  if(method==='OPTIONS') return new Response(null,{headers:corsHeaders})

  try {
    // Public
    if(path==='/api/health') return json({status:'ok',time:new Date().toISOString()})
    if(path==='/api/settings' && method==='GET') {
      const r = await env.DB.prepare('SELECT key,value FROM settings').all()
      const o = {}; for(const x of r.results) o[x.key]=x.value; delete o.tg_bot_token
      return json(o)
    }

    const token = request.headers.get('Authorization')?.split(' ')[1]
    const user = token ? await verifyJWT(token, env.JWT_SECRET||'dev') : null

    // Auth
    if(path==='/api/auth/admin/login' && method==='POST') return handleLogin(request,env)
    if(path==='/api/auth/me' && method==='GET') return handleMe(user,env)

    // Folders
    if(path==='/api/folders/tree' && method==='GET') return handleFolderTree(env,url)
    if(path==='/api/folders' && method==='GET') return handleGetFolders(env,url)
    if(path==='/api/all-folders' && method==='GET') return handleAllFolders(env,url)
    if(/^\/api\/folders\/\d+\/breadcrumb$/.test(path) && method==='GET') return handleBreadcrumb(env,path)
    if(/^\/api\/folders\/\d+$/.test(path) && method==='GET') return handleGetFolder(env,path)
    if(path==='/api/folders' && method==='POST') return handleCreateFolder(request,env)

    // Files
    if(path==='/api/files/search' && method==='GET') return handleSearchFiles(env,url,origin)
    if(path==='/api/files/upload' && method==='POST') return handleUpload(request,env,user)
    if(/^\/api\/files\/\d+\/raw$/.test(path) && method==='GET') return handleFileServe(env,path,request)
    if(/^\/api\/files\/\d+\/download$/.test(path) && method==='GET') return handleFileServe(env,path,request)
    if(/^\/api\/files\/\d+\/thumbnail$/.test(path) && method==='GET') return handleFileServe(env,path,request)
    if(/^\/api\/files\/\d+$/.test(path) && method==='GET') return handleGetFile(env,path,origin)
    if(path==='/api/files' && method==='GET') return handleListFiles(env,url,origin)

    // Admin (need auth)
    if(!user||!['super_admin','admin'].includes(user.role)) return json({error:'需要管理员权限',needLogin:true},401)
    if(path==='/api/admin/dashboard' && method==='GET') return handleDashboard(env)
    if(path==='/api/admin/users' && method==='GET') return handleAdminUsers(env,url)
    if(path==='/api/admin/users' && method==='POST') return handleCreateUser(request,env,user)
    if(/^\/api\/admin\/users\/\d+\/status$/.test(path) && method==='PUT') return handleUserStatus(request,env,user)
    if(/^\/api\/admin\/users\/\d+\/password$/.test(path) && method==='PUT') return handleUserPassword(request,env,path,user)
    if(/^\/api\/admin\/users\/\d+$/.test(path) && method==='DELETE') return handleDeleteUser(env,path,user)
    if(path==='/api/admin/files' && method==='GET') return handleAdminFiles(env,url)
    if(/^\/api\/admin\/files\/\d+\/rename$/.test(path) && method==='PUT') return handleRenameFile(request,env,path)
    if(/^\/api\/admin\/files\/\d+$/.test(path) && method==='DELETE') return handleAdminDeleteFile(env,path)
    if(path==='/api/admin/files/batch-delete' && method==='POST') return handleAdminBatchDelete(request,env)
    if(path==='/api/admin/logs' && method==='GET') return handleAdminLogs(env,url)
    if(path==='/api/admin/settings' && method==='GET') return handleAdminSettings(env)
    if(path==='/api/admin/settings' && method==='PUT') return handleUpdateSettings(request,env)
    if(path==='/api/admin/test-telegram' && method==='POST') return handleTestTelegram(request)
    if(/^\/api\/admin\/folders\/\d+\/private$/.test(path) && method==='PUT') return handleToggleFolderPrivate(request,env,path)
    if(/^\/api\/admin\/folders\/\d+\/rename$/.test(path) && method==='PUT') return handleRenameFolder(request,env,path)
    if(/^\/api\/admin\/folders\/\d+$/.test(path) && method==='DELETE') return handleAdminDeleteFolder(env,path)

    return json({error:'接口不存在'},404)
  } catch(e) {
    console.error('API Error:', e)
    return json({error:'服务器内部错误',detail:e.message},500)
  }
}

// ─── Handlers ───

async function handleLogin(req, env) {
  try {
    const body = await req.json()
    const {username,password} = body
    if(!username||!password) return json({error:'请输入用户名和密码'},400)
    const ADMIN_USER = env.ADMIN_USERNAME || 'admin'
    let u = await env.DB.prepare("SELECT * FROM users WHERE username=? AND role IN('super_admin','admin')").bind(username).first()
    if(!u) {
      if(username===ADMIN_USER && password===env.ADMIN_PASSWORD) {
        const h = await hashPw(password)
        await env.DB.prepare("INSERT INTO users(username,password,nickname,role) VALUES(?,?,?,'super_admin')").bind(username,h,'超级管理员').run()
        u = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first()
      } else return json({error:'用户名或密码错误'},401)
    } else {
      const ok = await verifyPw(password, u.password)
      if(!ok) {
        if(password===env.ADMIN_PASSWORD && username===ADMIN_USER) {
          const h = await hashPw(password)
          await env.DB.prepare("UPDATE users SET password=?, updated_at=datetime('now') WHERE id=?").bind(h,u.id).run()
        } else return json({error:'用户名或密码错误'},401)
      }
    }
    const t = await createJWT({id:u.id,username:u.username,role:u.role,nickname:u.nickname||''}, env.JWT_SECRET||'dev')
    return json({token:t,user:{id:u.id,username:u.username,nickname:u.nickname,role:u.role}})
  } catch(e) {
    return json({error:'登录失败',detail:e.message,stack:e.stack},500)
  }
}

async function handleMe(user, env) {
  if(!user) return json({error:'未登录',needLogin:true},401)
  const u = await env.DB.prepare('SELECT id,username,nickname,role,status,created_at FROM users WHERE id=?').bind(user.id).first()
  return json(u)
}

async function handleFolderTree(env, url) {
  const {results:f} = await env.DB.prepare("SELECT * FROM folders WHERE name!='root' ORDER BY name").all()
  const m={},t=[]; f.forEach(x=>{m[x.id]={...x,children:[]}})
  f.forEach(x=>{if(x.parent_id&&m[x.parent_id]) m[x.parent_id].children.push(m[x.id]); else if(x.name!=='root') t.push(m[x.id])})
  return json(t)
}

async function handleGetFolders(env, url) {
  const pid = url.searchParams.get('parent_id')
  const {results:f} = await env.DB.prepare("SELECT f.*,(SELECT COUNT(*)FROM files WHERE folder_id=f.id)as file_count FROM folders f WHERE f.parent_id IS ? AND f.name!='root' ORDER BY f.name").bind(pid||null).all()
  return json(f)
}

async function handleGetFolder(env, path) {
  const id = path.match(/\/folders\/(\d+)/)[1]
  const f = await env.DB.prepare('SELECT * FROM folders WHERE id=?').bind(id).first()
  if(!f) return json({error:'文件夹不存在'},404)
  let p=null; if(f.parent_id) p=await env.DB.prepare('SELECT id,name FROM folders WHERE id=?').bind(f.parent_id).first()
  return json({...f,parent:p})
}

async function handleBreadcrumb(env, path) {
  let id = parseInt(path.match(/\/folders\/(\d+)/)[1]), c=[]
  while(id) {
    const f = await env.DB.prepare('SELECT id,name,parent_id FROM folders WHERE id=?').bind(id).first()
    if(!f) break; c.unshift({id:f.id,name:f.name}); id=f.parent_id
  }
  return json(c)
}

async function handleCreateFolder(req, env) {
  const b = await req.json()
  if(!b.name?.trim()) return json({error:'请输入文件夹名称'},400)
  const e = await env.DB.prepare('SELECT id FROM folders WHERE name=? AND parent_id IS ?').bind(b.name.trim(),b.parent_id||null).first()
  if(e) return json({error:'同名文件夹已存在'},409)
  const r = await env.DB.prepare('INSERT INTO folders(name,parent_id,is_private,description) VALUES(?,?,?,?)').bind(b.name.trim(),b.parent_id||null,b.is_private?1:0,b.description||'').run()
  const f = await env.DB.prepare('SELECT * FROM folders WHERE id=?').bind(r.meta.last_row_id).first()
  return json(f)
}

async function handleAllFolders(env, url) {
  // 返回所有文件夹含文件数
  const {results:f} = await env.DB.prepare(
    "SELECT f.*,(SELECT COUNT(*)FROM files WHERE folder_id=f.id)as file_count FROM folders f WHERE f.name!='root' ORDER BY f.name"
  ).all()
  return json(f)
}

async function handleListFiles(env, url, origin) {
  const fid = url.searchParams.get('folder_id'), pg = parseInt(url.searchParams.get('page')||'1'), ps = parseInt(url.searchParams.get('page_size')||'24')
  const sort = url.searchParams.get('sort')||'created_at', ord = url.searchParams.get('order')||'desc'
  const admin = url.searchParams.get('admin'), off = (pg-1)*ps

  // 非管理员禁止访问私密文件夹
  if(fid && admin!=='1') {
    const f = await env.DB.prepare('SELECT is_private FROM folders WHERE id=?').bind(fid).first()
    if(f?.is_private) return json({error:'私密文件夹',files:[],pagination:{page:1,page_size:ps,total:0,total_pages:0}})
  }

  let w = admin==='1'?'1=1':'f.is_private=0', p=[]
  if(fid){w+=' AND f.folder_id=?'; p.push(fid)}
  const sf = ['created_at','name','size'].includes(sort)?sort:'created_at'
  const so = ord==='asc'?'ASC':'DESC'
  const total = (await env.DB.prepare(`SELECT COUNT(*)as total FROM files f WHERE ${w}`).bind(...p).first())?.total||0
  const {results:files} = await env.DB.prepare(`SELECT f.*,u.nickname as uploader_name,u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id=u.id WHERE ${w} ORDER BY f.${sf} ${so} LIMIT ? OFFSET ?`).bind(...p,ps,off).all()
  return json({files:files.map(f=>({...f,...makeLinks(f, origin)})),pagination:{page:pg,page_size:ps,total,total_pages:Math.ceil(total/ps)}})
}

async function handleSearchFiles(env, url, origin) {
  const q = url.searchParams.get('q')
  if(!q?.trim()) return json({files:[],pagination:{page:1,page_size:24,total:0,total_pages:0}})
  const pg = parseInt(url.searchParams.get('page')||'1'), ps = parseInt(url.searchParams.get('page_size')||'24'), off = (pg-1)*ps
  const kw = `%${q.trim()}%`
  const total = (await env.DB.prepare('SELECT COUNT(*)as total FROM files WHERE is_private=0 AND(name LIKE? OR original_name LIKE?)').bind(kw,kw).first())?.total||0
  const {results:files} = await env.DB.prepare(`SELECT f.*,u.nickname as uploader_name,u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id=u.id WHERE f.is_private=0 AND(f.name LIKE? OR f.original_name LIKE?) ORDER BY f.created_at DESC LIMIT ? OFFSET ?`).bind(kw,kw,ps,off).all()
  return json({files:files.map(f=>({...f,...makeLinks(f, origin)})),pagination:{page:pg,page_size:ps,total,total_pages:Math.ceil(total/ps)}})
}

async function handleGetFile(env, path, origin) {
  const id = path.match(/\/files\/(\d+)/)[1]
  const f = await env.DB.prepare('SELECT f.*,u.nickname as uploader_name,u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id=u.id WHERE f.id=?').bind(id).first()
  if(!f) return json({error:'文件不存在'},404)
  return json({...f,...makeLinks(f, origin)})
}

async function handleUpload(req, env, user) {
  const fd = await req.formData()
  const origin = req.url ? new URL(req.url).origin : ''
  const fid = fd.get('folder_id'), priv = fd.get('is_private'), ip = req.headers.get('CF-Connecting-IP')||''
  const files = []; for(const[,v]of fd){if(v instanceof File) files.push(v)}
  if(!files.length) return json({error:'未选择文件'},400)
  // 文件大小限制
  for(const f of files) {
    if(f.size > 50*1024*1024) return json({error:'文件超过 50MB 限制'},413)
  }

  if(!user) {
    const a = await env.DB.prepare("SELECT value FROM settings WHERE key='allow_anonymous_upload'").first()
    if(a?.value!=='1') return json({error:'暂未开放匿名上传'},403)
  }

  // IP 限速：同一 IP 最近 1 小时内最多上传 50 次
  if(!user) { // 匿名用户限速
    const recent = await env.DB.prepare("SELECT COUNT(*) as c FROM files WHERE uploader_ip=? AND created_at > datetime('now','-1 hour')").bind(ip).first()
    if(recent?.c >= 50) return json({error:'上传过于频繁，请稍后再试'},429)
  }

  // 读取 TG 配置
  const tk = (await env.DB.prepare("SELECT value FROM settings WHERE key='tg_bot_token'").first())?.value
  const cid = (await env.DB.prepare("SELECT value FROM settings WHERE key='tg_chat_id'").first())?.value
  const en = (await env.DB.prepare("SELECT value FROM settings WHERE key='tg_enabled'").first())?.value
  const tgOk = !!(tk && cid && en==='1')

  let tp = parseInt(priv)||0
  if(fid) { const f=await env.DB.prepare('SELECT is_private FROM folders WHERE id=?').bind(fid).first(); if(f) tp=f.is_private }

  const results = []
  for(const file of files) {
    const ext = '.'+(file.name.split('.').pop()||'').toLowerCase(), ua = req.headers.get('User-Agent')||'', un = user?.username||''
    let tgFileId = ''

    // 上传到 Telegram（如果已配置）
    if(tgOk) {
      try {
        const buf = await file.arrayBuffer()
        const tgForm = new FormData()
        tgForm.append('chat_id', cid)
        const blob = new Blob([buf], {type: file.type})
        tgForm.append('document', blob, file.name)
        const tgR = await fetch(`https://api.telegram.org/bot${tk}/sendDocument`, {method:'POST', body: tgForm})
        const tgJ = await tgR.json()
        if(tgJ.ok && tgJ.result?.document) {
          tgFileId = tgJ.result.document.file_id
        }
      } catch(e) { /* TG upload failed, save without tg_file_id */ }
    }

    // 只写入 files 表（不写 upload_logs：每次上传省 1 次 D1 写入）
    const r = await env.DB.prepare('INSERT INTO files(name,original_name,tg_file_id,size,mime_type,ext,folder_id,is_private,uploader_ip,uploader_id) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(file.name, file.name, tgFileId, file.size, file.type, ext, fid||null, tp, ip, user?.id||null).run()
    const id = r.meta.last_row_id
    // upload_logs
    const ref = req.headers.get('Referer')||''
    await env.DB.prepare('INSERT INTO upload_logs(file_id,file_name,file_size,mime_type,folder_id,uploader_ip,uploader_id,username,user_agent,referer,action) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,file.name,file.size,file.type,fid||null,ip,user?.id||null,user?.username||'',ua,ref,'upload').run()
    results.push({id,name:file.name,original_name:file.name,size:file.size,mime_type:file.type,tg_synced:!!tgFileId,...makeLinks({id,original_name:file.name}, origin)})
  }
  return json({files:results,count:results.length})
}

async function handleFileServe(env, path, req) {
  const id = path.match(/\/files\/(\d+)/)[1]
  const file = await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(id).first()
  if(!file) return json({error:'文件不存在'},404)

  if(!file.tg_file_id) return json({error:'文件不可用'},404)

  // 读取 TG Token
  const tk = (await env.DB.prepare("SELECT value FROM settings WHERE key='tg_bot_token'").first())?.value
  if(!tk) return json({error:'TG 未配置'},404)

  try {
    // 获取 Telegram 文件下载链接
    const r = await fetch(`https://api.telegram.org/bot${tk}/getFile?file_id=${file.tg_file_id}`)
    const j = await r.json()
    if(!j.ok || !j.result?.file_path) return json({error:'TG 文件不可用'},404)

    // 从 Telegram 拉取文件并代理回客户端（不走重定向）
    const tgUrl = `https://api.telegram.org/file/bot${tk}/${j.result.file_path}`
    const tgResp = await fetch(tgUrl)

    // 判断是下载还是预览
    const isDownload = path.endsWith('/download')
    const encodedName = encodeURIComponent(file.original_name || 'file')

    // 流式返回 + 永久缓存头 → Cloudflare 边缘缓存
    return new Response(tgResp.body, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': isDownload
          ? `attachment; filename*=UTF-8''${encodedName}`
          : `inline; filename*=UTF-8''${encodedName}`,
      }
    })
  } catch(e) {
    return json({error:'文件下载失败'},500)
  }
}

async function handleDashboard(env) {
  const tf = (await env.DB.prepare('SELECT COUNT(*)as c FROM files').first())?.c||0
  const ts = (await env.DB.prepare('SELECT COALESCE(SUM(size),0)as t FROM files').first())?.t||0
  const tu = (await env.DB.prepare('SELECT COUNT(*)as c FROM users').first())?.c||0
  const tfo = (await env.DB.prepare('SELECT COUNT(*)as c FROM folders').first())?.c||0
  const td = (await env.DB.prepare("SELECT COUNT(*)as c FROM files WHERE date(created_at)=date('now')").first())?.c||0
  const {results:w} = await env.DB.prepare("SELECT date(created_at)as date,COUNT(*)as c FROM files WHERE created_at>=date('now','-7 days') GROUP BY date ORDER BY date").all()
  const {results:ty} = await env.DB.prepare(`SELECT CASE WHEN mime_type LIKE 'image/%' THEN '图片' WHEN mime_type LIKE 'video/%' THEN '视频' WHEN mime_type LIKE 'audio/%' THEN '音频' ELSE '其他' END as type,COUNT(*)as c FROM files GROUP BY type ORDER BY c DESC`).all()
  return json({totalFiles:tf,totalSize:ts,totalUsers:tu,totalFolders:tfo,todayUploads:td,weeklyUploads:w.map(x=>({date:x.date,count:x.c})),typeDistribution:ty.map(x=>({type:x.type,count:x.c}))})
}

async function handleAdminUsers(env, url) {
  const pg = parseInt(url.searchParams.get('page')||'1'), ps = parseInt(url.searchParams.get('page_size')||'20'), kw = url.searchParams.get('keyword')||'', off = (pg-1)*ps
  let w='1=1',p=[]; if(kw){w+=' AND(username LIKE? OR nickname LIKE?)'; p.push(`%${kw}%`,`%${kw}%`)}
  const total = (await env.DB.prepare(`SELECT COUNT(*)as c FROM users WHERE ${w}`).bind(...p).first())?.c||0
  const {results:users}=await env.DB.prepare(`SELECT id,username,nickname,role,status,created_at FROM users WHERE ${w} ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,created_at DESC LIMIT ? OFFSET ?`).bind(...p,ps,off).all()
  return json({users,pagination:{page:pg,page_size:ps,total,total_pages:Math.ceil(total/ps)}})
}

async function handleCreateUser(req, env, cu) {
  if(cu.role!=='super_admin') return json({error:'仅超级管理员可执行此操作'},403)
  const b=await req.json(); if(!b.username||!b.password) return json({error:'请输入用户名和密码'},400)
  const e=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(b.username).first()
  if(e) return json({error:'用户名已存在'},409)
  const h=await hashPw(b.password); const r=b.role==='super_admin'?'admin':(b.role||'admin')
  await env.DB.prepare('INSERT INTO users(username,password,nickname,role) VALUES(?,?,?,?)').bind(b.username,h,b.nickname||b.username,r).run()
  return json({message:'创建成功'})
}

async function handleUserStatus(req, env, cu) {
  if(cu.role!=='super_admin') return json({error:'仅超级管理员可执行此操作'},403)
  const id=(new URL(req.url)).pathname.match(/\/users\/(\d+)/)[1]
  const t=await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(id).first()
  if(!t) return json({error:'用户不存在'},404); if(t.role==='super_admin') return json({error:'不能修改超级管理员状态'},400)
  const b=await req.json()
  await env.DB.prepare("UPDATE users SET status=?,updated_at=datetime('now') WHERE id=?").bind(b.status?1:0,id).run()
  return json({message:'更新成功'})
}

async function handleUserPassword(req, env, path, cu) {
  try {
    const id=parseInt(path.match(/\/users\/(\d+)/)[1])
    if(!id) return json({error:'用户ID无效'},400)
    if(cu.role!=='super_admin'&&id!==cu.id) return json({error:'无权修改'},403)
    const b=await req.json()
    if(!b.password||b.password.length<4) return json({error:'密码至少4位'},400)
    const h=await hashPw(b.password)
    const r=await env.DB.prepare("UPDATE users SET password=?,updated_at=datetime('now') WHERE id=?").bind(h,id).run()
    if(r.success!==false) return json({message:'密码已更新'})
    return json({error:'数据库写入失败'},500)
  } catch(e) {
    return json({error:'修改密码失败',detail:e.message},500)
  }
}

async function handleDeleteUser(env, path, cu) {
  if(cu.role!=='super_admin') return json({error:'仅超级管理员可执行此操作'},403)
  const id=parseInt(path.match(/\/users\/(\d+)/)[1])
  if(id===cu.id) return json({error:'不能删除自己'},400)
  const t=await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(id).first()
  if(!t) return json({error:'用户不存在'},404); if(t.role==='super_admin') return json({error:'不能删除其他超级管理员'},400)
  await env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run()
  return json({message:'已删除'})
}

async function handleAdminFiles(env, url) {
  const pg=parseInt(url.searchParams.get('page')||'1'),ps=parseInt(url.searchParams.get('page_size')||'20'),kw=url.searchParams.get('keyword')||'',off=(pg-1)*ps
  let w='1=1',p=[]; if(kw){w+=' AND(f.name LIKE? OR f.original_name LIKE?)'; p.push(`%${kw}%`,`%${kw}%`)}
  const total=(await env.DB.prepare(`SELECT COUNT(*)as c FROM files f WHERE ${w}`).bind(...p).first())?.c||0
  const {results:files}=await env.DB.prepare(`SELECT f.*,u.nickname as uploader_name,u.username as uploader_username,fo.name as folder_name FROM files f LEFT JOIN users u ON f.uploader_id=u.id LEFT JOIN folders fo ON f.folder_id=fo.id WHERE ${w} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`).bind(...p,ps,off).all()
  return json({files,pagination:{page:pg,page_size:ps,total,total_pages:Math.ceil(total/ps)}})
}

async function handleAdminDeleteFile(env, path) {
  const id=path.match(/\/files\/(\d+)/)[1]
  const f=await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(id).first()
  if(!f) return json({error:'文件不存在'},404)
  await env.DB.prepare('DELETE FROM files WHERE id=?').bind(id).run()
  return json({message:'已删除'})
}

async function handleAdminBatchDelete(req, env) {
  const{ids}=await req.json()
  if(!ids?.length) return json({error:'请选择文件'},400)
  for(const id of ids) await env.DB.prepare('DELETE FROM files WHERE id=?').bind(id).run()
  return json({message:`已删除 ${ids.length} 个文件`})
}

async function handleAdminLogs(env, url) {
  const pg=parseInt(url.searchParams.get('page')||'1'),ps=parseInt(url.searchParams.get('page_size')||'30'),ip=url.searchParams.get('ip')||'',un=url.searchParams.get('username')||'',off=(pg-1)*ps
  let w='1=1',p=[]; if(ip){w+=' AND l.uploader_ip LIKE?'; p.push(`%${ip}%`)} if(un){w+=' AND l.username LIKE?'; p.push(`%${un}%`)}
  const total=(await env.DB.prepare(`SELECT COUNT(*)as c FROM upload_logs l WHERE ${w}`).bind(...p).first())?.c||0
  const {results:logs}=await env.DB.prepare(`SELECT l.*,f.name as file_stored_name,fo.name as folder_name FROM upload_logs l LEFT JOIN files f ON l.file_id=f.id LEFT JOIN folders fo ON l.folder_id=fo.id WHERE ${w} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).bind(...p,ps,off).all()
  return json({logs,pagination:{page:pg,page_size:ps,total,total_pages:Math.ceil(total/ps)}})
}

async function handleAdminSettings(env) {
  const{results:r}=await env.DB.prepare('SELECT * FROM settings').all()
  const o={}; for(const x of r) o[x.key]=x.value
  if(o.tg_bot_token) o.tg_bot_token_masked=o.tg_bot_token.substring(0,4)+'****'+o.tg_bot_token.substring(o.tg_bot_token.length-4)
  return json(o)
}

async function handleUpdateSettings(req, env) {
  const b=await req.json()
  for(const[k,v]of Object.entries(b)){
    if(k.endsWith('_masked')) continue
    await env.DB.prepare("INSERT INTO settings(key,value)VALUES(?,?) ON CONFLICT(key)DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(k,v).run()
  }
  return json({message:'设置已更新'})
}

async function handleTestTelegram(req) {
  try {
    const {tg_bot_token, tg_chat_id} = await req.json()
    if(!tg_bot_token||!tg_chat_id) return json({error:'请提供 Token 和 Chat ID'},400)
    const meR = await fetch(`https://api.telegram.org/bot${tg_bot_token}/getMe`)
    const me = await meR.json()
    if(!me.ok) return json({success:false,error:'Bot Token 无效'})
    const msgR = await fetch(`https://api.telegram.org/bot${tg_bot_token}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:tg_chat_id,text:'Cloud Drive test ok!'})
    })
    const msg = await msgR.json()
    if(msg.ok) return json({success:true,bot:me.result})
    return json({success:false,error:'无法发送消息到该频道，请确保 Bot 是管理员'})
  } catch(e) { return json({success:false,error:e.message}) }
}

async function handleRenameFile(req, env, path) {
  const id = path.match(/\/files\/(\d+)/)[1]
  const b = await req.json()
  if(!b.name?.trim()) return json({error:'请输入名称'},400)
  await env.DB.prepare("UPDATE files SET original_name=?, name=? WHERE id=?").bind(b.name.trim(), b.name.trim(), id).run()
  return json({message:'已重命名'})
}

async function handleRenameFolder(req, env, path) {
  const id = path.match(/\/folders\/(\d+)/)[1]
  const b = await req.json()
  if(!b.name?.trim()) return json({error:'请输入名称'},400)
  await env.DB.prepare('UPDATE folders SET name=? WHERE id=?').bind(b.name.trim(), id).run()
  return json({message:'已重命名'})
}

async function handleToggleFolderPrivate(req, env, path) {
  const id = parseInt(path.match(/\/folders\/(\d+)/)[1])
  const b = await req.json()
  await env.DB.prepare('UPDATE folders SET is_private=? WHERE id=?').bind(b.is_private ? 1 : 0, id).run()
  return json({message:'已更新'})
}

async function handleAdminDeleteFolder(env, path) {
  const id=parseInt(path.match(/\/folders\/(\d+)/)[1])
  const ch=(await env.DB.prepare('SELECT COUNT(*)as c FROM folders WHERE parent_id=?').bind(id).first())?.c||0
  if(ch>0) return json({error:'请先删除子文件夹'},400)
  const fc=(await env.DB.prepare('SELECT COUNT(*)as c FROM files WHERE folder_id=?').bind(id).first())?.c||0
  if(fc>0) return json({error:'文件夹非空'},400)
  await env.DB.prepare('DELETE FROM folders WHERE id=?').bind(id).run()
  return json({message:'已删除'})
}
