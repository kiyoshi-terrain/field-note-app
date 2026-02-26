import { useRef, useEffect, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView from '@/components/map/MapView';
import type { MapViewHandle, TileSource, OverlayInfo, OverlayGroup } from '@/components/map/types';
import { useLocation } from '@/hooks/use-location';
import {
  saveOverlay,
  loadAllOverlays,
  deleteOverlay as deleteOverlayFromDB,
  updateOverlayOpacity,
  updateOverlayVisibility,
  updateOverlayGroup,
  updateOverlayFilename,
  saveGroup,
  loadAllGroups,
  deleteGroup as deleteGroupFromDB,
} from '@/lib/overlay-store';
import {
  initGoogleAuth,
  signIn as googleSignIn,
  signOut as googleSignOut,
  isSignedIn as googleIsSignedIn,
  getUser,
  listPMTilesFiles,
  downloadPMTiles,
  uploadPMTiles,
  uploadMetadata,
  downloadMetadata,
  type DriveUser,
  type SyncMetadata,
} from '@/lib/google-drive';

const TILE_SOURCE_OPTIONS: { id: TileSource; label: string }[] = [
  { id: 'osm', label: 'OSM' },
  { id: 'gsi-pale', label: '地理院 淡色' },
  { id: 'gsi-photo', label: '地理院 航空写真' },
  { id: 'gsi-hillshade', label: '地理院 陰影起伏' },
  { id: 'pmtiles', label: 'PMTiles ベクター' },
];

const DEFAULT_GROUP: OverlayGroup = {
  id: 'default',
  name: '未分類',
  expanded: true,
  order: 9999,
};

const SIDE_PANEL_WIDTH = 360;
const WIDE_SCREEN_BREAKPOINT = 768;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth >= WIDE_SCREEN_BREAKPOINT;

  const mapRef = useRef<MapViewHandle>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tileSource, setTileSource] = useState<TileSource>('osm');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [overlayGroups, setOverlayGroups] = useState<OverlayGroup[]>([DEFAULT_GROUP]);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Group creation dialog
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Group rename dialog
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState('');

  // Overlay rename dialog
  const [renameOverlayId, setRenameOverlayId] = useState<string | null>(null);
  const [renameOverlayName, setRenameOverlayName] = useState('');

  // Group menu
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);

  // Google Drive sync
  const [googleUser, setGoogleUser] = useState<DriveUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { location, error, isLoading, getCurrentPosition } = useLocation({
    enabled: true,
    distanceInterval: 5,
    timeInterval: 3000,
  });

  // Send location updates to the map
  useEffect(() => {
    if (location && mapLoaded && mapRef.current) {
      mapRef.current.updateLocation(
        location.longitude,
        location.latitude,
        location.accuracy
      );
    }
  }, [location, mapLoaded]);

  // Initialise Google Identity Services
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    initGoogleAuth().catch(console.error);
  }, []);

  // Restore persisted overlays & groups when map is loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || Platform.OS !== 'web') return;

    (async () => {
      try {
        // Restore groups
        const storedGroups = await loadAllGroups();
        if (storedGroups.length > 0) {
          const hasDefault = storedGroups.some((g) => g.id === 'default');
          if (!hasDefault) {
            storedGroups.push({ ...DEFAULT_GROUP });
          }
          setOverlayGroups(storedGroups.map((g) => ({
            id: g.id,
            name: g.name,
            expanded: g.expanded,
            order: g.order,
          })));
        }

        // Restore overlays
        const stored = await loadAllOverlays();
        for (const entry of stored) {
          const blob = new Blob([entry.data], { type: 'application/octet-stream' });
          const blobUrl = URL.createObjectURL(blob);
          const info = await mapRef.current?.addRasterOverlay(entry.id, blobUrl);
          if (info) {
            info.name = entry.filename;
            info.opacity = entry.opacity;
            info.visible = entry.visible;
            info.groupId = entry.groupId;
            mapRef.current?.setOverlayOpacity(entry.id, entry.opacity);
            if (!entry.visible) {
              mapRef.current?.toggleOverlayVisibility(entry.id, false);
            }
            setOverlays((prev) => [...prev.filter((o) => o.id !== entry.id), info]);
          }
        }
      } catch (e) {
        console.error('Failed to restore overlays:', e);
      }
    })();
  }, [mapLoaded]);

  const handleLocateMe = useCallback(async () => {
    const pos = await getCurrentPosition();
    if (pos && mapRef.current) {
      mapRef.current.flyToLocation(pos.longitude, pos.latitude, 16);
    }
  }, [getCurrentPosition]);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleToggleLayerMenu = useCallback(() => {
    setShowLayerMenu((prev) => !prev);
  }, []);

  const handleSelectTileSource = useCallback((source: TileSource) => {
    setTileSource(source);
    mapRef.current?.setTileSource(source);
    setShowLayerMenu(false);
  }, []);

  // ─── Overlay handlers ──────────────────────────────────

  const handleAddOverlay = useCallback(() => {
    if (Platform.OS === 'web') {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pmtiles';
        input.multiple = true;
        input.style.display = 'none';
        input.addEventListener('change', async (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length === 0) return;

          // Build set of existing IDs to skip duplicates (query IndexedDB for fresh data)
          const stored = await loadAllOverlays();
          const existingIds = new Set(stored.map((o) => o.id));

          for (const file of files) {
            try {
              const id = file.name.replace(/\.pmtiles$/i, '');

              if (existingIds.has(id)) {
                console.warn(`Overlay "${id}" already exists, skipping`);
                continue;
              }

              const arrayBuffer = await file.arrayBuffer();
              const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
              const blobUrl = URL.createObjectURL(blob);

              const info = await mapRef.current?.addRasterOverlay(id, blobUrl);
              if (info) {
                info.name = file.name.replace(/\.pmtiles$/i, '');
                info.opacity = 0.8;
                info.visible = true;
                info.groupId = 'default';
                setOverlays((prev) => [...prev.filter((o) => o.id !== id), info]);
                saveOverlay(id, info.name, arrayBuffer, 0.8, true, 'default').catch(console.error);
                existingIds.add(id);
                // Auto-upload to Google Drive if signed in
                if (googleIsSignedIn()) {
                  uploadPMTiles(file.name, arrayBuffer).catch((err) =>
                    console.error('Drive auto-upload failed:', err),
                  );
                }
              }
            } catch (err) {
              console.error(`Failed to add overlay: ${file.name}`, err);
            }
          }
          input.value = '';
        });
        document.body.appendChild(input);
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  }, []);

  const handleRemoveOverlay = useCallback((id: string) => {
    mapRef.current?.removeRasterOverlay(id);
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    deleteOverlayFromDB(id).catch(console.error);
  }, []);

  const handleOverlayOpacityChange = useCallback((id: string, opacity: number) => {
    mapRef.current?.setOverlayOpacity(id, opacity);
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, opacity } : o))
    );
    updateOverlayOpacity(id, opacity).catch(console.error);
  }, []);

  const handleToggleOverlayVisibility = useCallback((id: string) => {
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const newVisible = !o.visible;
          mapRef.current?.toggleOverlayVisibility(id, newVisible);
          updateOverlayVisibility(id, newVisible).catch(console.error);
          return { ...o, visible: newVisible };
        }
        return o;
      })
    );
  }, []);

  const handleFitToOverlay = useCallback((overlay: OverlayInfo) => {
    mapRef.current?.fitToBounds(overlay.bounds);
    // On mobile, close the panel after jumping. On desktop, keep it open.
    if (!isWideScreen) {
      setShowLayerPanel(false);
    }
  }, [isWideScreen]);

  // ─── Group handlers ────────────────────────────────────

  const handleToggleGroupExpanded = useCallback((groupId: string) => {
    setOverlayGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const updated = { ...g, expanded: !g.expanded };
          saveGroup({ id: updated.id, name: updated.name, expanded: updated.expanded, order: updated.order }).catch(console.error);
          return updated;
        }
        return g;
      })
    );
  }, []);

  const handleCreateGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;

    const id = `group-${Date.now()}`;
    const maxOrder = Math.max(0, ...overlayGroups.filter((g) => g.id !== 'default').map((g) => g.order));
    const newGroup: OverlayGroup = {
      id,
      name,
      expanded: true,
      order: maxOrder + 1,
    };

    setOverlayGroups((prev) => {
      const withoutDefault = prev.filter((g) => g.id !== 'default');
      const defaultGroup = prev.find((g) => g.id === 'default') ?? DEFAULT_GROUP;
      return [...withoutDefault, newGroup, defaultGroup];
    });
    saveGroup({ id: newGroup.id, name: newGroup.name, expanded: true, order: newGroup.order }).catch(console.error);
    setNewGroupName('');
    setShowGroupDialog(false);
  }, [newGroupName, overlayGroups]);

  const handleRenameGroup = useCallback(() => {
    if (!renameGroupId) return;
    const name = renameGroupName.trim();
    if (!name) return;

    setOverlayGroups((prev) =>
      prev.map((g) => {
        if (g.id === renameGroupId) {
          const updated = { ...g, name };
          saveGroup({ id: updated.id, name: updated.name, expanded: updated.expanded, order: updated.order }).catch(console.error);
          return updated;
        }
        return g;
      })
    );
    setRenameGroupId(null);
    setRenameGroupName('');
  }, [renameGroupId, renameGroupName]);

  const handleRenameOverlay = useCallback(() => {
    if (!renameOverlayId) return;
    const name = renameOverlayName.trim();
    if (!name) return;

    setOverlays((prev) =>
      prev.map((o) =>
        o.id === renameOverlayId ? { ...o, name } : o
      )
    );
    updateOverlayFilename(renameOverlayId, name).catch(console.error);
    setRenameOverlayId(null);
    setRenameOverlayName('');
  }, [renameOverlayId, renameOverlayName]);

  // ─── Google Drive handlers ──────────────────────────────

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const user = await googleSignIn();
      setGoogleUser(user);
    } catch (e) {
      console.error('Google sign-in failed:', e);
    }
  }, []);

  const handleGoogleSignOut = useCallback(() => {
    googleSignOut();
    setGoogleUser(null);
  }, []);

  const handleSync = useCallback(async () => {
    if (!googleIsSignedIn() || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('同期中...');

    try {
      // 1. Get remote file list & metadata
      const remoteFiles = await listPMTilesFiles();
      const remoteMeta = await downloadMetadata();

      // 2. Get local overlays
      const localOverlays = await loadAllOverlays();
      const localGroups = await loadAllGroups();

      // Build lookup maps
      const remoteByName = new Map(remoteFiles.map((f) => [f.name, f]));
      const localByName = new Map(localOverlays.map((o) => [o.filename + '.pmtiles', o]));
      // Metadata lookup for driveFileId
      const metaByFilename = new Map(
        (remoteMeta?.overlays || []).map((m) => [m.filename, m]),
      );

      let uploaded = 0;
      let downloaded = 0;

      // 3. Upload local files that aren't on Drive
      for (const local of localOverlays) {
        const driveFilename = local.filename + '.pmtiles';
        if (!remoteByName.has(driveFilename)) {
          setSyncMessage(`アップロード中: ${local.filename}`);
          await uploadPMTiles(driveFilename, local.data);
          uploaded++;
        }
      }

      // 4. Download remote files that aren't local
      const freshRemoteFiles = uploaded > 0 ? await listPMTilesFiles() : remoteFiles;
      for (const remote of freshRemoteFiles) {
        const localName = remote.name.replace(/\.pmtiles$/i, '');
        if (!localByName.has(remote.name)) {
          setSyncMessage(`ダウンロード中: ${localName}`);
          const data = await downloadPMTiles(remote.id);

          // Save to IndexedDB
          const meta = metaByFilename.get(localName);
          await saveOverlay(
            localName,
            localName,
            data,
            meta?.opacity ?? 0.8,
            meta?.visible ?? true,
            meta?.groupId ?? 'default',
          );

          // Add to map
          if (mapRef.current) {
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            const info = await mapRef.current.addRasterOverlay(localName, blobUrl);
            if (info) {
              info.name = localName;
              info.opacity = meta?.opacity ?? 0.8;
              info.visible = meta?.visible ?? true;
              info.groupId = meta?.groupId ?? 'default';
              mapRef.current.setOverlayOpacity(localName, info.opacity);
              if (!info.visible) {
                mapRef.current.toggleOverlayVisibility(localName, false);
              }
              setOverlays((prev) => [...prev.filter((o) => o.id !== localName), info]);
            }
          }

          downloaded++;
        }
      }

      // 5. Sync metadata (groups + overlay metadata)
      // Re-read current state after sync
      const finalOverlays = await loadAllOverlays();
      const finalRemoteFiles = await listPMTilesFiles();
      const remoteFileMap = new Map(finalRemoteFiles.map((f) => [f.name.replace(/\.pmtiles$/i, ''), f]));

      // Also sync groups from remote metadata
      if (remoteMeta?.groups && localGroups.length <= 1) {
        // Import remote groups if local has only default
        for (const rg of remoteMeta.groups) {
          if (rg.id !== 'default') {
            await saveGroup({ id: rg.id, name: rg.name, expanded: rg.expanded, order: rg.order });
            setOverlayGroups((prev) => {
              if (prev.some((g) => g.id === rg.id)) return prev;
              return [...prev.filter((g) => g.id !== 'default'), rg, prev.find((g) => g.id === 'default') ?? DEFAULT_GROUP];
            });
          }
        }
      }

      const syncMeta: SyncMetadata = {
        version: 1,
        overlays: finalOverlays.map((o) => ({
          id: o.id,
          filename: o.filename,
          opacity: o.opacity,
          visible: o.visible,
          groupId: o.groupId,
          driveFileId: remoteFileMap.get(o.filename)?.id ?? '',
          timestamp: o.timestamp,
        })),
        groups: (await loadAllGroups()).map((g) => ({
          id: g.id,
          name: g.name,
          expanded: g.expanded,
          order: g.order,
        })),
        lastSync: Date.now(),
      };
      await uploadMetadata(syncMeta);

      setSyncMessage(`完了！ ↑${uploaded} ↓${downloaded}`);
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncMessage('同期エラー');
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, overlayGroups]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (groupId === 'default') return;

    setOverlays((prev) =>
      prev.map((o) => {
        if (o.groupId === groupId) {
          updateOverlayGroup(o.id, 'default').catch(console.error);
          return { ...o, groupId: 'default' };
        }
        return o;
      })
    );

    setOverlayGroups((prev) => prev.filter((g) => g.id !== groupId));
    deleteGroupFromDB(groupId).catch(console.error);
    setGroupMenuId(null);
  }, []);

  const handleMoveOverlayToGroup = useCallback((overlayId: string, groupId: string) => {
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id === overlayId) {
          updateOverlayGroup(overlayId, groupId).catch(console.error);
          return { ...o, groupId };
        }
        return o;
      })
    );
  }, []);

  const formatCoord = (value: number, isLat: boolean): string => {
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}\u00B0 ${dir}`;
  };

  // ─── Sort groups: user groups first, 'default' last ───
  const sortedGroups = [...overlayGroups].sort((a, b) => {
    if (a.id === 'default') return 1;
    if (b.id === 'default') return -1;
    return a.order - b.order;
  });

  // ─── Shared panel content ─────────────────────────────
  const panelContent = (
    <>
      {/* Header */}
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>レイヤー管理</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              onPress={googleUser ? handleGoogleSignOut : handleGoogleSignIn}
              activeOpacity={0.6}
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: googleUser ? 'rgba(66,133,244,0.15)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <Ionicons
                name={googleUser ? 'person-circle' : 'logo-google'}
                size={20}
                color={googleUser ? '#4285F4' : '#FFF'}
              />
              {googleUser && (
                <Text style={{ color: '#4285F4', fontSize: 11, maxWidth: 100 }} numberOfLines={1}>
                  {googleUser.name}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowLayerPanel(false)}
            activeOpacity={0.6}
            hitSlop={12}
            style={styles.panelCloseBtn}
          >
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync message */}
      {syncMessage && (
        <View style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: isSyncing ? 'rgba(66,133,244,0.2)' : 'rgba(52,199,89,0.2)',
        }}>
          <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>
            {syncMessage}
          </Text>
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddOverlay}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFF" />
          <Text style={styles.actionButtonText}>PMTilesを追加</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => {
            setNewGroupName('');
            setShowGroupDialog(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="folder-open-outline" size={18} color="#4285F4" />
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>グループ追加</Text>
        </TouchableOpacity>
        {Platform.OS === 'web' && googleUser && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isSyncing ? 'rgba(66,133,244,0.3)' : 'rgba(66,133,244,0.6)' }]}
            onPress={handleSync}
            activeOpacity={0.7}
            disabled={isSyncing}
          >
            <Ionicons name={isSyncing ? 'sync' : 'cloud-upload-outline'} size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>{isSyncing ? '同期中...' : '同期'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={[styles.panelScrollInner, { paddingBottom: insets.bottom + 16 }]}
      >
        {sortedGroups.map((group) => {
          const groupOverlays = overlays.filter((o) => o.groupId === group.id);
          const count = groupOverlays.length;

          return (
            <View key={group.id} style={styles.groupContainer}>
              {/* Group header */}
              <View style={styles.groupHeader}>
                <TouchableOpacity
                  style={styles.groupHeaderLeft}
                  onPress={() => handleToggleGroupExpanded(group.id)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={group.expanded ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color="#666"
                  />
                  <Text style={styles.groupName}>{group.name}</Text>
                  {!group.expanded && count > 0 && (
                    <Text style={styles.groupCount}>({count}件)</Text>
                  )}
                </TouchableOpacity>
                {group.id !== 'default' && (
                  <TouchableOpacity
                    onPress={() => setGroupMenuId(groupMenuId === group.id ? null : group.id)}
                    activeOpacity={0.6}
                    hitSlop={8}
                    style={styles.groupMenuBtn}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#888" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Group context menu */}
              {groupMenuId === group.id && (
                <View style={styles.groupContextMenu}>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      setRenameGroupId(group.id);
                      setRenameGroupName(group.name);
                      setGroupMenuId(null);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#333" />
                    <Text style={styles.contextMenuText}>名前変更</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => handleDeleteGroup(group.id)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    <Text style={[styles.contextMenuText, { color: '#FF6B6B' }]}>グループ削除</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Overlay cards */}
              {group.expanded && groupOverlays.map((overlay) => (
                <View
                  key={overlay.id}
                  style={[
                    styles.overlayCard,
                    !overlay.visible && styles.overlayCardHidden,
                  ]}
                >
                  <View style={styles.overlayCardHeader}>
                    <TouchableOpacity
                      onPress={() => handleToggleOverlayVisibility(overlay.id)}
                      activeOpacity={0.6}
                      hitSlop={8}
                      style={styles.visibilityBtn}
                    >
                      <Ionicons
                        name={overlay.visible ? 'eye-outline' : 'eye-off-outline'}
                        size={22}
                        color={overlay.visible ? '#4285F4' : '#BBB'}
                      />
                    </TouchableOpacity>

                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => {
                        setRenameOverlayId(overlay.id);
                        setRenameOverlayName(overlay.name);
                      }}
                    >
                      <Text
                        style={[
                          styles.overlayName,
                          !overlay.visible && styles.overlayNameHidden,
                        ]}
                        numberOfLines={1}
                      >
                        {overlay.name}
                      </Text>
                    </Pressable>

                    <TouchableOpacity
                      onPress={() => handleFitToOverlay(overlay)}
                      activeOpacity={0.6}
                      hitSlop={8}
                      style={styles.overlayActionBtn}
                    >
                      <Ionicons name="locate-outline" size={20} color="#4285F4" />
                    </TouchableOpacity>

                    {overlayGroups.length > 1 && (
                      <MoveGroupMenu
                        overlay={overlay}
                        groups={sortedGroups}
                        onMove={handleMoveOverlayToGroup}
                      />
                    )}

                    <TouchableOpacity
                      onPress={() => handleRemoveOverlay(overlay.id)}
                      activeOpacity={0.6}
                      hitSlop={8}
                      style={styles.overlayActionBtn}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>

                  {Platform.OS === 'web' && (
                    <View style={styles.sliderRow}>
                      <Ionicons
                        name="contrast-outline"
                        size={14}
                        color={overlay.visible ? '#888' : '#CCC'}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(overlay.opacity * 100)}
                        disabled={!overlay.visible}
                        onChange={(e: any) =>
                          handleOverlayOpacityChange(overlay.id, Number(e.target.value) / 100)
                        }
                        style={{
                          flex: 1,
                          margin: '0 8px',
                          accentColor: overlay.visible ? '#4285F4' : '#CCC',
                        } as any}
                      />
                      <Text style={[styles.opacityLabel, !overlay.visible && { color: '#CCC' }]}>
                        {Math.round(overlay.opacity * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {group.expanded && count === 0 && (
                <Text style={styles.emptyGroupText}>レイヤーなし</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ─── Create group dialog ─── */}
      {showGroupDialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>新規グループ</Text>
            <TextInput
              style={styles.dialogInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="グループ名"
              placeholderTextColor="#AAA"
              autoFocus
              onSubmitEditing={handleCreateGroup}
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => setShowGroupDialog(false)}
                style={styles.dialogBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextCancel}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGroup}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextPrimary}>作成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ─── Rename group dialog ─── */}
      {renameGroupId && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>グループ名変更</Text>
            <TextInput
              style={styles.dialogInput}
              value={renameGroupName}
              onChangeText={setRenameGroupName}
              placeholder="グループ名"
              placeholderTextColor="#AAA"
              autoFocus
              onSubmitEditing={handleRenameGroup}
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => setRenameGroupId(null)}
                style={styles.dialogBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextCancel}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRenameGroup}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextPrimary}>変更</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ─── Rename overlay dialog ─── */}
      {renameOverlayId && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>レイヤー名変更</Text>
            <TextInput
              style={styles.dialogInput}
              value={renameOverlayName}
              onChangeText={setRenameOverlayName}
              placeholder="レイヤー名"
              placeholderTextColor="#AAA"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleRenameOverlay}
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => setRenameOverlayId(null)}
                style={styles.dialogBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextCancel}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRenameOverlay}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                activeOpacity={0.6}
              >
                <Text style={styles.dialogBtnTextPrimary}>変更</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        options={{
          center: [139.6917, 35.6895],
          zoom: 13,
        }}
        onMapLoaded={handleMapLoaded}
      />

      {/* Coordinate overlay bar */}
      {location && (
        <View style={[
          styles.coordBar,
          { top: insets.top + 8 },
          showLayerPanel && isWideScreen && { left: SIDE_PANEL_WIDTH + 16 },
        ]}>
          <View style={styles.coordContent}>
            <Ionicons name="navigate" size={14} color="#4285F4" style={styles.coordIcon} />
            <Text style={styles.coordText}>
              {formatCoord(location.latitude, true)}  {formatCoord(location.longitude, false)}
            </Text>
            {location.accuracy != null && (
              <Text style={styles.accuracyText}>
                {'\u00B1'}{location.accuracy.toFixed(0)}m
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Loading indicator */}
      {isLoading && !location && (
        <View style={[
          styles.coordBar,
          { top: insets.top + 8 },
          showLayerPanel && isWideScreen && { left: SIDE_PANEL_WIDTH + 16 },
        ]}>
          <View style={styles.coordContent}>
            <Text style={styles.coordText}>Getting GPS fix...</Text>
          </View>
        </View>
      )}

      {/* Error display */}
      {error && (
        <View style={[
          styles.coordBar,
          styles.errorBar,
          { top: insets.top + 8 },
          showLayerPanel && isWideScreen && { left: SIDE_PANEL_WIDTH + 16 },
        ]}>
          <View style={styles.coordContent}>
            <Ionicons name="warning" size={14} color="#FF6B6B" style={styles.coordIcon} />
            <Text style={[styles.coordText, styles.errorText]}>{error}</Text>
          </View>
        </View>
      )}

      {/* Layer menu backdrop */}
      {showLayerMenu && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowLayerMenu(false)}
        />
      )}

      {/* Layer popup menu */}
      {showLayerMenu && (
        <View style={[styles.layerMenu, { bottom: insets.bottom + 84 }]}>
          {TILE_SOURCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.layerMenuItem}
              onPress={() => handleSelectTileSource(opt.id)}
              activeOpacity={0.6}
            >
              <Text style={styles.layerMenuCheck}>
                {tileSource === opt.id ? '\u2713' : '  '}
              </Text>
              <Text style={styles.layerMenuLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ─── Desktop: Left side panel ─── */}
      {showLayerPanel && isWideScreen && (
        <View style={[styles.sidePanel, { top: insets.top, bottom: insets.bottom }]}>
          {panelContent}
        </View>
      )}

      {/* ─── Mobile: Full-screen modal ─── */}
      {!isWideScreen && (
        <Modal
          visible={showLayerPanel}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLayerPanel(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            {panelContent}
          </View>
        </Modal>
      )}

      {/* Overlay (layer management) button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 144 }]}
        onPress={() => setShowLayerPanel((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="map"
          size={24}
          color={showLayerPanel ? '#34A853' : overlays.length > 0 ? '#34A853' : '#4285F4'}
        />
      </TouchableOpacity>

      {/* Layer toggle button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 84 }]}
        onPress={handleToggleLayerMenu}
        activeOpacity={0.7}
      >
        <Ionicons
          name="layers"
          size={24}
          color={tileSource !== 'osm' ? '#34A853' : '#4285F4'}
        />
      </TouchableOpacity>

      {/* Locate me button */}
      <TouchableOpacity
        style={[styles.controlButton, { bottom: insets.bottom + 24 }]}
        onPress={handleLocateMe}
        activeOpacity={0.7}
      >
        <Ionicons name="locate" size={24} color="#4285F4" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Mini "Move to group" dropdown component ──────────

function MoveGroupMenu({
  overlay,
  groups,
  onMove,
}: {
  overlay: OverlayInfo;
  groups: OverlayGroup[];
  onMove: (overlayId: string, groupId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        activeOpacity={0.6}
        hitSlop={8}
        style={styles.overlayActionBtn}
      >
        <Ionicons name="folder-outline" size={18} color="#888" />
      </TouchableOpacity>
      {open && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.moveGroupMenu}>
            {groups
              .filter((g) => g.id !== overlay.groupId)
              .map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.moveGroupItem}
                  onPress={() => {
                    onMove(overlay.id, g.id);
                    setOpen(false);
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="folder-open-outline" size={14} color="#4285F4" />
                  <Text style={styles.moveGroupText} numberOfLines={1}>{g.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  coordBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  errorBar: {
    backgroundColor: 'rgba(80, 0, 0, 0.8)',
  },
  coordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordIcon: {
    marginRight: 6,
  },
  coordText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  accuracyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginLeft: 8,
  },
  errorText: {
    color: '#FF6B6B',
  },
  controlButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 4,
    zIndex: 10,
  },
  layerMenu: {
    position: 'absolute',
    right: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 4,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
    elevation: 6,
    zIndex: 20,
    minWidth: 180,
  },
  layerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  layerMenuCheck: {
    width: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  layerMenuLabel: {
    fontSize: 14,
    color: '#333333',
  },

  // ─── Side panel (desktop) — glassmorphism ─────
  sidePanel: {
    position: 'absolute',
    left: 0,
    width: SIDE_PANEL_WIDTH,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    zIndex: 30,
    boxShadow: '2px 0px 16px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
  },

  // ─── Full-screen modal (mobile) — glassmorphism
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  // ─── Shared panel styles ──────────────────────
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
  panelCloseBtn: {
    padding: 4,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonSecondary: {
    backgroundColor: '#EEF3FF',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#4285F4',
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollInner: {
    padding: 12,
  },

  // ─── Group — glass cards ──────────────────────
  groupContainer: {
    marginBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  groupCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
  },
  groupMenuBtn: {
    padding: 4,
  },
  groupContextMenu: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 8,
  },
  contextMenuText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyGroupText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // ─── Overlay card ─────────────────────────────
  overlayCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  overlayCardHidden: {
    opacity: 0.5,
  },
  overlayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visibilityBtn: {
    padding: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  overlayName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  overlayNameHidden: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  overlayActionBtn: {
    padding: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36,
    paddingTop: 4,
    gap: 4,
  },
  opacityLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    width: 32,
    textAlign: 'right',
  },

  // ─── Move group menu ──────────────────────────
  moveGroupMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 160,
    zIndex: 100,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  moveGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  moveGroupText: {
    fontSize: 13,
    color: '#FFFFFF',
  },

  // ─── Dialog ───────────────────────────────────
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  dialogBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 340,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dialogBtnPrimary: {
    backgroundColor: '#4285F4',
  },
  dialogBtnTextCancel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  dialogBtnTextPrimary: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
});
