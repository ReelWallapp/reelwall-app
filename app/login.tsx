import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!trimmedEmail) {
      Alert.alert('Enter your email');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setCodeSent(true);
      Alert.alert('Check your email', 'We have sent you a secure login code.');
    } catch (error: any) {
      console.log('Send code error:', error);
      Alert.alert('Could not send code', error?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const signInDemo = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInAnonymously();

      if (error) throw error;
    } catch (error: any) {
      console.log('Demo login error:', error);
      Alert.alert('Demo login failed', error?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!trimmedEmail) {
      Alert.alert('Enter your email');
      return;
    }

    if (!code.trim()) {
      Alert.alert('Enter the code from your email');
      return;
    }

    try {
      setLoading(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: code.trim(),
        type: 'email',
      });

      if (error) throw error;

      if (!session) {
        Alert.alert('Login failed', 'No session was created.');
        return;
      }

      Alert.alert('Success', 'You are now signed in to ReelWall.');
    } catch (error: any) {
      console.log('Verify code error:', error);
      Alert.alert('Invalid code', error?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.eyebrow}>REELWALL</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Enter your email and we’ll send you a login code.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor="#7D8FA3"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            editable={!loading}
          />

          {!codeSent ? (
            <>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={sendCode}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Sending...' : 'Send Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={signInDemo}
                style={[styles.demoButton, loading && styles.buttonDisabled]}
                disabled={loading}
              >
                <Text style={styles.demoButtonText}>Continue as Demo User</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="email code"
                placeholderTextColor="#7D8FA3"
                keyboardType="number-pad"
                style={styles.input}
                editable={!loading}
                maxLength={8}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={verifyCode}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={sendCode}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Resend Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={signInDemo}
                style={[styles.demoButton, loading && styles.buttonDisabled]}
                disabled={loading}
              >
                <Text style={styles.demoButtonText}>Continue as Demo User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setCode('');
                  setCodeSent(false);
                }}
                disabled={loading}
              >
                <Text style={styles.linkButtonText}>Use a different email</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.helper}>
            ReelWall will use this email to connect your profile and collections.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#102C47',
    color: '#F5F7FA',
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#F2C94C',
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0A2540',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 16,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102C47',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginBottom: 10,
  },
  linkButtonText: {
    color: '#A5B3C2',
    fontSize: 14,
    fontWeight: '600',
  },
  helper: {
    color: '#8FA3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  demoButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#12314F',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.5)',
  },
  demoButtonText: {
    color: '#F2C94C',
    fontSize: 15,
    fontWeight: '800',
  },
});