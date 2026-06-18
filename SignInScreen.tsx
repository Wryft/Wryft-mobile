import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { useNostr } from './NostrContext';

export default function SignInScreen({ navigation }: any) {
  const { loginWithNsec, loginWithNpub } = useNostr();
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleGo = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError('Enter your nsec or npub key');
      return;
    }

    if (trimmed.startsWith('nsec')) {
      if (loginWithNsec(trimmed)) {
        navigation.replace('Chat');
      } else {
        setError('Invalid nsec key');
      }
    } else if (trimmed.startsWith('npub')) {
      if (loginWithNpub(trimmed)) {
        navigation.replace('Chat');
      } else {
        setError('Invalid npub key');
      }
    } else {
      setError('Key must start with nsec or npub');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light-content" backgroundColor="transparent" translucent />
      <View style={styles.content}>
        <Text style={styles.heading}>Sign In</Text>
        <TextInput
          style={styles.input}
          placeholder="nsec1... or npub1..."
          placeholderTextColor="#555"
          color="#fff"
          textAlign="center"
          autoCapitalize="none"
          autoCorrect={false}
          value={keyInput}
          onChangeText={(t) => { setKeyInput(t); setError(''); }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.goButton} onPress={handleGo}>
          <Text style={styles.goButtonText}>Go</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <Text style={styles.alreadyText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.linkText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontWeight: '700',
    fontSize: 29,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    width: '62%',
    paddingVertical: 10,
    marginBottom: 20,
  },
  error: {
    color: '#F23F42',
    fontSize: 13,
    marginBottom: 12,
  },
  goButton: {
    backgroundColor: '#4641D9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  goButtonText: {
    fontWeight: '600',
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
  },
  divider: {
    width: '62%',
    height: 1,
    backgroundColor: '#333',
    marginBottom: 20,
  },
  alreadyText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
});
