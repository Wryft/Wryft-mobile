import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const imageSize = width * 0.75;

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar style="light-content" backgroundColor="transparent" translucent />
      <View style={styles.imageContainer}>
        <Image
          source={require('./assets/icon.png')}
          style={{ width: imageSize, height: imageSize }}
          resizeMode="contain"
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.heading}>Secure Easy To Use, Chat App</Text>
        <Text style={styles.subheading}>Chat without having to worry about your data being sold Wryft is fully open source and uses the Nostr protocol.</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.buttonText}>Set Up Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  content: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 70,
    paddingHorizontal: 32,
  },
  heading: {
    fontWeight: '700',
    fontSize: 27,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 35,
    marginBottom: 12,
  },
  subheading: {
    fontSize: 14,
    color: '#999',
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: '75%',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#4641D9',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '68%',
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
    color: '#fff',
  },
});
