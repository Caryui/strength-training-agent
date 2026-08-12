import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';
import { useUserProfile } from './hooks/useUserProfile';
import { useCheckins } from './hooks/useCheckins';
import { generatePlan } from '../server/planGenerator';
import { PermissionMode, Message, Session, CheckinEntry } from './types';
import { MessagePlugin } from 'tdesign-react';
import { buildSeedProfile, buildSeedCheckins, seedSummary } from './data/excelSeed';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SettingsPage } from './components/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { CheckinPage } from './pages/CheckinPage';
import { ProfileDialog } from './components/ProfileDialog';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/chat/:sessionId" element={<AppContent />} />
      <Route path="/settings" element={<AppContent />} />
      <Route path="/checkin" element={<AppContent />} />
    </Routes>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const isCheckinPage = location.pathname === '/checkin';
  
  // Hooks
  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();
  const { profile, log, saveProfile, addLogEntry, deleteLogEntry } = useUserProfile();

  // 训练打卡（浏览器本地持久化 + 引擎直驱 RPE 调节，无需后端）
  const {
    checkins,
    advice,
    prescription,
    phases,
    loading: checkinLoading,
    fetchPrescription,
    addCheckin,
    deleteCheckin,
    bulkImport,
    syncProfile,
  } = useCheckins(profile);

  // 个人档案弹窗
  const [profileVisible, setProfileVisible] = useState(false);

  // 聊天 Hook
  const {
    isLoading,
    inputValue,
    setInputValue,
    permissionRequest,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
    userProfile: profile,
    trainingLog: log,
  });

  // 获取当前会话的 Agent
  const currentAgent = currentSession?.agentId ? getAgent(currentSession.agentId) : getAgent('default');

  // 从 URL 同步 sessionId
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (!urlSessionId && !isSettingsPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isSettingsPage, currentSessionId, setCurrentSessionId]);

  // 当切换会话时，恢复该会话的模型选择
  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  // 初始加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 更新当前会话的模型
  const updateCurrentSessionModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    if (currentSessionId) {
      updateSessionModel(currentSessionId, modelId);
    }
  }, [currentSessionId, updateSessionModel, setSelectedModel]);

  // 本地生成训练计划（由浏览器内引擎直接计算，无需后端 / 鉴权）
  const generatePlanOffline = useCallback(async (opts: { mode: 'program' | 'weekly' | 'rpe'; phase?: string; startWeek?: number }) => {
    try {
      const modeLabel =
        opts.mode === 'program' ? '完整周期化' : opts.mode === 'weekly' ? '本周' : 'RPE 调整';
      const markdown: string = generatePlan(profile as any, checkins as any, {
        mode: opts.mode,
        phase: (opts.phase as any) || 'auto',
        startWeek: opts.startWeek || 1,
      });
      const now = Date.now();
      const sessionId = 'off_' + now;
      const userMessage: Message = {
        id: 'u_' + now,
        role: 'user',
        content: `请生成${modeLabel}训练计划`,
        timestamp: new Date(),
        isStreaming: false,
      };
      const assistantMessage: Message = {
        id: 'a_' + now,
        role: 'assistant',
        content: markdown,
        model: 'offline-engine',
        timestamp: new Date(),
        isStreaming: false,
      };
      const newSession: Session = {
        id: sessionId,
        title: `${modeLabel}训练计划`,
        model: 'offline',
        createdAt: new Date(),
        messages: [userMessage, assistantMessage],
      };
      addSession(newSession);
      navigate(`/chat/${sessionId}`);
    } catch (e: any) {
      console.error('生成计划失败:', e);
      MessagePlugin.error('生成计划失败：' + (e?.message || e));
    }
  }, [profile, checkins, addSession, navigate]);

  // 删除会话处理
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const navigateTo = await deleteSession(sessionId);
    if (navigateTo) {
      navigate(navigateTo);
    }
  }, [deleteSession, navigate]);

  // 侧边栏状态：桌面默认展开；移动端默认收起（抽屉式遮罩）
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true),
  );
  // 移动端：导航后自动收起侧边栏抽屉
  const closeSidebarIfMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  // 侧边栏事件处理
  const handleNewChat = useCallback(() => {
    closeSidebarIfMobile();
    setCurrentSessionId(null);
    navigate('/');
  }, [navigate, setCurrentSessionId, closeSidebarIfMobile]);

  const handleSelectSession = useCallback((sessionId: string) => {
    closeSidebarIfMobile();
    setCurrentSessionId(sessionId);
    navigate(`/chat/${sessionId}`);
  }, [navigate, setCurrentSessionId, closeSidebarIfMobile]);

  const handleOpenSettings = useCallback(() => {
    closeSidebarIfMobile();
    navigate('/settings');
  }, [navigate, closeSidebarIfMobile]);

  const handleOpenCheckin = useCallback(() => {
    closeSidebarIfMobile();
    navigate('/checkin');
  }, [navigate, closeSidebarIfMobile]);

  // 把 Excel 真实数据回填进档案：四大项 1RM + TX 锚点 + 三个周期全量记录
  const handleImportSeed = useCallback(async () => {
    try {
      const seedProfile = buildSeedProfile();
      // 1) 写入前端档案（localStorage + 触发 UI 更新）
      saveProfile(seedProfile);
      // 2) 持久化到服务端，供处方 / 计划生成使用
      await syncProfile(seedProfile);
      // 3) 全量回填三个周期的真实打卡记录（replace=true）
      await bulkImport(buildSeedCheckins(), true);
      const sum = seedSummary();
      MessagePlugin.success(
        `已回填 Excel 真实数据：${sum.records} 条记录（${sum.sessions} 场 · ${sum.from}~${sum.to}），四大项 1RM 与 TX 锚点已写入档案`
      );
    } catch (e: any) {
      MessagePlugin.error('回填失败：' + (e?.message || e));
    }
  }, [saveProfile, syncProfile, bulkImport]);

  // 权限模式状态
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');

  // 后端连通性检测：后端未启动时生成计划/RPE 调节会失败，提前给出明确提示
  const [backendOk, setBackendOk] = useState<boolean>(true);
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const r = await fetch('/api/health', { method: 'GET' });
        if (!alive) return;
        setBackendOk(r.ok);
      } catch {
        if (alive) setBackendOk(false);
      }
    };
    ping();
    const t = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div 
      className="flex h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      {/* 侧边栏 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isSettingsPage={isSettingsPage}
        isCheckinPage={isCheckinPage}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={handleOpenSettings}
        onOpenCheckin={handleOpenCheckin}
      />

      {/* 主内容区 */}
      <main 
        className="flex-1 flex flex-col min-w-0"
        style={{ backgroundColor: 'var(--td-bg-color-page)' }}
      >
        {/* 顶部栏 */}
        <Header
          isSettingsPage={isSettingsPage}
          sidebarOpen={sidebarOpen}
          theme={theme}
          currentSession={currentSession}
          currentAgent={currentAgent}
          models={models}
          userProfile={profile}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          onRefreshModels={fetchModels}
          onOpenProfile={() => setProfileVisible(true)}
        />

        {/* 后端未连接提示（仅 AI 教练对话需要后端；核心功能已本地化） */}
        {!backendOk && !isCheckinPage && (
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--td-warning-color-1, #fff7e6)',
              color: 'var(--td-warning-color-7, #d46b08)',
              borderBottom: '1px solid var(--td-warning-color-3, #ffd591)',
              fontSize: 13,
            }}
          >
            ℹ️ AI 教练对话需要连接本地后端（在该项目目录运行 <code>npm run dev</code>）。而「周期化计划 / 训练打卡 / RPE 自动调节」已全部在浏览器本地运行，离线可用——这也是它能被打包成静态网页直接分享的原因。
          </div>
        )}

        {/* 训练打卡页 / 设置页面 / 聊天页面 */}
        {isCheckinPage ? (
          <CheckinPage
            profile={profile}
            checkins={checkins}
            advice={advice}
            prescription={prescription}
            phases={phases}
            loading={checkinLoading}
            onFetchPrescription={fetchPrescription}
            onAddCheckin={addCheckin}
            onDeleteCheckin={deleteCheckin}
            onImportSeed={handleImportSeed}
          />
        ) : isSettingsPage ? (
          <SettingsPage
            agents={agents}
            onAdd={addAgent}
            onUpdate={updateAgent}
            onDelete={deleteAgent}
          />
        ) : (
          <ChatPage
            currentSession={currentSession}
            models={models}
            selectedModel={selectedModel}
            agents={agents}
            isLoading={isLoading}
            inputValue={inputValue}
            permissionRequest={permissionRequest}
            permissionMode={permissionMode}
            userProfile={profile}
            onSendMessage={sendMessage}
            onGeneratePlan={generatePlanOffline}
            onStop={handleStop}
            onInputChange={setInputValue}
            onModelChange={updateCurrentSessionModel}
            onPermissionAllow={handlePermissionAllow}
            onPermissionDeny={handlePermissionDeny}
            onPermissionModeChange={setPermissionMode}
            onOpenProfile={() => setProfileVisible(true)}
          />
        )}
      </main>

      {/* 移动端侧边栏遮罩（仅 sm 以下显示） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 个人档案弹窗 */}
      <ProfileDialog
        visible={profileVisible}
        profile={profile}
        log={log}
        onClose={() => setProfileVisible(false)}
        onSaveProfile={saveProfile}
        onAddLog={addLogEntry}
        onDeleteLog={deleteLogEntry}
        onImportSeed={handleImportSeed}
      />
    </div>
  );
}

export default App;
