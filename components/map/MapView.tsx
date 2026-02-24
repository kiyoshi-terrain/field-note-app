import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { generateMapHtml } from './map-html';
import type { MapViewProps, MapViewHandle, OverlayInfo } from './types';

export default forwardRef<MapViewHandle, MapViewProps>(
  function MapView({ options, onMapMoved, onMapLoaded }, ref) {
    const webViewRef = useRef<WebView>(null);
    const overlayResolveRef = useRef<((info: OverlayInfo | null) => void) | null>(null);
    const html = generateMapHtml(options);

    const sendCommand = useCallback((cmd: object) => {
      const js = `handleCommand(${JSON.stringify(cmd)}); true;`;
      webViewRef.current?.injectJavaScript(js);
    }, []);

    useImperativeHandle(ref, () => ({
      updateLocation(lng: number, lat: number, accuracy: number | null) {
        sendCommand({
          type: 'updateLocation',
          longitude: lng,
          latitude: lat,
          accuracy: accuracy ?? 0,
        });
      },
      flyToLocation(lng: number, lat: number, zoom?: number) {
        sendCommand({
          type: 'flyToLocation',
          longitude: lng,
          latitude: lat,
          zoom: zoom ?? 16,
        });
      },
      hideLocation() {
        sendCommand({ type: 'hideLocation' });
      },
      setTileSource(source: string) {
        sendCommand({ type: 'setTileSource', source });
      },
      async addRasterOverlay(id: string, pmtilesUrl: string): Promise<OverlayInfo | null> {
        // For native, send command and wait for response via message
        return new Promise((resolve) => {
          overlayResolveRef.current = resolve;
          sendCommand({ type: 'addRasterOverlay', id, url: pmtilesUrl });
          // Timeout after 10s
          setTimeout(() => {
            if (overlayResolveRef.current) {
              overlayResolveRef.current = null;
              resolve(null);
            }
          }, 10000);
        });
      },
      removeRasterOverlay(id: string) {
        sendCommand({ type: 'removeRasterOverlay', id });
      },
      setOverlayOpacity(id: string, opacity: number) {
        sendCommand({ type: 'setOverlayOpacity', id, opacity });
      },
    }), [sendCommand]);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapMoved' && onMapMoved) {
          onMapMoved(data.center, data.zoom);
        } else if (data.type === 'mapLoaded' && onMapLoaded) {
          onMapLoaded();
        } else if (data.type === 'overlayAdded' && overlayResolveRef.current) {
          overlayResolveRef.current(data.info);
          overlayResolveRef.current = null;
        }
      } catch {
        // Ignore malformed messages
      }
    }, [onMapMoved, onMapLoaded]);

    return (
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        style={styles.container}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
      />
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
