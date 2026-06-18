import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { useNostr } from './NostrContext';

export default function SignUpScreen({ navigation }: any) {
  const { createAccount, nsec, npub, isAuthenticated } = useNostr();
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'keys'>('name');

  const handleGo = async () => {
    await createAccount();
    setStep('keys');
  };

  const handleContinue = () => {
    navigation.replace('Chat');
  };

  if (step === 'keys') {
    return (
      <View style={styles.container}>
        <StatusBar style="light-content" backgroundColor="transparent" translucent />
        <View style={styles.content}>
          <Text style={styles.heading}>Your Keys</Text>
          <Text style={styles.description}>
            Save your secret key somewhere safe. You need it to log in on another device.
          </Text>
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>Secret Key (nsec)</Text>
            <Text style={styles.keyValue} selectable>{nsec}</Text>
          </View>
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>Public Key (npub)</Text>
            <Text style={styles.keyValue} selectable>{npub}</Text>
          </View>
          <TouchableOpacity style={styles.goButton} onPress={handleContinue}>
            <Text style={styles.goButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light-content" backgroundColor="transparent" translucent />
      <View style={styles.content}>
        <Text style={styles.heading}>Sign Up</Text>
        <TextInput
          style={styles.input}
          placeholder="What's your name?"
          placeholderTextColor="#555"
          color="#fff"
          textAlign="center"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.goButton} onPress={handleGo}>
          <Text style={styles.goButtonText}>Generate Keys</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <Text style={styles.alreadyText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.linkText}>Sign In</Text>
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
    paddingHorizontal: 32,
  },
  heading: {
    fontWeight: '700',
    fontSize: 29,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
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
  keyBox: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  keyLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  keyValue: {
    color: '#E0E0E0',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
