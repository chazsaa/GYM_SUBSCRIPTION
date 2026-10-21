import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../theme/colors';

// Goes back to the previous screen.
// If there is no previous screen (for example, the page was opened directly),
// it goes to the "fallback" route instead, so the button never does nothing.
const BackButton = ({ fallback = '/' }) => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      activeOpacity={0.7}
      onPress={handleBack}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.arrow}>‹</Text>
      <Text style={styles.label}>Back</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  arrow: {
    color: COLORS.accent,
    fontSize: 30,
    lineHeight: 30,
    marginRight: 6,
  },
  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default BackButton;
