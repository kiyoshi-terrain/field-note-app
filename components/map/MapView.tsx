import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { generateMapHtml } from './map-html';
import type { MapViewProps, MapViewHandle } from './types';

export default forwardRef<MapViewHandle, MapViewProps>(
  function MapView({ options, onMapMoved, onMapLoaded }, ref) {
    const webViewRef = useRef<WebView>(null);
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
    }), [sendCommand]);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapMoved' && onMapMoved) {
          onMapMoved(data.center, data.zoom);
        } else if (data.type === 'mapLoaded' && onMapLoaded) {
          onMapLoaded();
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
