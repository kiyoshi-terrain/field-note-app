import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ModelAnnotation } from '@/lib/model-store';
import type { ModelViewerProps } from './model-viewer-types';

/** モデルの最大辺をこの長さに正規化する（アノテーション座標を再現可能にするため固定） */
const NORMALIZED_SIZE = 2;
/** ドラッグとタップの判定しきい値（px） */
const TAP_SLOP = 6;

interface PinScreenPos {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * GLB/glTFを表示し、モデル表面のタップ位置にアノテーションを打つビューア。
 *
 * モデルはバウンディングボックスから決まる固定の正規化（原点中心・最大辺2）を
 * 毎回適用するので、保存したワールド座標がそのまま次回も同じ場所を指す。
 */
export default function ModelViewer({
  visible,
  model,
  onClose,
  onAnnotationsChange,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef(0);

  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 追加待ちの点（タイトル入力中）
  const [pendingPos, setPendingPos] = useState<[number, number, number] | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ピンのDOM要素を保持し、描画ループ内で直接動かす（再レンダリングを避ける）
  const pinRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const annotationsRef = useRef<ModelAnnotation[]>([]);
  annotationsRef.current = annotations;

  useEffect(() => {
    if (visible && model) {
      setAnnotations(model.annotations ?? []);
      setSelectedId(null);
      setPendingPos(null);
    }
  }, [visible, model]);

  // ─── three.js セットアップ ───
  useEffect(() => {
    if (!visible || !model || !containerRef.current) return;

    const container = containerRef.current;
    const pins = pinRefs.current;
    let disposed = false;
    const objectUrl = URL.createObjectURL(model.blob);

    setLoading(true);
    setError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#15181c');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      1000,
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    new GLTFLoader().load(
      objectUrl,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        // 原点中心・最大辺 NORMALIZED_SIZE に正規化（毎回同じ変換になる）
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = NORMALIZED_SIZE / maxDim;
        root.position.sub(center);
        root.scale.setScalar(scale);
        root.position.multiplyScalar(scale);

        scene.add(root);
        modelRootRef.current = root;

        const dist = NORMALIZED_SIZE * 1.8;
        camera.position.set(dist * 0.6, dist * 0.5, dist);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        setLoading(false);
      },
      undefined,
      (e) => {
        console.error('Failed to load model:', e);
        if (!disposed) {
          setError('モデルを読み込めませんでした（GLB / glTF に対応）');
          setLoading(false);
        }
      },
    );

    // ─── 描画ループ：ピンの画面位置を更新 ───
    const projected = new THREE.Vector3();
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);

      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const a of annotationsRef.current) {
        const el = pinRefs.current.get(a.id);
        if (!el) continue;
        projected.set(a.position[0], a.position[1], a.position[2]).project(camera);
        const behind = projected.z > 1;
        el.style.display = behind ? 'none' : 'block';
        if (!behind) {
          el.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * w}px, ${((-projected.y + 1) / 2) * h}px)`;
        }
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!container.clientWidth) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      URL.revokeObjectURL(objectUrl);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      modelRootRef.current = null;
      pins.clear();
    };
  }, [visible, model]);

  // ─── タップでアノテーション追加（ドラッグは無視） ───
  useEffect(() => {
    const container = containerRef.current;
    if (!visible || !container) return;

    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_SLOP) return;
      const camera = cameraRef.current;
      const root = modelRootRef.current;
      if (!camera || !root) return;

      const rect = container.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(root, true);
      if (hits.length === 0) return;

      const p = hits[0].point;
      setSelectedId(null);
      setPendingPos([p.x, p.y, p.z]);
      setDraftTitle('');
      setDraftDesc('');
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
    };
  }, [visible]);

  const commitPending = useCallback(() => {
    if (!pendingPos || !model) return;
    const title = draftTitle.trim();
    if (!title) return;

    const next: ModelAnnotation[] = [
      ...annotations,
      {
        id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        position: pendingPos,
        title,
        description: draftDesc.trim(),
        createdAt: Date.now(),
      },
    ];
    setAnnotations(next);
    onAnnotationsChange(model.id, next);
    setPendingPos(null);
  }, [pendingPos, draftTitle, draftDesc, annotations, model, onAnnotationsChange]);

  const removeAnnotation = useCallback((id: string) => {
    if (!model) return;
    const next = annotations.filter((a) => a.id !== id);
    setAnnotations(next);
    onAnnotationsChange(model.id, next);
    setSelectedId(null);
  }, [annotations, model, onAnnotationsChange]);

  if (!visible || !model) return null;

  const selected = annotations.find((a) => a.id === selectedId) ?? null;

  return (
    <View style={styles.overlay}>
      {/* 3Dキャンバス */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* アノテーションピン */}
      {annotations.map((a, i) => (
        <div
          key={a.id}
          ref={(el) => { pinRefs.current.set(a.id, el); }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(a.id === selectedId ? null : a.id);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 26,
            height: 26,
            borderRadius: 13,
            background: a.id === selectedId ? '#FBBC04' : '#EA4335',
            color: '#FFF',
            border: '2px solid #FFF',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            display: 'none',
            font: '600 13px system-ui, sans-serif',
            lineHeight: '22px',
            textAlign: 'center',
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          {i + 1}
        </div>
      ))}

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{model.name}</Text>
        <Text style={styles.count}>アノテーション {annotations.length}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* 操作ヒント */}
      {!loading && !error && !pendingPos && !selected && (
        <View style={styles.hint}>
          <Ionicons name="hand-left-outline" size={14} color="#FFF" />
          <Text style={styles.hintText}>ドラッグで回転 ・ モデルをタップして所見を追加</Text>
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.centerText}>読み込み中…</Text>
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color="#FF6B6B" />
          <Text style={styles.centerText}>{error}</Text>
        </View>
      )}

      {/* 選択中アノテーションの詳細 */}
      {selected && (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>
            #{annotations.findIndex((a) => a.id === selected.id) + 1}  {selected.title}
          </Text>
          {!!selected.description && (
            <Text style={styles.detailDesc}>{selected.description}</Text>
          )}
          <View style={styles.detailActions}>
            <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.btn} activeOpacity={0.7}>
              <Text style={styles.btnTextCancel}>閉じる</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeAnnotation(selected.id)}
              style={[styles.btn, styles.btnDanger]}
              activeOpacity={0.7}
            >
              <Text style={styles.btnTextPrimary}>削除</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 新規アノテーション入力 */}
      {pendingPos && (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>アノテーション #{annotations.length + 1}</Text>
          <TextInput
            style={styles.input}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="タイトル（例: 剥落 / ひび割れ）"
            placeholderTextColor="#999"
            autoFocus
            onSubmitEditing={commitPending}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={draftDesc}
            onChangeText={setDraftDesc}
            placeholder="所見（任意）"
            placeholderTextColor="#999"
            multiline
          />
          <View style={styles.detailActions}>
            <TouchableOpacity onPress={() => setPendingPos(null)} style={styles.btn} activeOpacity={0.7}>
              <Text style={styles.btnTextCancel}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={commitPending}
              style={[styles.btn, styles.btnPrimary, !draftTitle.trim() && styles.btnDisabled]}
              activeOpacity={0.7}
              disabled={!draftTitle.trim()}
            >
              <Text style={styles.btnTextPrimary}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#15181c',
    zIndex: 400,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  title: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  count: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  hintText: {
    color: '#FFF',
    fontSize: 12,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  centerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  detailCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.4)',
    elevation: 10,
    zIndex: 20,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
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
    marginBottom: 8,
  },
  inputMultiline: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimary: {
    backgroundColor: '#4285F4',
  },
  btnDanger: {
    backgroundColor: '#EA4335',
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
});
