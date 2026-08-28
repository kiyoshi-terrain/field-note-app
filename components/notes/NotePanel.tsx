import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NoteFeature } from '@/lib/feature-store';
import {
  lineLength,
  polygonArea,
  formatDistance,
  formatArea,
  formatDuration,
} from '@/lib/geo-utils';

const SIDE_PANEL_WIDTH = 360;

const TYPE_META: Record<
  NoteFeature['type'],
  { icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  waypoint: { icon: 'pin', label: 'Waypoint' },
  line: { icon: 'analytics-outline', label: 'ライン' },
  polygon: { icon: 'square-outline', label: 'ポリゴン' },
  track: { icon: 'footsteps-outline', label: 'トラック' },
};

/** 種類ごとの計測値サマリ（距離・面積・記録時間） */
function featureSummary(f: NoteFeature): string {
  switch (f.geometry.type) {
    case 'Point': {
      const [lng, lat] = f.geometry.coordinates;
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    case 'LineString': {
      const dist = formatDistance(
        f.stats ? f.stats.distanceM : lineLength(f.geometry.coordinates),
      );
      if (f.type === 'track' && f.stats) {
        return `${dist} ・ ${formatDuration(f.stats.durationMs)}`;
      }
      return dist;
    }
    case 'Polygon': {
      const ring = f.geometry.coordinates[0] ?? [];
      return `${formatArea(polygonArea(ring))} ・ 周囲 ${formatDistance(lineLength(ring))}`;
    }
  }
}

export interface NotePanelProps {
  visible: boolean;
  isWideScreen: boolean;
  topInset: number;
  bottomInset: number;
  features: NoteFeature[];
  /** ノートIDごとの添付写真枚数 */
  photoCounts?: Record<string, number>;
  onClose: () => void;
  onZoomTo: (feature: NoteFeature) => void;
  onEdit: (feature: NoteFeature) => void;
  onDelete: (id: string) => void;
  onExportGeoJSON: () => void;
  onExportGPX: () => void;
  onImport: () => void;
}

export default function NotePanel({
  visible,
  isWideScreen,
  topInset,
  bottomInset,
  features,
  photoCounts = {},
  onClose,
  onZoomTo,
  onEdit,
  onDelete,
  onExportGeoJSON,
  onExportGPX,
  onImport,
}: NotePanelProps) {
  const content = (
    <>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>フィールドノート</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.6} hitSlop={12}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onExportGeoJSON}
          activeOpacity={0.7}
          disabled={features.length === 0}
        >
          <Ionicons name="download-outline" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>GeoJSON</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(52,168,83,0.7)' }]}
          onPress={onExportGPX}
          activeOpacity={0.7}
          disabled={features.length === 0}
        >
          <Ionicons name="download-outline" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>GPX</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(255,149,0,0.6)' }]}
          onPress={onImport}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>インポート</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: bottomInset + 16 }]}
      >
        {features.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="create-outline" size={36} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              ノートがありません。{'\n'}
              左のツールバーからWaypoint配置や{'\n'}描画・トラック記録を始めましょう。
            </Text>
          </View>
        )}

        {features.map((f) => {
          const meta = TYPE_META[f.type];
          return (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.colorDot, { backgroundColor: f.color }]}>
                  <Ionicons name={meta.icon} size={13} color="#FFF" />
                </View>

                <TouchableOpacity
                  style={styles.cardBody}
                  onPress={() => onZoomTo(f)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.cardName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {meta.label} ・ {featureSummary(f)}
                    {(photoCounts[f.id] ?? 0) > 0 && ` ・ 📷${photoCounts[f.id]}`}
                  </Text>
                  {!!f.description && (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {f.description}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onEdit(f)}
                  activeOpacity={0.6}
                  hitSlop={8}
                  style={styles.cardActionBtn}
                >
                  <Ionicons name="pencil-outline" size={18} color="#4285F4" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(f.id)}
                  activeOpacity={0.6}
                  hitSlop={8}
                  style={styles.cardActionBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );

  if (isWideScreen) {
    if (!visible) return null;
    return (
      <View style={[styles.sidePanel, { top: topInset, bottom: bottomInset }]}>
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: topInset }]}>{content}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sidePanel: {
    position: 'absolute',
    right: 0,
    width: SIDE_PANEL_WIDTH,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    ...({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object),
    zIndex: 30,
    boxShadow: '-2px 0px 16px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    ...({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object),
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    padding: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 10,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardMeta: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  cardDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  cardActionBtn: {
    padding: 6,
  },
});
