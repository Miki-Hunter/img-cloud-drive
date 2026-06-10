/**
 * Telegram Bot 文件存储工具
 * 通过 Telegram Bot API 上传/下载文件
 *
 * 支持 HTTP 代理：在 backend/config/index.js 中设置
 *   TG_PROXY: 'http://127.0.0.1:7890'  // 本地代理
 *   TG_PROXY: 'socks5://127.0.0.1:1080' // SOCKS5 代理
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const config = require('../../config');

let proxyAgent = null;
const proxyUrl = config.TG_PROXY || process.env.TG_PROXY || '';

function getProxyAgent() {
  if (!proxyUrl) return null;
  if (proxyAgent) return proxyAgent;

  try {
    const url = new URL(proxyUrl);
    if (url.protocol === 'socks5:' || url.protocol === 'socks:') {
      // SOCKS5 需要额外的库，这里用 HttpsProxyAgent 不行
      console.warn('  ⚠️ SOCKS5 代理需要安装 socks-proxy-agent 库');
      return null;
    }
    // HTTP 代理
    if (url.protocol === 'http:') {
      return new https.Agent({ keepAlive: true, rejectUnauthorized: false });
    }
    return new https.Agent({ keepAlive: true, rejectUnauthorized: false });
  } catch (e) {
    console.warn('  ⚠️ 代理配置错误:', e.message);
    return null;
  }
}

// 带代理的 fetch
async function fetchWithProxy(url, options = {}) {
  const agent = getProxyAgent();
  if (agent) {
    // 使用代理时需要解析 URL 并通过 agent 转发
    const urlObj = new URL(url);
    options.agent = agent;
    options.host = proxyUrl.replace(/^https?:\/\//, '').split(':')[0];
    options.port = parseInt(proxyUrl.split(':').pop()) || 443;
    options.path = url;
    options.headers = { ...(options.headers || {}), Host: urlObj.host };
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)), text: () => Promise.resolve(data) }); }
          catch (e) { resolve({ ok: false, status: res.statusCode, json: () => Promise.resolve({}), text: () => Promise.resolve(data) }); }
        });
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }
  return fetch(url, options);
}

// 上传文件到 Telegram
async function uploadFile(fileBuffer, fileName, mimeType) {
  const cfg = getTgConfig();
  if (!cfg.enabled) return { success: false };

  const boundary = '----' + Date.now().toString(36);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${encodeURIComponent(fileName)}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cfg.chatId}\r\n--${boundary}--\r\n`;

  const enc = new TextEncoder();
  const bodyParts = [enc.encode(header), fileBuffer, enc.encode(footer)];
  const bodyLen = bodyParts.reduce((s, p) => s + p.byteLength, 0);

  const agent = getProxyAgent();
  const fetchOpts = {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: new Blob(bodyParts)
  };
  if (agent) fetchOpts.agent = agent;

  const resp = await fetchWithProxy(`https://api.telegram.org/bot${cfg.token}/sendDocument`, fetchOpts);
  const result = await resp.json();
  if (result.ok && result.result?.document) {
    return { success: true, file_id: result.result.document.file_id, file_unique_id: result.result.document.file_unique_id };
  }
  return { success: false, error: JSON.stringify(result) };
}

// 发送图片到 Telegram
async function uploadPhoto(fileBuffer, fileName, mimeType) {
  const cfg = getTgConfig();
  if (!cfg.enabled) return { success: false };

  const boundary = '----' + Date.now().toString(36);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${encodeURIComponent(fileName)}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cfg.chatId}\r\n--${boundary}--\r\n`;

  const enc = new TextEncoder();
  const bodyParts = [enc.encode(header), fileBuffer, enc.encode(footer)];

  const agent = getProxyAgent();
  const fetchOpts = {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: new Blob(bodyParts)
  };
  if (agent) fetchOpts.agent = agent;

  const resp = await fetchWithProxy(`https://api.telegram.org/bot${cfg.token}/sendPhoto`, fetchOpts);
  const result = await resp.json();
  if (result.ok && result.result?.photo?.length > 0) {
    const photo = result.result.photo[result.result.photo.length - 1];
    return { success: true, file_id: photo.file_id, file_unique_id: photo.file_unique_id };
  }
  return { success: false, error: JSON.stringify(result) };
}

// 获取文件下载链接
async function getFileUrl(fileId) {
  const cfg = getTgConfig();
  if (!cfg.token) return null;

  try {
    const agent = getProxyAgent();
    const fetchOpts = {};
    if (agent) fetchOpts.agent = agent;
    const resp = await fetchWithProxy(`https://api.telegram.org/bot${cfg.token}/getFile?file_id=${fileId}`, fetchOpts);
    const result = await resp.json();
    if (result.ok && result.result?.file_path) {
      return `https://api.telegram.org/file/bot${cfg.token}/${result.result.file_path}`;
    }
    return null;
  } catch { return null; }
}

// 测试 TG 连接
async function testConnection(token, chatId) {
  try {
    const agent = getProxyAgent();
    const fetchOpts = {};
    if (agent) fetchOpts.agent = agent;
    const meResp = await fetchWithProxy(`https://api.telegram.org/bot${token}/getMe`, fetchOpts);
    const me = await meResp.json();
    if (!me.ok) return { success: false, error: 'Bot Token 无效' };

    const msgOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Cloud Drive 连接测试成功！' })
    };
    if (agent) msgOpts.agent = agent;
    const msgResp = await fetchWithProxy(`https://api.telegram.org/bot${token}/sendMessage`, msgOpts);
    const msg = await msgResp.json();
    if (msg.ok) return { success: true, bot: me.result };
    return { success: false, error: '无法发送消息到该频道/群组' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 读取 TG 配置（实时从 settings 表读）
async function getTgConfig() {
  try {
    const { getOne } = require('../models/database');
    if (!getOne) return { enabled: false };
    const token = getOne("SELECT value FROM settings WHERE key = 'tg_bot_token'")?.value;
    const chatId = getOne("SELECT value FROM settings WHERE key = 'tg_chat_id'")?.value;
    const enabled = getOne("SELECT value FROM settings WHERE key = 'tg_enabled'")?.value;
    return { token, chatId, enabled: enabled === '1' && !!token && !!chatId };
  } catch { return { enabled: false }; }
}

module.exports = { uploadFile, uploadPhoto, getFileUrl, testConnection, getTgConfig };
