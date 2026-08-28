import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DrawMode } from '@/components/map/types';

export interface DrawToolbarProps {
  bottomInset: number;
  activeMode: DrawMode | null;
  isRecording: boolean;
  notesOpen: boolean;
  hasNotes: boolean;
  onSelectMode: (mode: DrawMode) => void;
  onToggleRecord: () => void;
  onToggleNotes: () => void;
}

const DRAW_BUTTONS: { mode: DrawMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'point', icon: 'pin' },
  { mode: 'linestring', icon: 'analytics-outline' },
  { mode: 'polygon', icon: 'square-outline' },
];

/** 地図左下の描画・記録・ノート一覧ツールバー */
export default function DrawToolbar({
  bottomInset,
  activeMode,
  isRecording,
  notesOpen,
  hasNotes,
  onSelectMode,
  onToggleRecord,
  onToggleNotes,
}: DrawToolbarProps) {
  return (
    <View style={[styles.toolbar, { bottom: bottomInset + 24 }]}>
      <TouchableOpacity
        style={[styles.button, notesOpen && styles.buttonActive]}
        onPress={onToggleNotes}
        activeOpacity={0.7}
      >
        <Ionicons
          name="reader-outline"
          size={22}
          color={notesOpen || hasNotes ? '#34A853' : '#4285F4'}
        />
      </TouchableOpacity>

      <View style={styles.divider} />

      {DRAW_BUTTONS.map(({ mode, icon }) => (
        <TouchableOpacity
          key={mode}
          style={[styles.button, activeMode === mode && styles.buttonActive]}
          onPress={() => onSelectMode(mode)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={icon}
            size={22}
            color={activeMode === mode ? '#FFFFFF' : '#4285F4'}
          />
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonRecording]}
        onPress={onToggleRecord}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'radio-button-on'}
          size={22}
          color={isRecording ? '#FFFFFF' : '#EA4335'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    left: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
    alignItems: 'center',
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.25)',
    elevation: 4,
    zIndex: 10,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#4285F4',
  },
  buttonRecording: {
    backgroundColor: '#EA4335',
  },
  divider: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 2,
  },
});
