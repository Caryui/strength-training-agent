import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import {
  generatePlan,
  adviseNextSession,
  getDayPrescription,
  listPhases,
  listSplit,
} from "./planGenerator.js";

const execAsync = promisify(exec);

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "hy3";

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 登录方式类型
type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string; // 脱敏后的 API Key
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  // 1. 检查环境变量
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    // 脱敏显示
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) {
      response.envVars!.internetEnv = internetEnv;
    }
    if (baseUrl) {
      response.envVars!.baseUrl = baseUrl;
    }
  }
  
  // 2. 使用 unstable_v2_authenticate 检查登录状态（更可靠）
  try {
    let needsLogin = false;

    const authPromise = unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        // 如果执行到这个回调，说明未登录
        needsLogin = true;
        console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
        // 将认证 URL 返回给前端（如果需要）
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });

    // 加超时，避免未登录时 SDK 一直阻塞（初始化超时）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('登录检测超时')), 8000);
    });

    const result = await Promise.race([authPromise, timeoutPromise]);

    // 如果没有触发 onAuthUrl 回调，说明已登录
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;

      // 判断登录方式
      if (response.envConfigured) {
        response.method = 'env';
      } else {
        response.method = 'cli';
      }

      console.log('[Check Login] 已登录用户:', result.userinfo.userName);
    } else if (!needsLogin) {
      // result 存在但没有 userinfo，仍然认为已登录
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    console.error("[Check Login] SDK Error:", error);

    // 如果有环境变量配置，仍然认为是登录状态
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }

  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  
  // 设置环境变量（仅在当前进程有效）
  if (apiKey) {
    process.env.CODEBUDDY_API_KEY = apiKey;
    configuredVars.push('CODEBUDDY_API_KEY');
  }
  if (authToken) {
    process.env.CODEBUDDY_AUTH_TOKEN = authToken;
    configuredVars.push('CODEBUDDY_AUTH_TOKEN');
  }
  if (internetEnv) {
    process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
    configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
  }
  if (baseUrl) {
    process.env.CODEBUDDY_BASE_URL = baseUrl;
    configuredVars.push('CODEBUDDY_BASE_URL');
  }
  
  // 清除模型缓存，以便重新获取
  cachedModels = [];
  
  res.json({ 
    success: true, 
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// 获取可用模型列表
app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      console.log("[Models] Creating session to fetch available models...");
      
      const session = await unstable_v2_createSession({ 
        cwd: process.cwd()
      });
      
      console.log("[Models] Session created, calling getAvailableModels()...");
      const models = await session.getAvailableModels();
      console.log("[Models] Got", models.length, "models");
      
      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }

    // 确保默认模型（hy3）始终在可选列表中
    const finalModels = cachedModels.some((m) => m.modelId === defaultModel)
      ? cachedModels
      : [{ modelId: defaultModel, name: "混元 3 (hy3)" }, ...cachedModels];

    res.json({
      models: finalModels.length > 0 ? finalModels : [
        { modelId: defaultModel, name: "混元 3 (hy3)" }
      ],
      defaultModel
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({
      models: [
        { modelId: "hy3", name: "混元 3 (hy3)" },
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { modelId: "claude-opus-4", name: "Claude Opus 4" }
      ],
      defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    const messages = db.getMessagesBySession(sessionId);
    
    // 解析 tool_calls JSON
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();
    
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      created_at: now,
      updated_at: now
    });
    
    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    
    const success = db.updateSession(sessionId, { title, model });
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 权限响应 API
app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  
  console.log(`[Permission] Response received: requestId=${requestId}, behavior=${behavior}`);
  
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    console.log(`[Permission] Request not found: ${requestId}`);
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  // 清除请求
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({
      behavior: 'allow',
      updatedInput: pending.input
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: message || '用户拒绝了此操作'
    });
  }
  
  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;
  
  // 请求日志
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);
  console.log(`[Chat] CWD: ${cwd || 'default'}`);

  if (!message) {
    console.log(`[Chat] 错误: 消息为空`);
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    // 创建新会话
    console.log(`[Chat] 创建新会话`);
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,  // 稍后从 SDK 获取
      created_at: now,
      updated_at: now
    });
  } else {
    console.log(`[Chat] 使用现有会话, SDK Session: ${session.sdk_session_id || 'none'}`);
  }

  const selectedModel = model || session.model;
  
  // 获取 SDK session ID（用于恢复对话）
  const sdkSessionId = session.sdk_session_id;

  // 创建用户消息 ID 和助手消息 ID
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null
    });
    console.log(`[Chat] 用户消息已保存: ${userMessageId}`);
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 默认系统提示词 —— 力量训练教练
  const defaultSystemPrompt = `你是一位资深力量训练教练，拥有运动科学和体能训练专业背景。你的核心职责：基于用户的个人基础数据、三大项极限重量（1RM）以及每次训练的 RPE 反馈，生成可量化、可随 RPE 自动调节的每周力量训练计划。

请使用 1RM 百分比换算训练负荷（85-90%→3-5次力量，75-85%→5-8次，65-75%→8-12次肌肥大），并用 RPE 标注每个主项的目标强度。生成每周计划时用 Markdown 表格，每个训练日列出动作/组数/次数/重量(占1RM%)/目标RPE/组间休息，三大项（深蹲/卧推/硬拉）必含。当用户上报实际 RPE 时，按 RPE 自主调节协议动态调整后续负荷：实测高于目标≥1档则减重2.5-5%，低于目标≥1档且技术良好则加重2.5-5%。使用 Markdown 格式输出，用表格展示训练计划。`;
  
  // 工作目录：优先使用请求中的 cwd，否则使用当前目录
  const workingDir = cwd || process.cwd();

  try {
    console.log(`[Chat] 调用 SDK query...`);
    console.log(`[Chat] - Model: ${selectedModel}`);
    console.log(`[Chat] - Resume: ${sdkSessionId || 'none'}`);
    console.log(`[Chat] - CWD: ${workingDir}`);
    console.log(`[Chat] - PermissionMode: ${permissionMode || 'default'}`);
    
    // 创建 canUseTool 回调
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      console.log(`[Permission] Tool request: ${toolName}`);
      console.log(`[Permission] Input:`, JSON.stringify(input, null, 2));
      
      // bypassPermissions 模式直接放行
      if (permissionMode === 'bypassPermissions') {
        console.log(`[Permission] Bypassing permissions for ${toolName}`);
        return { behavior: 'allow', updatedInput: input };
      }
      
      // 创建权限请求
      const requestId = uuidv4();
      const permissionRequest = {
        requestId,
        toolUseId: options.toolUseID,
        toolName,
        input,
        sessionId: session.id,
        timestamp: Date.now()
      };
      
      // 发送权限请求到前端
      res.write(`data: ${JSON.stringify({ 
        type: "permission_request", 
        ...permissionRequest
      })}\n\n`);
      
      // 创建 Promise 等待用户响应
      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve,
          reject,
          toolName,
          input,
          sessionId: session.id,
          timestamp: Date.now()
        };
        
        pendingPermissions.set(requestId, pending);
        
        // 设置超时
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            console.log(`[Permission] Request timeout: ${requestId}`);
            resolve({
              behavior: 'deny',
              message: '权限请求超时'
            });
          }
        }, PERMISSION_TIMEOUT);
      });
    };
    
    // 使用 Query API 发送消息
    // 如果有 sdk_session_id，使用 resume 恢复对话上下文
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: systemPrompt || defaultSystemPrompt,
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})  // 使用 resume 恢复对话
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ 
      id: string; 
      name: string; 
      input?: Record<string, unknown>;
      status: string; 
      result?: string;
      isError?: boolean;
    }> = [];
    let newSdkSessionId: string | null = null;  // 用于存储 SDK 返回的 session_id

    // 发送会话ID和消息ID
    res.write(`data: ${JSON.stringify({ 
      type: "init", 
      sessionId: session.id, 
      userMessageId, 
      assistantMessageId,
      model: selectedModel 
    })}\n\n`);

    // 当前正在执行的工具 ID（用于匹配 tool_result）
    let currentToolId: string | null = null;

    // 处理流式响应
    for await (const msg of stream) {
      console.log("[Stream] Message type:", msg.type, msg);
      
      // 处理 system 消息，获取 SDK 的 session_id
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        console.log(`[Stream] Got SDK session_id: ${newSdkSessionId}`);
        
        // 保存 SDK session_id 到数据库（如果是新的）
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
          console.log(`[Stream] Saved SDK session_id to database`);
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;

        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              console.log(`[Stream] Tool use: id=${currentToolId}, name=${block.name}`);
              console.log(`[Stream] Tool input:`, JSON.stringify(toolInput, null, 2));
              
              const toolCall = { 
                id: currentToolId, 
                name: block.name, 
                input: toolInput,
                status: "running" 
              };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ 
                type: "tool", 
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                status: toolCall.status
              })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        // 处理工具结果（独立的消息类型）
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        
        console.log(`[Stream] Tool result: tool_use_id=${toolId}, is_error=${isError}`);
        console.log(`[Stream] Tool result content type:`, typeof content);
        console.log(`[Stream] Tool result content:`, typeof content === 'string' ? content.slice(0, 500) : JSON.stringify(content, null, 2)?.slice(0, 500));
        
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' 
            ? content 
            : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ 
            type: "tool_result", 
            toolId: tool.id, 
            content: tool.result,
            isError: isError
          })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        // 完成时确保所有工具都标记为完成
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

    // 保存助手消息到数据库
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    // 更新会话标题（如果是第一条消息）
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, { 
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error Name:`, error?.name);
    console.error(`[Chat] Error Message:`, error?.message);
    console.error(`[Chat] Error Code:`, error?.code);
    console.error(`[Chat] Error Stack:`, error?.stack);
    console.error(`[Chat] Full Error:`, JSON.stringify(error, null, 2));
    
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// 离线生成训练计划（不依赖外部模型 / 鉴权）
app.post("/api/generate-plan", (req, res) => {
  try {
    const { profile, trainingLog, mode, phase, startWeek } = req.body || {};
    const planMode = mode === 'program' ? 'program' : mode === 'rpe' ? 'rpe' : 'weekly';

    // 档案：优先用请求体，其次回落到服务端已存档案；同时把最新档案持久化
    const storedProfile = (db.getProfile() || {}) as any;
    const effProfile = profile && Object.keys(profile).length > 0 ? profile : storedProfile;
    if (profile && Object.keys(profile).length > 0) {
      db.saveProfile(profile);
    }

    // 训练记录：服务端打卡记录是唯一真相，与请求体记录合并去重
    const stored = db.getAllCheckins();
    const incoming: any[] = Array.isArray(trainingLog) ? trainingLog : [];
    const seen = new Set(stored.map(e => e.id));
    const effLog = [...stored, ...incoming.filter(e => !e?.id || !seen.has(e.id))];

    const plan = generatePlan(effProfile || {}, effLog as any, {
      mode: planMode,
      phase: phase || effProfile?.phase || 'auto',
      startWeek: typeof startWeek === 'number' ? startWeek : 1,
    });

    const now = new Date().toISOString();
    const title = planMode === 'rpe' ? 'RPE 调整方案' : planMode === 'program' ? '周期化训练计划' : '本周训练计划';
    const session = db.createSession({
      id: uuidv4(),
      title,
      model: 'offline',
      sdk_session_id: null,
      created_at: now,
      updated_at: now,
    });

    const userText = planMode === 'rpe'
      ? '请根据我最近的训练记录（实际 RPE）调整后续训练计划。'
      : planMode === 'program'
        ? '请根据我的个人数据生成完整的周期化训练计划。'
        : '请根据我的个人数据生成本周力量训练计划。';
    const userId = uuidv4();
    const assistantId = uuidv4();

    db.createMessage({
      id: userId,
      session_id: session.id,
      role: 'user',
      content: userText,
      model: null,
      created_at: now,
      tool_calls: null,
    });
    db.createMessage({
      id: assistantId,
      session_id: session.id,
      role: 'assistant',
      content: plan,
      model: 'offline',
      created_at: now,
      tool_calls: null,
    });

    res.json({
      sessionId: session.id,
      title,
      userMessage: { id: userId, role: 'user', content: userText, timestamp: now },
      assistantMessage: { id: assistantId, role: 'assistant', content: plan, model: 'offline', timestamp: now },
    });
  } catch (error: any) {
    console.error('[Generate Plan] Error:', error);
    res.status(500).json({ error: error?.message || '生成计划失败' });
  }
});

// ============================================================================
// 训练打卡 —— 量化记录持久化 + 自动驱动 RPE 调节
// ============================================================================

/** 归一化前端传来的打卡数据 */
function normalizeCheckin(raw: any): db.DbCheckin {
  const num = (v: any): number | undefined => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && !Number.isNaN(n) ? n : undefined;
  };
  return {
    id: raw.id || uuidv4(),
    date: raw.date || new Date().toISOString().slice(0, 10),
    cycle: raw.cycle || undefined,
    phase: raw.phase || undefined,
    week: num(raw.week),
    day: raw.day || undefined,
    lift: String(raw.lift || '').trim(),
    sets: num(raw.sets),
    reps: num(raw.reps) ?? 0,
    weight: num(raw.weight) ?? 0,
    rpe: num(raw.rpe) ?? 0,
    targetRpe: num(raw.targetRpe),
    setDistribution: raw.setDistribution || undefined,
    techniqueNote: raw.techniqueNote || undefined,
    restingHR: num(raw.restingHR),
    calories: num(raw.calories),
    bodyweight: num(raw.bodyweight),
    note: raw.note || undefined,
    dateInferred: raw.dateInferred === true ? true : undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

// 读取全部打卡记录
app.get("/api/checkins", (req, res) => {
  try {
    res.json({ checkins: db.getAllCheckins() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '读取打卡记录失败' });
  }
});

// 新增一条打卡记录，并立即返回该动作的下次调节建议
app.post("/api/checkins", (req, res) => {
  try {
    const entry = normalizeCheckin(req.body || {});
    if (!entry.lift) {
      return res.status(400).json({ error: '动作名称不能为空' });
    }
    db.createCheckin(entry);
    const profile = (db.getProfile() || {}) as any;
    const all = db.getAllCheckins();
    const advice = adviseNextSession(profile, all as any, profile.phase || 'auto');
    res.json({ checkin: entry, advice, total: all.length });
  } catch (error: any) {
    console.error('[Checkin] Create error:', error);
    res.status(500).json({ error: error?.message || '保存打卡失败' });
  }
});

// 批量导入打卡记录（用于回填历史数据）
app.post("/api/checkins/bulk", (req, res) => {
  try {
    const { entries, replace } = req.body || {};
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries 必须是数组' });
    }
    if (replace) db.clearCheckins();
    const normalized = entries.map(normalizeCheckin).filter(e => e.lift);
    db.createCheckins(normalized);
    const all = db.getAllCheckins();
    res.json({ imported: normalized.length, total: all.length, checkins: all });
  } catch (error: any) {
    console.error('[Checkin] Bulk error:', error);
    res.status(500).json({ error: error?.message || '批量导入失败' });
  }
});

// 更新一条打卡记录
app.patch("/api/checkins/:id", (req, res) => {
  try {
    const updated = db.updateCheckin(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: '记录不存在' });
    res.json({ checkin: updated });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '更新失败' });
  }
});

// 删除一条打卡记录
app.delete("/api/checkins/:id", (req, res) => {
  try {
    const ok = db.deleteCheckin(req.params.id);
    if (!ok) return res.status(404).json({ error: '记录不存在' });
    res.json({ success: true, total: db.getAllCheckins().length });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '删除失败' });
  }
});

// 清空全部打卡记录
app.delete("/api/checkins", (req, res) => {
  try {
    db.clearCheckins();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '清空失败' });
  }
});

// 基于已存打卡记录计算 RPE 调节建议
app.get("/api/checkins/advice", (req, res) => {
  try {
    const profile = (db.getProfile() || {}) as any;
    const phase = (req.query.phase as string) || profile.phase || 'auto';
    const log = db.getAllCheckins();
    res.json({ advice: adviseNextSession(profile, log as any, phase as any) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '计算建议失败' });
  }
});

// 获取下一次训练的完整处方（已叠加 RPE 调节）
app.get("/api/prescription", (req, res) => {
  try {
    const profile = (db.getProfile() || {}) as any;
    const log = db.getAllCheckins();
    const phase = (req.query.phase as string) || profile.phase || 'auto';
    const week = req.query.week ? parseInt(req.query.week as string, 10) : undefined;
    const day = (req.query.day as string) || undefined;
    const prescription = getDayPrescription(profile, log as any, {
      phase: phase as any,
      week,
      day,
    });
    res.json({
      prescription,
      advice: adviseNextSession(profile, log as any, phase as any),
      phases: listPhases(),
      split: listSplit(),
    });
  } catch (error: any) {
    console.error('[Prescription] Error:', error);
    res.status(500).json({ error: error?.message || '生成处方失败' });
  }
});

// ============================================================================
// 训练档案（服务端持久化，供计划生成与打卡页共用）
// ============================================================================

app.get("/api/profile", (req, res) => {
  try {
    res.json({ profile: db.getProfile() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '读取档案失败' });
  }
});

app.put("/api/profile", (req, res) => {
  try {
    const saved = db.saveProfile(req.body || {});
    res.json({ profile: saved });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '保存档案失败' });
  }
});

// 启动服务器
const serverInstance = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

// 端口被占用（通常是有另一个实例已在运行）：不要崩溃退出，
// 直接复用已有实例，否则前端会因无后端而「生成计划失败」。
serverInstance.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️  端口 ${PORT} 已被占用（可能已有服务实例在运行）。直接复用现有实例，前端可正常访问。\n`);
    process.exit(0);
  } else {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
});
