import type { ModelAnnotation, StoredModel } from '@/lib/model-store';

export interface ModelViewerProps {
  visible: boolean;
  /** 表示するモデル（nullなら何も描画しない） */
  model: StoredModel | null;
  onClose: () => void;
  /** アノテーション追加・削除のたびに呼ばれる */
  onAnnotationsChange: (modelId: string, annotations: ModelAnnotation[]) => void;
}
