import { useState, useRef, useCallback } from 'react';
import type { UserLocation } from './use-location';
import type { NoteFeature, TrackStats } from '@/lib/feature-store';
import { haversineDistance, type Position } from '@/lib/geo-utils';

/** 同一地点のノイズを捨てる最小移動距離（メートル） */
const MIN_MOVE_DISTANCE_M = 2;

export interface RecordingState {
  isRecording: boolean;
  /** 記録中の座標列 [lng, lat] */
  coords: Position[];
  /** 記録中の累積距離（メートル） */
  distanceM: number;
  /** 記録開始時刻（ms） */
  startTime: number | null;
}

/**
 * GPSトラック記録フック。
 * 呼び出し側が位置情報の更新ごとに addPoint() を呼ぶことで座標を蓄積する。
 */
export function useTrackRecorder() {
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    coords: [],
    distanceM: 0,
    startTime: null,
  });
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  const start = useCallback(() => {
    setRecording({
      isRecording: true,
      coords: [],
      distanceM: 0,
      startTime: Date.now(),
    });
  }, []);

  const addPoint = useCallback((location: UserLocation) => {
    const state = recordingRef.current;
    if (!state.isRecording) return;

    const point: Position = [location.longitude, location.latitude];
    const last = state.coords[state.coords.length - 1];
    if (last) {
      const d = haversineDistance(last, point);
      if (d < MIN_MOVE_DISTANCE_M) return;
      setRecording({
        ...state,
        coords: [...state.coords, point],
        distanceM: state.distanceM + d,
      });
    } else {
      setRecording({ ...state, coords: [point] });
    }
  }, []);

  /** 記録を終了し、保存可能なトラックFeatureを返す（点が足りなければnull） */
  const stop = useCallback((): NoteFeature | null => {
    const state = recordingRef.current;
    setRecording({ isRecording: false, coords: [], distanceM: 0, startTime: null });

    if (!state.isRecording || state.coords.length < 2 || state.startTime == null) {
      return null;
    }

    const now = Date.now();
    const stats: TrackStats = {
      distanceM: state.distanceM,
      durationMs: now - state.startTime,
      startTime: state.startTime,
      endTime: now,
      pointCount: state.coords.length,
    };

    return {
      id: `track-${now}`,
      type: 'track',
      name: `トラック ${new Date(state.startTime).toLocaleString('ja-JP')}`,
      description: '',
      color: '#EA4335',
      geometry: { type: 'LineString', coordinates: state.coords },
      createdAt: now,
      updatedAt: now,
      stats,
    };
  }, []);

  return { recording, start, stop, addPoint };
}
