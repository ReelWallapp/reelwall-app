import { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  visible: boolean;
  siteKey: string;
  onToken: (token: string) => void;
  onClose: () => void;
};

export default function TurnstileCaptcha({
  visible,
  siteKey,
  onToken,
  onClose,
}: Props) {
  const webViewRef = useRef<WebView>(null);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        <style>
          body {
            margin: 0;
            background: #081E33;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
        </style>
      </head>
      <body>
        <div
          class="cf-turnstile"
          data-sitekey="${siteKey}"
          data-callback="onTurnstileSuccess"
          data-theme="dark"
        ></div>

        <script>
          function onTurnstileSuccess(token) {
            window.ReactNativeWebView.postMessage(token);
          }
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={(event) => {
              const token = event.nativeEvent.data;
              if (token) {
                onToken(token);
                onClose();
              }
            }}
            style={styles.webview}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#081E33',
  },
  webview: {
    flex: 1,
    backgroundColor: '#081E33',
  },
});