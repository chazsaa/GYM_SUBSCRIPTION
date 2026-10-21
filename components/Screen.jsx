import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';

// Reusable screen wrapper.
// Whatever we put between <Screen> and </Screen> is "children".
const Screen = ({ children }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
});

export default Screen;
