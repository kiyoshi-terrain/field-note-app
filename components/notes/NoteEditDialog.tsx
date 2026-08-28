import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  compressImage,
  loadPhotosForFeature,
} from '@/lib/photo-store';

export const NOTE_COLORS = [
  '#4285F4',
  '#EA4335',
  '#FBBC04',
  '#34A853',
  '#FF6D01',
  '#9C27B0',
  '#00BCD4',
  '#795548',
];

/** 保存時に親へ渡す写真の増減 */
export interface PhotoChanges {
  added: Blob[];
  deletedIds: string[];
}

interface ExistingPhoto {
  id: string;
  url: string;
}

interface AddedPhoto {
  blob: Blob;
  url: string;
}

export interface NoteEditDialogProps {
  visible: boolean;
  title: string;
  initialName: string;
  initialDescription: string;
  initialColor: string;
  /** 既存ノート編集時のID（保存済み写真の読み込みに使用）。新規作成はnull */
  featureId?: string | null;
  saveLabel?: string;
  onSave: (name: string, description: string, color: string, photos: PhotoChanges) => void;
  onCancel: () => void;
}

/** ノートの名前・説明・色・写真を編集するダイアログ（新規作成・編集で共用） */
export default function NoteEditDialog({
  visible,
  title,
  initialName,
  initialDescription,
  initialColor,
  featureId = null,
  saveLabel = '保存',
  onSave,
  onCancel,
}: NoteEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [color, setColor] = useState(initialColor);

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [addedPhotos, setAddedPhotos] = useState<AddedPhoto[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Object URLの後始末用に最新の写真リストを保持
  const urlsRef = useRef<string[]>([]);
  urlsRef.current = [
    ...existingPhotos.map((p) => p.url),
    ...addedPhotos.map((p) => p.url),
  ];

  // ダイアログが開くたびに初期値をリセットし、既存写真を読み込む
  useEffect(() => {
    if (!visible) return;

    setName(initialName);
    setDescription(initialDescription);
    setColor(initialColor);
    setAddedPhotos([]);
    setDeletedIds([]);
    setViewerUrl(null);

    let cancelled = false;
    if (featureId && Platform.OS === 'web') {
      loadPhotosForFeature(featureId)
        .then((photos) => {
          if (cancelled) return;
          setExistingPhotos(
            photos.map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob) })),
          );
        })
        .catch(console.error);
    } else {
      setExistingPhotos([]);
    }

    return () => {
      cancelled = true;
      // ダイアログを閉じるときにObject URLを解放
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    };
  }, [visible, initialName, initialDescription, initialColor, featureId]);

  const pickPhotos = useCallback((fromCamera: boolean) => {
    if (Platform.OS !== 'web') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (fromCamera) {
      // iOS Safariではネイティブのカメラ撮影UIが直接開く
      input.setAttribute('capture', 'environment');
    } else {
      input.multiple = true;
    }
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []);
      document.body.removeChild(input);
      if (files.length === 0) return;

      setProcessing(true);
      try {
        for (const file of files) {
          const blob = await compressImage(file);
          setAddedPhotos((prev) => [
            ...prev,
            { blob, url: URL.createObjectURL(blob) },
          ]);
        }
      } catch (e) {
        console.error('Failed to process photo:', e);
        alert('写真の読み込みに失敗しました');
      } finally {
        setProcessing(false);
      }
    });
    document.body.appendChild(input);
    input.click();
  }, []);

  const removeExisting = useCallback((photo: ExistingPhoto) => {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setDeletedIds((prev) => [...prev, photo.id]);
    URL.revokeObjectURL(photo.url);
  }, []);

  const removeAdded = useCallback((index: number) => {
    setAddedPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  if (!visible) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, description.trim(), color, {
      added: addedPhotos.map((p) => p.blob),
      deletedIds,
    });
  };

  const thumbnails = [
    ...existingPhotos.map((p) => ({
      key: `e-${p.id}`,
      url: p.url,
      onRemove: () => removeExisting(p),
    })),
    ...addedPhotos.map((p, i) => ({
      key: `a-${i}`,
      url: p.url,
      onRemove: () => removeAdded(i),
    })),
  ];

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>{title}</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="名前"
          placeholderTextColor="#AAA"
          autoFocus
          selectTextOnFocus
        />
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="説明（任意）"
          placeholderTextColor="#AAA"
          multiline
        />

        {/* ─── 写真 ─── */}
        {Platform.OS === 'web' && (
          <View style={styles.photoSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {thumbnails.map((t) => (
                  <View key={t.key} style={styles.thumbWrap}>
                    <TouchableOpacity
                      onPress={() => setViewerUrl(t.url)}
                      activeOpacity={0.8}
                    >
                      <img
                        src={t.url}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: 'cover',
                          borderRadius: 8,
                          display: 'block',
                        }}
                        alt=""
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={t.onRemove}
                      hitSlop={6}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.photoAddBtn}
                  onPress={() => pickPhotos(true)}
                  activeOpacity={0.7}
                  disabled={processing}
                >
                  <Ionicons name="camera-outline" size={22} color="#4285F4" />
                  <Text style={styles.photoAddLabel}>カメラ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoAddBtn}
                  onPress={() => pickPhotos(false)}
                  activeOpacity={0.7}
                  disabled={processing}
                >
                  <Ionicons name="images-outline" size={22} color="#4285F4" />
                  <Text style={styles.photoAddLabel}>ライブラリ</Text>
                </TouchableOpacity>

                {processing && (
                  <View style={styles.photoAddBtn}>
                    <ActivityIndicator size="small" color="#4285F4" />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.colorRow}>
          {NOTE_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchSelected,
              ]}
              onPress={() => setColor(c)}
              activeOpacity={0.7}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onCancel} style={styles.btn} activeOpacity={0.6}>
            <Text style={styles.btnTextCancel}>キャンセル</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.btn, styles.btnPrimary, (!name.trim() || processing) && styles.btnDisabled]}
            activeOpacity={0.6}
            disabled={!name.trim() || processing}
          >
            <Text style={styles.btnTextPrimary}>{processing ? '処理中…' : saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── フルスクリーン写真ビューア ─── */}
      {viewerUrl && (
        <TouchableOpacity
          style={styles.viewerOverlay}
          onPress={() => setViewerUrl(null)}
          activeOpacity={1}
        >
          <img
            src={viewerUrl}
            style={{
              maxWidth: '92%',
              maxHeight: '85%',
              objectFit: 'contain',
              borderRadius: 8,
            }}
            alt=""
          />
          <View style={styles.viewerCloseHint}>
            <Ionicons name="close-circle" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  box: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 340,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    elevation: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  photoSection: {
    marginBottom: 10,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAddBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#C5D5F5',
    borderStyle: 'dashed',
    backgroundColor: '#F5F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  photoAddLabel: {
    fontSize: 9,
    color: '#4285F4',
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#333',
    transform: [{ scale: 1.15 }],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimary: {
    backgroundColor: '#4285F4',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnTextCancel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  btnTextPrimary: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 300,
  },
  viewerCloseHint: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});
