import { useState, useEffect, useCallback } from 'react';
import { Model } from '../types';

const STORAGE_KEY = 'defaultModel';
// 旧的硬编码默认值：若缓存仍是它（或已失效），应回退到后端声明的默认模型
const PREVIOUS_DEFAULT = 'claude-sonnet-4';

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      setModels(data.models || []);
      if (data.models?.length > 0) {
        const savedDefault = localStorage.getItem(STORAGE_KEY);
        const current = selectedModel || savedDefault || '';
        const currentValid = current && data.models.some((m: Model) => m.modelId === current);
        const backendDefault = data.defaultModel && data.models.some((m: Model) => m.modelId === data.defaultModel)
          ? data.defaultModel
          : data.models[0].modelId;
        // 当前模型有效且非旧的默认值 → 保留用户选择；否则回退到后端默认模型（hy3）
        const modelToUse = (currentValid && current !== PREVIOUS_DEFAULT) ? current : backendDefault;
        setSelectedModel(modelToUse);
        localStorage.setItem(STORAGE_KEY, modelToUse);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }, [selectedModel]);

  // 初始加载
  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };
}
