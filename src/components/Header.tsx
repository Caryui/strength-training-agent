import { Button, Tooltip, Tag } from 'tdesign-react';
import { 
  RefreshIcon,
  SunnyIcon,
  MoonIcon,
  MenuFoldIcon,
  MenuUnfoldIcon,
  UserIcon,
} from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Model, Session, Agent, Theme, UserProfile } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface HeaderProps {
  isSettingsPage: boolean;
  sidebarOpen: boolean;
  theme: Theme;
  currentSession: Session | undefined;
  currentAgent: Agent | undefined;
  models: Model[];
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onRefreshModels: () => void;
  onOpenProfile: () => void;
}

export function Header({
  isSettingsPage,
  sidebarOpen,
  theme,
  currentSession,
  currentAgent,
  models,
  userProfile,
  onToggleSidebar,
  onToggleTheme,
  onRefreshModels,
  onOpenProfile,
}: HeaderProps) {
  const formatModelName = (modelId: string) => {
    const model = models.find(m => m.modelId === modelId);
    const name = model?.name || modelId;
    return name
      .replace(/^(Claude|GPT|Gemini|Kimi|DeepSeek|Qwen|GLM)\s*/i, '')
      .replace(/-/g, ' ')
      .trim() || name;
  };

  return (
    <header 
      className="h-14 flex justify-between items-center px-4 flex-shrink-0"
      style={{ 
        backgroundColor: 'var(--td-bg-color-page)'
      }}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="text"
          shape="circle"
          icon={sidebarOpen ? <MenuFoldIcon /> : <MenuUnfoldIcon />}
          onClick={onToggleSidebar}
        />
        {!isSettingsPage && currentAgent && (
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: currentAgent.color || 'var(--td-brand-color)' }}
          >
            {(() => {
              const Icon = ICON_MAP[currentAgent.icon || 'Bot'] || Bot;
              return <Icon size={14} color="white" />;
            })()}
          </div>
        )}
        <h1 
          className="text-base font-semibold"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          {isSettingsPage ? '设置' : (currentSession?.title || APP_CONFIG.name)}
        </h1>
        {!isSettingsPage && currentSession && (
          <Tag size="small" variant="outline">
            {formatModelName(currentSession.model)}
          </Tag>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Tooltip content={userProfile && (userProfile.squat1RM || userProfile.bench1RM || userProfile.deadlift1RM) ? '个人档案已设置' : '设置个人档案'}>
          <Button
            variant="outline"
            shape="circle"
            icon={<UserIcon />}
            onClick={onOpenProfile}
            style={userProfile && (userProfile.squat1RM || userProfile.bench1RM || userProfile.deadlift1RM)
              ? { color: 'var(--td-brand-color)', borderColor: 'var(--td-brand-color)' }
              : undefined}
          />
        </Tooltip>
        <Tooltip content={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
          <Button
            variant="outline"
            shape="circle"
            icon={theme === 'light' ? <MoonIcon /> : <SunnyIcon />}
            onClick={onToggleTheme}
          />
        </Tooltip>
        {!isSettingsPage && (
          <Tooltip content="刷新模型列表">
            <Button
              variant="outline"
              shape="circle"
              icon={<RefreshIcon />}
              onClick={onRefreshModels}
            />
          </Tooltip>
        )}
      </div>
    </header>
  );
}
