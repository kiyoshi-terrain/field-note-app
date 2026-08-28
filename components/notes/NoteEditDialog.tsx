import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

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

export interface NoteEditDialogProps {
  visible: boolean;
  title: string;
  initialName: string;
  initialDescription: string;
  initialColor: string;
  saveLabel?: string;
  onSave: (name: string, description: string, color: string) => void;
  onCancel: () => void;
}

/** ノートの名前・説明・色を入力するダイアログ（新規作成・編集で共用） */
export default function NoteEditDialog({
  visible,
  title,
  initialName,
  initialDescription,
  initialColor,
  saveLabel = '保存',
  onSave,
  onCancel,
}: NoteEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [color, setColor] = useState(initialColor);

  // ダイアログが開くたびに初期値をリセット
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
      setColor(initialColor);
    }
  }, [visible, initialName, initialDescription, initialColor]);

  if (!visible) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, description.trim(), color);
  };

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
            style={[styles.btn, styles.btnPrimary, !name.trim() && styles.btnDisabled]}
            activeOpacity={0.6}
            disabled={!name.trim()}
          >
            <Text style={styles.btnTextPrimary}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
});
